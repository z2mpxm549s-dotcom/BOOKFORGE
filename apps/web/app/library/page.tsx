"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Sparkles, LogOut, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface Book {
  id: string;
  title: string;
  genre: string | null;
  subgenre: string | null;
  status: string | null;
  demand_score: number | null;
  created_at: string;
}

const statusClasses: Record<string, string> = {
  ready: "border-green-500/30 bg-green-500/10 text-green-300",
  generating: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  published: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(value: string | null) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function LibraryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadLibrary() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?redirect=/library");
        return;
      }

      setUser(user);

      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError("Failed to load your books. Please try again.");
        setLoading(false);
        return;
      }

      setBooks((data as Book[]) || []);
      setLoading(false);
    }

    loadLibrary();
  }, [router]);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="font-bold tracking-tight">BOOKFORGE</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              {user?.user_metadata?.full_name || user?.email}
            </span>
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

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">My Library</h1>
            <p className="text-zinc-400">Your generated books, newest first.</p>
          </div>
          <Button asChild className="bg-violet-600 text-white hover:bg-violet-500">
            <Link href="/dashboard">Create New Book</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardContent className="p-4 text-sm text-red-300">{error}</CardContent>
          </Card>
        )}

        {!error && books.length === 0 && (
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <p className="text-lg font-semibold text-zinc-100">No books yet</p>
              <p className="max-w-md text-sm text-zinc-400">
                Generate your first AI book and it will appear here.
              </p>
              <Button asChild className="bg-violet-600 text-white hover:bg-violet-500">
                <Link href="/dashboard">Create your first book</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!error && books.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {books.map((book) => (
              <Card key={book.id} className="border-zinc-800 bg-zinc-900">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-2 text-lg leading-snug text-zinc-100">
                      {book.title}
                    </CardTitle>
                    <Badge
                      className={
                        statusClasses[book.status || ""] ||
                        "border-zinc-700 bg-zinc-800 text-zinc-300"
                      }
                    >
                      {formatStatus(book.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {book.genre || "Unknown genre"}
                    {book.subgenre ? ` / ${book.subgenre}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Demand score</span>
                    <span className="font-semibold text-violet-300">
                      {book.demand_score ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Created</span>
                    <span className="text-zinc-300">{formatDate(book.created_at)}</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  >
                    View
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
