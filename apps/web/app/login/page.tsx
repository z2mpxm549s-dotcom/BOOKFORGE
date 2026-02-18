"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Chrome } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <span className="text-lg font-bold text-zinc-100">BOOKFORGE</span>
        </Link>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-xl text-zinc-100">
              Welcome back
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google OAuth */}
            <Button
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              variant="outline"
              className="w-full gap-2 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Chrome className="h-4 w-4" />
              )}
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-900 px-2 text-zinc-500">or</span>
              </div>
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Email</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-300">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-zinc-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-violet-400 hover:text-violet-300">
                Sign up free
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
