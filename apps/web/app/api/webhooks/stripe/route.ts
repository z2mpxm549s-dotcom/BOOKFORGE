import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

// Service role client — bypasses RLS for webhook operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_CREDITS: Record<string, number> = {
  starter: 1,
  pro: 5,
  enterprise: 20,
};

async function sendBillingEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "BOOKFORGE <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error("Failed to send billing email:", err);
  }
}

async function getProfileEmailByUserId(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  return data?.email || null;
}

async function getProfileByCustomerId(customerId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id,email,plan")
    .eq("stripe_customer_id", customerId)
    .single();

  return data || null;
}

async function activatePlan(userId: string, plan: string, subscriptionId: string, customerId: string, periodEnd: number) {
  const credits = PLAN_CREDITS[plan] ?? 1;

  await supabaseAdmin
    .from("profiles")
    .update({
      plan,
      credits_remaining: credits,
      stripe_customer_id: customerId,
    })
    .eq("id", userId);

  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      plan,
      status: "active",
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: false,
    },
    { onConflict: "stripe_subscription_id" }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;

        if (!userId || !plan || !session.subscription || !session.customer) break;

        const subscriptionResponse = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const subscription = subscriptionResponse as unknown as Stripe.Subscription;
        const periodEndUnix = Number(
          (subscription as unknown as { current_period_end?: number }).current_period_end ??
            Math.floor(Date.now() / 1000)
        );

        await activatePlan(
          userId,
          plan,
          subscription.id,
          session.customer as string,
          periodEndUnix
        );

        const email = await getProfileEmailByUserId(userId);
        if (email) {
          await sendBillingEmail(
            email,
            `BOOKFORGE ${plan} plan activated`,
            `<p>Your <strong>${plan}</strong> plan is now active.</p>
             <p>You can manage billing anytime in Settings.</p>`
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        const plan = subscription.metadata?.plan;

        if (!userId || !plan) break;

        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan,
            status: subscription.status,
            current_period_end: new Date(
              Number(
                (subscription as unknown as { current_period_end?: number }).current_period_end ??
                  Math.floor(Date.now() / 1000)
              ) * 1000
            ).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (subscription.status === "active") {
          await supabaseAdmin
            .from("profiles")
            .update({ plan, credits_remaining: PLAN_CREDITS[plan] ?? 1 })
            .eq("id", userId);

          const email = await getProfileEmailByUserId(userId);
          if (email && subscription.cancel_at_period_end) {
            await sendBillingEmail(
              email,
              "BOOKFORGE subscription update",
              "<p>Your subscription is active but set to cancel at period end.</p>"
            );
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        await supabaseAdmin
          .from("profiles")
          .update({ plan: "starter", credits_remaining: 0 })
          .eq("id", userId);

        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        const email = await getProfileEmailByUserId(userId);
        if (email) {
          await sendBillingEmail(
            email,
            "BOOKFORGE subscription canceled",
            "<p>Your paid subscription has been canceled and your account moved to Starter.</p>"
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const profile = await getProfileByCustomerId(customerId);

        if (profile) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_customer_id", customerId);

          if (profile.email) {
            await sendBillingEmail(
              profile.email,
              "BOOKFORGE payment failed",
              "<p>We could not process your payment. Please update your card in billing settings.</p>"
            );
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
