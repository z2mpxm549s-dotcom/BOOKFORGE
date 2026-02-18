"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  TrendingUp,
  BookOpen,
  Plus,
  ArrowRight,
  Loader2,
  CheckCircle2,
  BarChart3,
  Download,
  ChevronRight,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Opportunity {
  genre: string;
  subgenre: string;
  demand_score: number;
  competition_level: string;
  trend_direction: string;
  suggested_price_ebook: number;
  suggested_price_paperback: number;
  target_audience: string;
  keywords: string[];
  why_now: string;
  estimated_monthly_revenue: string;
}

interface ResearchResult {
  opportunities: Opportunity[];
  market_summary: string;
  recommended_opportunity: Opportunity;
  research_sources: string[];
}

interface GeneratedBookResponse {
  outline?: {
    title?: string;
    subtitle?: string | null;
    back_cover_description?: string;
    chapters?: Array<{
      number: number;
      title: string;
      summary?: string;
      content?: string;
    }>;
    [key: string]: unknown;
  };
  chapter_1_preview?: string;
  amazon_listing?: Record<string, unknown>;
  cover_prompt?: string;
  full_chapters?: Array<{
    number: number;
    title: string;
    summary?: string;
    content?: string;
  }>;
  cover_image_base64?: string;
  cover_image_mime_type?: string;
  book_id?: string;
  plan_used?: "starter" | "pro" | "enterprise";
  credits_remaining?: number;
  pdf_url?: string;
  epub_url?: string;
  cover_image_url?: string;
  audiobook_url?: string;
  generation_notes?: string[];
  notification_sent?: boolean;
}

type Step = "idle" | "researching" | "research_done" | "generating" | "done";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const competitionColor = (level: string) => {
  if (level === "low") return "text-green-400";
  if (level === "medium") return "text-yellow-400";
  return "text-red-400";
};

const trendIcon = (direction: string) => {
  if (direction === "rising") return "↑";
  if (direction === "declining") return "↓";
  return "→";
};

