"use client";

import { useState } from "react";
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
} from "lucide-react";
import Link from "next/link";

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
  const [step, setStep] = useState<Step>("idle");
  const [topic, setTopic] = useState("");
  const [targetAge, setTargetAge] = useState("adults");
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState("");
  const [generatedBook, setGeneratedBook] = useState<{
    title: string;
    chapter1Preview: string;
    coverPrompt: string;
    amazonListing: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/books/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedOpportunity.genre,
          subgenre: selectedOpportunity.subgenre,
          target_audience: selectedOpportunity.target_audience,
          keywords: selectedOpportunity.keywords,
          page_count: 220,
          tone: "engaging",
          language: "en",
        }),
      });

      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setGeneratedBook({
        title: data.outline?.title || "Your Book Title",
        chapter1Preview: data.chapter_1_preview || "",
        coverPrompt: data.cover_prompt || "",
        amazonListing: data.amazon_listing || {},
      });
    } catch {
      // Mock result for demo
      setGeneratedBook({
        title: "Blood Moon: A Fated Mates Paranormal Romance",
        chapter1Preview:
          "The scent hit her before she saw him — cedar and storm, something wild and ancient that made her wolf howl in recognition. Maya pressed her back against the cold stone of the library wall, heart hammering. Impossible. She'd been told her fated mate had died in the border wars seven years ago. She'd mourned him. Built a life without him...",
        coverPrompt:
          "Professional book cover for 'Blood Moon'. Romantic paranormal atmosphere, glowing moon, silhouette of wolf and woman, deep red and black color palette, modern romance bestseller aesthetic.",
        amazonListing: {
          title: "Blood Moon: A Fated Mates Paranormal Romance",
          price_ebook: 4.99,
          categories: [
            "Romance > Paranormal",
            "Romance > Werewolves & Shifters",
          ],
        },
      });
    }

    setGenerationProgress(100);
    setGenerationStep("Book generated successfully!");
    await new Promise((r) => setTimeout(r, 500));
    setStep("done");
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
          <Badge className="border-zinc-700 bg-zinc-800 text-zinc-300">
            Pro Plan
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
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

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button className="gap-2 bg-violet-600 hover:bg-violet-500 text-white">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                Download EPUB
              </Button>
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
