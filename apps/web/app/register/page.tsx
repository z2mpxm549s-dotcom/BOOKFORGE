"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Chrome, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-400" />
          <h2 className="mb-2 text-xl font-bold text-zinc-100">Check your email</h2>
          <p className="mb-6 text-zinc-400">
            We sent a confirmation link to{" "}
            <span className="text-zinc-200">{email}</span>. Click it to activate
            your account.
          </p>
          <Button
            onClick={() => router.push("/login")}
            variant="outline"
            className="border-zinc-700 text-zinc-300"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
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
              Create your account
            </CardTitle>
            <p className="text-center text-sm text-zinc-500">
              Start with 1 free book — no credit card needed
            </p>
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

            {/* Registration form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Full name</Label>
                <Input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
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
                <Label className="text-zinc-300">Password</Label>
                <Input
                  type="password"
                  placeholder="Min. 8 characters"
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
                  "Create Account"
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-zinc-600">
              By signing up you agree to our{" "}
              <Link href="/terms" className="underline hover:text-zinc-400">Terms</Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-zinc-400">Privacy Policy</Link>.
            </p>

            <p className="text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-violet-400 hover:text-violet-300">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
