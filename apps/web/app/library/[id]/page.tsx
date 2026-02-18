"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Download, Loader2, LogOut, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

interface BookDetail {
  id: string;
  title: string;
  genre: string | null;
  subgenre: string | null;
  target_audience: string | null;
  status: string | null;
  chapter_1: string | null;
  cover_prompt: string | null;
  cover_image_url: string | null;
  pdf_url: string | null;
  epub_url: string | null;
  amazon_listing: Record<string, unknown> | null;
  demand_score: number | null;
  estimated_revenue: string | null;
  created_at: string;
}

const statusClasses: Record<string, string> = {
  ready: "border-green-500/30 bg-green-500/10 text-green-300",
  generating: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  published: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

function formatStatus(value: string | null) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function LibraryBookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [user, setUser] = useState<User | null>(null);
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadBook() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(`/login?redirect=/library/${bookId}`);
        return;
      }
      setUser(user);

      if (!bookId) {
        setError("Book not found.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", bookId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        setError("Could not load this book.");
        setLoading(false);
        return;
      }

      setBook(data as BookDetail);
      setLoading(false);
    }

    loadBook();
  }, [bookId, router]);

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

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <Button
          asChild
          variant="ghost"
          className="-ml-2 w-fit text-zinc-400 hover:text-zinc-100"
        >
          <Link href="/library">
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Link>
        </Button>

        {error && (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardContent className="p-4 text-sm text-red-300">{error}</CardContent>
          </Card>
        )}

        {book && (
          <>
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-2xl text-zinc-100">{book.title}</CardTitle>
                    <p className="mt-2 text-sm text-zinc-400">
                      {book.genre || "Unknown genre"}
                      {book.subgenre ? ` / ${book.subgenre}` : ""}
                    </p>
                  </div>
                  <Badge
                    className={
                      statusClasses[book.status || ""] ||
                      "border-zinc-700 bg-zinc-800 text-zinc-300"
                    }
                  >
                    {formatStatus(book.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-5 text-sm text-zinc-400">
                  <span>
                    Demand score: <span className="text-zinc-200">{book.demand_score ?? "N/A"}</span>
                  </span>
                  <span>
                    Revenue est.: <span className="text-zinc-200">{book.estimated_revenue ?? "N/A"}</span>
                  </span>
                  <span>
                    Audience: <span className="text-zinc-200">{book.target_audience ?? "N/A"}</span>
                  </span>
                </div>
              </CardHeader>
            </Card>

            {(book.pdf_url || book.epub_url) && (
              <Card className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="text-base">Downloads</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {book.pdf_url && (
                    <Button
                      asChild
                      className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
                    >
                      <a href={book.pdf_url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" />
                        Download PDF
                      </a>
                    </Button>
                  )}
                  {book.epub_url && (
                    <Button
                      asChild
                      variant="outline"
                      className="gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    >
                      <a href={book.epub_url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" />
                        Download EPUB
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {book.cover_image_url && (
              <Card className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="text-base">Cover</CardTitle>
                </CardHeader>
                <CardContent>
                  <Image
                    src={book.cover_image_url}
                    alt="Book cover"
                    width={420}
                    height={630}
                    className="w-full max-w-xs rounded-lg border border-zinc-700"
                  />
                </CardContent>
              </Card>
            )}

            {book.chapter_1 && (
              <Card className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="text-base">Chapter 1 Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                    {book.chapter_1}
                  </p>
                </CardContent>
              </Card>
            )}

            {book.cover_prompt && (
              <Card className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="text-base">Cover Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="rounded bg-zinc-800 p-3 font-mono text-sm leading-relaxed text-zinc-300">
                    {book.cover_prompt}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
