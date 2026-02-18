import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  BookOpen,
  Zap,
  BarChart3,
  Globe,
  Headphones,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Market Research Engine",
    description:
      "Analyzes Amazon bestsellers, BookTok trends, and keyword data before generating a single word. Your book is designed to sell.",
  },
  {
    icon: BookOpen,
    title: "Full Book Generation",
    description:
      "Claude Opus + GPT-4 write your complete book — outline, all chapters, back cover, Amazon listing — in minutes.",
  },
  {
    icon: Headphones,
    title: "Audiobook Ready",
    description:
      "ElevenLabs converts your book to professional-quality audio automatically. Sell in 2 formats, earn 3x more.",
  },
  {
    icon: Globe,
    title: "Auto-Publish to Amazon KDP",
    description:
      "One click publishes your book with optimized title, description, categories, and keywords. No manual work.",
  },
  {
    icon: BarChart3,
    title: "Sales Dashboard",
    description:
      "Track earnings across all platforms in real time. Know which genres make the most money and double down.",
  },
  {
    icon: Zap,
    title: "Human-Quality Writing",
    description:
      "Not robotic AI text. Our multi-model pipeline produces books that read like they were written by a bestselling author.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    description: "Perfect to start",
    features: [
      "1 book per month",
      "Market research included",
      "PDF + EPUB download",
      "Amazon listing generated",
      "Email support",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For serious authors",
    features: [
      "5 books per month",
      "Market research included",
      "All formats (PDF, EPUB, Word)",
      "Auto-publish to Amazon KDP",
      "Cover generation",
      "Priority support",
    ],
    cta: "Get Pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "Scale without limits",
    features: [
      "20 books per month",
      "Audiobook generation (ElevenLabs)",
      "All Pro features",
      "API access",
      "White label option",
      "Dedicated support",
    ],
    cta: "Go Enterprise",
    highlighted: false,
  },
];

const stats = [
  { value: "2 min", label: "Average book generation time" },
  { value: "3x", label: "Revenue with audiobook add-on" },
  { value: "100+", label: "Genres supported" },
  { value: "$0", label: "Publishing cost on Amazon KDP" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="text-lg font-bold tracking-tight">BOOKFORGE</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="#pricing"
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Pricing
            </Link>
            <Link href="/dashboard">
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid-bg px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <Badge className="mb-6 border-violet-500/30 bg-violet-500/10 text-violet-300">
            AI-Powered Book Publishing Platform
          </Badge>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
            Publish books that{" "}
            <span className="gradient-text">actually sell</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 leading-relaxed">
            BOOKFORGE researches the market first, then generates a complete,
            human-quality book optimized for Amazon KDP — in under 2 minutes.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="bg-violet-600 hover:bg-violet-500 text-white px-8 gap-2"
              >
                Start Creating Books <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              See how it works
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-zinc-800 px-6 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-violet-400">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Everything you need to publish and profit
            </h2>
            <p className="text-zinc-400">
              From market research to Amazon listing — fully automated.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="card-glow border-zinc-800 bg-zinc-900"
              >
                <CardContent className="p-6">
                  <feature.icon className="mb-4 h-6 w-6 text-violet-400" />
                  <h3 className="mb-2 font-semibold text-zinc-100">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-zinc-800 bg-zinc-900/50 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            How BOOKFORGE works
          </h2>
          <p className="mb-16 text-zinc-400">3 steps. 2 minutes. 1 book ready to sell.</p>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Market Research",
                desc: "Tell us your idea (or let us pick). We analyze Amazon, BookTok, and keyword data to find the best angle.",
              },
              {
                step: "02",
                title: "AI Generation",
                desc: "Claude Opus writes the full book — outline, every chapter, back cover copy, and Amazon listing.",
              },
              {
                step: "03",
                title: "Publish & Profit",
                desc: "Download your book or auto-publish to Amazon KDP. Add audiobook. Start earning.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="mb-4 text-4xl font-black text-violet-500/30">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold text-zinc-100">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="text-zinc-400">Cancel anytime. No hidden fees.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative border ${
                  plan.highlighted
                    ? "border-violet-500 bg-violet-950/30"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-violet-600 text-white">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="text-sm font-medium text-zinc-400">
                      {plan.name}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-4xl font-black text-zinc-100">
                        {plan.price}
                      </span>
                      <span className="text-zinc-500">{plan.period}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {plan.description}
                    </div>
                  </div>
                  <ul className="mb-6 space-y-2">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-sm text-zinc-300"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/dashboard">
                    <Button
                      className={`w-full ${
                        plan.highlighted
                          ? "bg-violet-600 hover:bg-violet-500 text-white"
                          : "border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800"
                      }`}
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 bg-zinc-900/50 px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Ready to publish your first book?
          </h2>
          <p className="mb-8 text-zinc-400">
            Join thousands of authors who use BOOKFORGE to publish data-driven
            books that sell.
          </p>
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-500 text-white px-10 gap-2"
            >
              Start for free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="font-semibold text-zinc-300">BOOKFORGE</span>
            <span>© 2026</span>
          </div>
          <div className="flex gap-6 text-sm text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
