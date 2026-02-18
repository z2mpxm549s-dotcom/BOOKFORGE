import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_CREDITS: Record<string, number> = {
  starter: 1,
  pro: 5,
  enterprise: 20,
};

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const bearer = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");

  if (headerSecret && headerSecret === secret) return true;
  if (bearer === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updates = [];

    for (const [plan, credits] of Object.entries(PLAN_CREDITS)) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({ credits_remaining: credits })
        .eq("plan", plan)
        .select("id");

      if (error) throw error;
      updates.push({ plan, updated: data?.length || 0, credits });
    }

    return NextResponse.json({
      ok: true,
      updated_at: new Date().toISOString(),
      updates,
    });
  } catch (err) {
    console.error("Credit reset failed:", err);
    return NextResponse.json({ error: "Credit reset failed" }, { status: 500 });
  }
}
