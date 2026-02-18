"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Sparkles,
  LogOut,
  Loader2,
  CheckCircle2,
  CreditCard,
  Zap,
  Crown,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  plan: string;
  credits_remaining: number;
  email: string;
  full_name: string | null;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$9",
    period: "/mo",
    icon: Zap,
    books: 1,
    features: ["1 book per month", "PDF + EPUB export", "Amazon listing", "Market research"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/mo",
    icon: Crown,
    books: 5,
    popular: true,
    features: ["5 books per month", "PDF + EPUB export", "Amazon listing", "Market research", "All chapters (coming soon)", "Cover generation (coming soon)"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$99",
    period: "/mo",
    icon: Building2,
    books: 20,
    features: ["20 books per month", "PDF + EPUB export", "Amazon listing", "Market research", "All chapters (coming soon)", "Cover generation (coming soon)", "Audiobook — ElevenLabs (coming soon)", "API access (coming soon)"],
  },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=/settings");
        return;
      }
      setUser(user);

      const { data } = await supabase
        .from("profiles")
        .select("plan, credits_remaining, email, full_name")
        .eq("id", user.id)
        .single();

      setProfile(data as Profile | null);
      setLoading(false);
    }

    load();
  }, [router]);

  async function handleUpgrade(planId: string) {
    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutLoading(null);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const currentPlan = profile?.plan ?? "starter";
  const creditsRemaining = profile?.credits_remaining ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="font-bold tracking-tight">BOOKFORGE</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
              <Link href="/library">Library</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Success/Cancel banners */}
        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            <p className="text-sm text-green-300">
              Payment successful! Your plan has been activated. It may take a few seconds to update.
            </p>
          </div>
        )}
        {canceled && (
          <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3">
            <p className="text-sm text-zinc-400">Checkout canceled. You haven&apos;t been charged.</p>
          </div>
        )}

        <h1 className="mb-8 text-3xl font-bold">Settings</h1>

        {/* Current Plan Card */}
        <Card className="mb-8 border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-violet-400" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold capitalize text-zinc-100">{currentPlan}</span>
                <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300 capitalize">
                  Active
                </Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                {creditsRemaining} book{creditsRemaining !== 1 ? "s" : ""} remaining this month
              </p>
              <p className="text-sm text-zinc-500">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              onClick={() => handleUpgrade(currentPlan)}
            >
              Manage Billing
            </Button>
          </CardContent>
        </Card>

        {/* Plans */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Change Plan</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isCurrent = plan.id === currentPlan;
              const isLoading = checkoutLoading === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={`relative border ${
                    plan.popular
                      ? "border-violet-500/50 bg-violet-950/20"
                      : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="border-violet-500 bg-violet-600 text-white text-xs">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-violet-400" />
                      <CardTitle className="text-lg text-zinc-100">{plan.name}</CardTitle>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-zinc-50">{plan.price}</span>
                      <span className="text-sm text-zinc-500">{plan.period}</span>
                    </div>
                    <p className="text-sm text-zinc-400">{plan.books} book{plan.books !== 1 ? "s" : ""}/month</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <Button
                        disabled
                        className="w-full border-zinc-700 bg-zinc-800 text-zinc-500"
                        variant="outline"
                      >
                        Current plan
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={isLoading || !!checkoutLoading}
                        className={`w-full text-white ${
                          plan.popular
                            ? "bg-violet-600 hover:bg-violet-500"
                            : "bg-zinc-700 hover:bg-zinc-600"
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `Upgrade to ${plan.name}`
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
