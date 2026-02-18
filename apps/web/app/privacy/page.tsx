import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="font-bold tracking-tight">BOOKFORGE</span>
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
        <p className="mb-8 text-sm text-zinc-400">Last updated: February 18, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Overview</h2>
            <p>
              BOOKFORGE is a software platform that helps users research, generate,
              and publish books. This Privacy Policy explains what data we collect,
              how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Data We Collect</h2>
            <p>
              We collect account and product data including your email address,
              profile details, subscription status, and books generated on the
              platform (for example outlines, chapter previews, and listing data).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">How We Use Data</h2>
            <p>
              We use your information to provide and improve BOOKFORGE features,
              authenticate your account, store your generated books, deliver support,
              and process billing and subscription operations.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Payments</h2>
            <p>
              Payment transactions are processed by Stripe. BOOKFORGE does not store
              full payment card details. Stripe handles payment data under its own
              terms and privacy policy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Ownership of Generated Content</h2>
            <p>
              You retain ownership of the content you generate with BOOKFORGE,
              subject to compliance with applicable laws and third-party platform
              policies (including Amazon KDP requirements).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Contact</h2>
            <p>
              If you have privacy questions, contact the BOOKFORGE team through the
              support channel provided in your account settings.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
