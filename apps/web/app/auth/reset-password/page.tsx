"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    async function initializeRecoverySession() {
      setInitializing(true);
      setError(null);

      const supabase = createClient();
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setError("Invalid or expired reset link. Request a new one.");
          setCanReset(false);
          setInitializing(false);
          return;
        }

        window.history.replaceState({}, document.title, "/auth/reset-password");
        setCanReset(true);
        setInitializing(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Invalid or expired reset link. Request a new one.");
        setCanReset(false);
      } else {
        setCanReset(true);
      }

      setInitializing(false);
    }

    initializeRecoverySession();
  }, []);

  async function handlePasswordUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <span className="text-lg font-bold text-zinc-100">BOOKFORGE</span>
        </Link>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-xl text-zinc-100">
              Set a new password
            </CardTitle>
            <p className="text-center text-sm text-zinc-500">
              Choose a strong password for your account.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {success && (
              <div className="flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Password updated successfully. Redirecting to your dashboard...
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            {canReset ? (
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">New password</Label>
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Confirm new password</Label>
                  <Input
                    type="password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || success}
                  className="w-full bg-violet-600 text-white hover:bg-violet-500"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
                </Button>
              </form>
            ) : (
              <Button asChild className="w-full bg-violet-600 text-white hover:bg-violet-500">
                <Link href="/forgot-password">Request new reset link</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