const trendColor = (direction: string) => {
  if (direction === "rising") return "text-green-400";
  if (direction === "declining") return "text-red-400";
  return "text-zinc-400";
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("starter");
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [topic, setTopic] = useState("");
  const [targetAge, setTargetAge] = useState("adults");
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);
  const [aiModel, setAiModel] = useState<"claude" | "gpt-5">("claude");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState("");
  const [generatedBook, setGeneratedBook] = useState<{
    title: string;
    chapter1Preview: string;
    coverPrompt: string;
    amazonListing: Record<string, unknown>;
    outline: GeneratedBookResponse["outline"] | null;
    fullChapters: GeneratedBookResponse["full_chapters"] | null;
    coverImageBase64: string | null;
    coverImageMimeType: string | null;
    bookId: string | null;
    pdfUrl: string | null;
    epubUrl: string | null;
    coverImageUrl: string | null;
    audiobookUrl: string | null;
    creditsRemaining: number | null;
    generationNotes: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState<"pdf" | "epub" | "audio" | null>(null);

  // ─── Auth check ───────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?redirect=/dashboard");
        return;
      }

      setUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      const userPlan = profile?.plan;
      if (userPlan === "starter" || userPlan === "pro" || userPlan === "enterprise") {
        setPlan(userPlan);
      }

      setAuthLoading(false);
    }

    loadUser();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  // Mock data for when API is not yet connected
  const mockResearch: ResearchResult = {
    market_summary:
      "The romance market is experiencing its strongest cycle in over a decade, driven by BookTok and Kindle Unlimited's binge-reading culture. Dark romance and fated mates tropes are dominating discovery algorithms.",
    research_sources: ["Amazon Bestsellers", "BookTok Feb 2026", "KDP data"],
    recommended_opportunity: {
      genre: "Romance",
      subgenre: "Fated Mates Shifter Romance",
      demand_score: 91,
      competition_level: "medium",
      trend_direction: "rising",
      suggested_price_ebook: 4.99,
      suggested_price_paperback: 14.99,
      target_audience: "Women 25-45, Kindle Unlimited subscribers",
      keywords: [
        "fated mates romance",
        "wolf shifter romance",
        "paranormal romance",
        "alpha mate",
        "dark romance",
        "enemies to lovers",
        "bear shifter",
      ],
      why_now:
        "#fatedmates has surpassed 2.8B TikTok views. The trope merges perfectly with paranormal worldbuilding. Amazon algorithm currently favors series starters in this niche.",
      estimated_monthly_revenue: "$1,200-3,500",
    },
    opportunities: [
      {
        genre: "Romance",
        subgenre: "Fated Mates Shifter Romance",
        demand_score: 91,
        competition_level: "medium",
        trend_direction: "rising",
        suggested_price_ebook: 4.99,
        suggested_price_paperback: 14.99,
        target_audience: "Women 25-45, Kindle Unlimited subscribers",
        keywords: ["fated mates", "wolf shifter", "paranormal romance"],
        why_now:
          "#fatedmates has surpassed 2.8B TikTok views. Amazon algorithm favors series starters in this niche.",
        estimated_monthly_revenue: "$1,200-3,500",
      },
      {
        genre: "Self-Help",
        subgenre: "AI Productivity for Entrepreneurs",
        demand_score: 84,
        competition_level: "low",
        trend_direction: "rising",
        suggested_price_ebook: 9.99,
        suggested_price_paperback: 24.99,
        target_audience: "Entrepreneurs 28-45, tech-forward professionals",
        keywords: ["AI productivity", "entrepreneur success", "automation"],
        why_now:
          "AI adoption is exploding. Business owners searching for practical guides. Very low-quality competition in this specific angle.",
        estimated_monthly_revenue: "$900-2,800",
      },
      {
        genre: "Mystery",
        subgenre: "Cozy Mystery with Cat Protagonist",
        demand_score: 78,
        competition_level: "low",
        trend_direction: "stable",
        suggested_price_ebook: 3.99,
        suggested_price_paperback: 12.99,
        target_audience: "Women 45+, cozy mystery fans, pet lovers",
        keywords: ["cozy mystery", "cat mystery", "small town mystery"],
        why_now:
          "Cozy mystery readership grew 23% in 2025. Cat-themed books consistently outperform genre averages. KU readers binge entire series.",
        estimated_monthly_revenue: "$600-1,800",
      },
    ],
  };

  async function runResearch() {
    setStep("researching");
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/research/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic || undefined,
          target_age: targetAge,
          language: "en",
        }),
      });

      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      setResearch(data);
      setSelectedOpportunity(data.recommended_opportunity);
    } catch {
      // Use mock data if API is not running locally
      setResearch(mockResearch);
      setSelectedOpportunity(mockResearch.recommended_opportunity);
    }

    setStep("research_done");
  }

  async function generateBook() {
    if (!selectedOpportunity) return;
    setStep("generating");
    setGenerationProgress(0);
    setError(null);

    const steps = [
      { label: "Analyzing market data...", progress: 15 },
      { label: "Building book structure...", progress: 35 },
      { label: "Writing Chapter 1...", progress: 60 },
      { label: "Generating Amazon listing...", progress: 80 },
      { label: "Creating cover prompt...", progress: 95 },
    ];

    for (const s of steps) {
      setGenerationStep(s.label);
      setGenerationProgress(s.progress);
      await new Promise((r) => setTimeout(r, 800));
    }

    let data: GeneratedBookResponse;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const payload = {
        genre: selectedOpportunity.genre,
        subgenre: selectedOpportunity.subgenre,
        target_audience: selectedOpportunity.target_audience,
        keywords: selectedOpportunity.keywords,
        page_count: 220,
        tone: "engaging",
        language: "en",
        ai_model: aiModel,
        plan,
        generate_full_book: plan === "pro" || plan === "enterprise",
        generate_cover_image: plan === "pro" || plan === "enterprise",
        generate_audiobook: false,
        recipient_email: user?.email || undefined,
        demand_score: selectedOpportunity.demand_score,
        estimated_revenue: selectedOpportunity.estimated_monthly_revenue,
      };

      if (plan === "pro" || plan === "enterprise") {
        const startRes = await fetch(`${apiUrl}/api/books/generate-async`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!startRes.ok) {
          const err = await startRes.text();
          throw new Error(err || "Generation start failed");
        }

        const job = await startRes.json();
        if (!job?.job_id) throw new Error("Invalid generation job response");

        const timeoutMs = 15 * 60 * 1000;
        const startTime = Date.now();

        while (true) {
          if (Date.now() - startTime > timeoutMs) {
            throw new Error("Generation timed out. Please try again.");
          }

          await new Promise((r) => setTimeout(r, 1800));
          const statusRes = await fetch(`${apiUrl}/api/books/jobs/${job.job_id}`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (!statusRes.ok) throw new Error("Could not read generation status");
          const status = await statusRes.json();

          if (typeof status.progress === "number") {
            setGenerationProgress(Math.min(99, Math.max(status.progress, 10)));
          }
          if (status.step) setGenerationStep(status.step);

          if (status.status === "completed") {
            data = status.result as GeneratedBookResponse;
            break;
          }
          if (status.status === "failed") {
            throw new Error(status.error || "Generation failed");
          }
        }
      } else {
        const res = await fetch(`${apiUrl}/api/books/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || "Generation failed");
        }
        data = await res.json();
      }
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Book generation failed.";
      const allowMock = process.env.NODE_ENV !== "production";

      if (!allowMock) {
        setError(message);
        setStep("research_done");
        return;
      }

      // Mock result for local fallback
      data = {
        outline: {
          title: "Blood Moon: A Fated Mates Paranormal Romance",
          subtitle: "A Fated Mates Paranormal Romance",
          back_cover_description:
            "Maya believed her fated mate was dead. When a scent from her past drags her into a war between rival packs, she must decide whether to trust fate one more time.",
          chapters: [
            {
              number: 1,
              title: "Moonbound",
              summary: "Maya senses her mate is alive and is forced back into pack politics.",
            },
          ],
        },
        chapter_1_preview:
          "The scent hit her before she saw him — cedar and storm, something wild and ancient that made her wolf howl in recognition. Maya pressed her back against the cold stone of the library wall, heart hammering. Impossible. She'd been told her fated mate had died in the border wars seven years ago. She'd mourned him. Built a life without him...",
        cover_prompt:
          "Professional book cover for 'Blood Moon'. Romantic paranormal atmosphere, glowing moon, silhouette of wolf and woman, deep red and black color palette, modern romance bestseller aesthetic.",
        amazon_listing: {
          title: "Blood Moon: A Fated Mates Paranormal Romance",
          price_ebook: 4.99,
          categories: [
            "Romance > Paranormal",
            "Romance > Werewolves & Shifters",
          ],
        },
        credits_remaining: undefined,
      };
      setError(`Using local demo fallback: ${message}`);
    }

    const generatedTitle = data.outline?.title || "Your Book Title";
    const chapterPreview = data.chapter_1_preview || "";
    const coverPrompt = data.cover_prompt || "";
    const amazonListing = data.amazon_listing || {};
    const outline = data.outline || null;
    const fullChapters = data.full_chapters || null;
    const generationNotes = data.generation_notes || [];

    setGeneratedBook({
      title: generatedTitle,
      chapter1Preview: chapterPreview,
      coverPrompt,
      amazonListing,
      outline,
      fullChapters,
      coverImageBase64: data.cover_image_base64 || null,
      coverImageMimeType: data.cover_image_mime_type || null,
      bookId: data.book_id || null,
      pdfUrl: data.pdf_url || null,
      epubUrl: data.epub_url || null,
      coverImageUrl: data.cover_image_url || null,
      audiobookUrl: data.audiobook_url || null,
      creditsRemaining:
        typeof data.credits_remaining === "number" ? data.credits_remaining : null,
      generationNotes,
    });

    if (data.plan_used) {
      setPlan(data.plan_used);
    }
    if (generationNotes.length > 0) setError(generationNotes.join(" "));

    setGenerationProgress(100);
    setGenerationStep("Book generated successfully!");
    await new Promise((r) => setTimeout(r, 500));
    setStep("done");
  }

  async function downloadExport(format: "pdf" | "epub") {
    if (!generatedBook) return;
    setDownloadLoading(format);
    setError(null);

    const storedUrl = format === "pdf" ? generatedBook.pdfUrl : generatedBook.epubUrl;
    if (storedUrl) {
      const a = document.createElement("a");
      a.href = storedUrl;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.download = `${generatedBook.title}.${format}`;
      a.click();
      setDownloadLoading(null);
      return;
    }

    const chaptersForExport =
      generatedBook.fullChapters && generatedBook.fullChapters.length > 0
        ? generatedBook.fullChapters
        : generatedBook.outline?.chapters || [];

    const backCoverDescription =
      generatedBook.outline?.back_cover_description ||
      (generatedBook.amazonListing.description_html as string) ||
      "";

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generatedBook.title,
          subtitle: generatedBook.outline?.subtitle || null,
          author: user?.user_metadata?.full_name || "BOOKFORGE AI",
          genre: selectedOpportunity?.genre || null,
          back_cover_description: backCoverDescription,
          chapter_1_content: generatedBook.chapter1Preview,
          chapters: chaptersForExport,
        }),
      });

      if (!res.ok) throw new Error(`${format.toUpperCase()} export failed`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${generatedBook.title}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error(`${format.toUpperCase()} export failed:`, exportError);
      setError(`Could not export ${format.toUpperCase()}. Try again.`);
    } finally {
      setDownloadLoading(null);
    }
  }

  async function downloadAudiobookPreview() {
    if (!generatedBook || plan !== "enterprise") return;
    setDownloadLoading("audio");
    setError(null);

    try {
      if (generatedBook.audiobookUrl) {
        const a = document.createElement("a");
        a.href = generatedBook.audiobookUrl;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.download = `${generatedBook.title}_audiobook_preview.mp3`;
        a.click();
        setDownloadLoading(null);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const text =
        generatedBook.fullChapters && generatedBook.fullChapters.length > 0
          ? generatedBook.fullChapters
              .map((chapter) => chapter.content || chapter.summary || "")
              .join("\n\n")
          : generatedBook.chapter1Preview;
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired");
      }

      const res = await fetch(`${apiUrl}/api/books/audiobook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: generatedBook.title,
          text,
        }),
      });

      if (!res.ok) throw new Error("Audiobook generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${generatedBook.title}_audiobook_preview.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (audioError) {
      console.error("Audiobook generation failed:", audioError);
      setError("Could not generate audiobook preview.");
    } finally {
      setDownloadLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="font-bold tracking-tight">BOOKFORGE</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300 capitalize">
              {plan}
            </Badge>
            <span className="text-sm text-zinc-400">
              {user?.user_metadata?.full_name || user?.email}
            </span>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-100"
            >
              <Link href="/library">My Library</Link>
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
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {/* ── STEP 0: Idle ── */}
        {step === "idle" && (
          <div>
            <div className="mb-10">
              <h1 className="mb-2 text-3xl font-bold">Create a New Book</h1>
              <p className="text-zinc-400">
                We research the market first, then generate a book designed to
                sell.
              </p>
            </div>

            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-violet-400" />
                  Market Research Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-zinc-300">
                    Book idea{" "}
                    <span className="text-zinc-500">(optional — leave blank to let AI decide)</span>
                  </Label>
                  <Input
                    placeholder="e.g. paranormal romance, self-help for entrepreneurs, children adventure..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Target age group</Label>
                  <div className="flex flex-wrap gap-2">
                    {["children", "teens", "adults", "all"].map((age) => (
                      <button
                        key={age}
                        onClick={() => setTargetAge(age)}
                        className={`rounded-full border px-4 py-1.5 text-sm capitalize transition-colors ${
                          targetAge === age
                            ? "border-violet-500 bg-violet-500/20 text-violet-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {age}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">AI Model</Label>
                  <div className="flex gap-2">
                    {[
                      { id: "gpt-5", label: "GPT-5", desc: "OpenAI" },
                      { id: "claude", label: "Claude Opus", desc: "Anthropic" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setAiModel(m.id as "claude" | "gpt-5")}
                        className={`flex flex-col rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                          aiModel === m.id
                            ? "border-violet-500 bg-violet-500/20 text-violet-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        <span className="font-medium">{m.label}</span>
                        <span className="text-xs opacity-60">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={runResearch}
                  className="w-full gap-2 bg-violet-600 hover:bg-violet-500 text-white"
                  size="lg"
                >
                  <TrendingUp className="h-4 w-4" />
                  Run Market Research
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 1: Researching ── */}
        {step === "researching" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="mb-6 h-12 w-12 animate-spin text-violet-400" />
            <h2 className="mb-2 text-xl font-bold">Analyzing the market...</h2>
            <p className="text-zinc-400">
              Checking Amazon bestsellers, BookTok trends, keyword demand...
            </p>
          </div>
        )}

        {/* ── STEP 2: Research Done ── */}
        {step === "research_done" && research && (
          <div>
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <h1 className="text-2xl font-bold">Market Research Complete</h1>
              </div>
              <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
                {research.market_summary}
              </p>
            </div>

            <div className="mb-6">
              <h2 className="mb-4 font-semibold text-zinc-300">
                Top 3 Opportunities — Select one to generate your book:
              </h2>
              <div className="space-y-3">
                {research.opportunities.map((opp, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOpportunity(opp)}
                    className={`w-full rounded-xl border p-5 text-left transition-all ${
                      selectedOpportunity === opp
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {i === 0 && (
                            <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs">
                              Recommended
                            </Badge>
                          )}
                          <span className="font-semibold text-zinc-100">
                            {opp.genre} — {opp.subgenre}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {opp.target_audience}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-2xl font-black text-violet-400">
                          {opp.demand_score}
                        </div>
                        <div className="text-xs text-zinc-500">demand</div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-3 text-sm">
                      <span className={competitionColor(opp.competition_level)}>
                        ● {opp.competition_level} competition
                      </span>
                      <span className={trendColor(opp.trend_direction)}>
                        {trendIcon(opp.trend_direction)} {opp.trend_direction}
                      </span>
                      <span className="text-green-400">
                        {opp.estimated_monthly_revenue}/mo potential
                      </span>
                      <span className="text-zinc-400">
                        ${opp.suggested_price_ebook} ebook
                      </span>
                    </div>

                    <p className="text-sm text-zinc-500">{opp.why_now}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("idle")}
                className="border-zinc-700 text-zinc-400"
              >
                ← Back
              </Button>
              <Button
                onClick={generateBook}
                disabled={!selectedOpportunity}
                className="flex-1 gap-2 bg-violet-600 hover:bg-violet-500 text-white"
                size="lg"
              >
                <BookOpen className="h-4 w-4" />
                Generate Book with{" "}
                {selectedOpportunity?.subgenre || "selected opportunity"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Generating ── */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="mb-6 h-12 w-12 text-violet-400" />
            <h2 className="mb-2 text-xl font-bold">Writing your book...</h2>
            <p className="mb-8 text-zinc-400">
              Claude Opus is crafting every chapter to sound human and sell
              well.
            </p>
            <div className="w-full max-w-sm space-y-3">
              <Progress value={generationProgress} className="h-2" />
              <p className="text-sm text-zinc-400">{generationStep}</p>
            </div>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === "done" && generatedBook && (
          <div>
            <div className="mb-8 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
              <h1 className="text-2xl font-bold">Your book is ready!</h1>
            </div>

            {/* Title + quick stats */}
            <Card className="mb-6 border-violet-500/30 bg-violet-950/20">
              <CardContent className="p-6">
                <h2 className="mb-1 text-xl font-bold text-zinc-100">
                  {generatedBook.title}
                </h2>
                <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5 text-violet-400" />
                    {selectedOpportunity?.genre} / {selectedOpportunity?.subgenre}
                  </span>
                  <span className="flex items-center gap-1 text-green-400">
                    {selectedOpportunity?.estimated_monthly_revenue}/mo potential
                  </span>
                  <span className="text-zinc-400">
                    Plan: <span className="capitalize text-zinc-200">{plan}</span>
                  </span>
                  {generatedBook.creditsRemaining !== null && (
                    <span className="text-zinc-400">
                      Credits left:{" "}
                      <span className="text-zinc-200">{generatedBook.creditsRemaining}</span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chapter 1 preview */}
            <Card className="mb-6 border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-base">Chapter 1 Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-zinc-300 line-clamp-6">
                  {generatedBook.chapter1Preview}
                </p>
              </CardContent>
            </Card>

            {/* Cover prompt */}
            <Card className="mb-6 border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-base">
                  Cover Generation Prompt (Gemini Imagen / Recraft)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="rounded bg-zinc-800 p-3 text-sm text-zinc-300 font-mono leading-relaxed">
                  {generatedBook.coverPrompt}
                </p>
              </CardContent>
            </Card>

            {/* Full book generation info */}
            {generatedBook.fullChapters && generatedBook.fullChapters.length > 0 && (
              <Card className="mb-6 border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="text-base">Full Manuscript Generated</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-300">
                    {generatedBook.fullChapters.length} chapters drafted for this book.
                    You can export the complete manuscript to PDF or EPUB.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Generated cover preview */}
            {(generatedBook.coverImageBase64 || generatedBook.coverImageUrl) && (
              <Card className="mb-6 border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="text-base">Generated Cover (Gemini)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Image
                    src={
                      generatedBook.coverImageBase64
                        ? `data:${generatedBook.coverImageMimeType || "image/png"};base64,${generatedBook.coverImageBase64}`
                        : (generatedBook.coverImageUrl as string)
                    }
                    alt="Generated book cover"
                    width={420}
                    height={630}
                    className="mx-auto w-full max-w-xs rounded-lg border border-zinc-700"
                  />
                </CardContent>
              </Card>
            )}

            {/* Generation notes */}
            {generatedBook.generationNotes.length > 0 && (
              <Card className="mb-6 border-yellow-500/20 bg-yellow-500/10">
                <CardHeader>
                  <CardTitle className="text-base text-yellow-300">Generation Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-yellow-200">
                  {generatedBook.generationNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                className="gap-2 bg-violet-600 hover:bg-violet-500 text-white"
                onClick={() => downloadExport("pdf")}
                disabled={downloadLoading !== null}
              >
                {downloadLoading === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => downloadExport("epub")}
                disabled={downloadLoading !== null}
              >
                {downloadLoading === "epub" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download EPUB
              </Button>
              {plan === "enterprise" && (
                <Button
                  variant="outline"
                  className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={downloadAudiobookPreview}
                  disabled={downloadLoading !== null}
                >
                  {downloadLoading === "audio" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Audiobook Preview
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Publish to Amazon KDP
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("idle");
                  setResearch(null);
                  setGeneratedBook(null);
                  setTopic("");
                  setError(null);
                }}
                className="gap-2 text-zinc-500 hover:text-zinc-300"
              >
                <Plus className="h-4 w-4" />
                Create Another Book
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
