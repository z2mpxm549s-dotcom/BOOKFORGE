import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function TermsPage() {
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
        <h1 className="mb-2 text-3xl font-bold">Terms of Service</h1>
        <p className="mb-8 text-sm text-zinc-400">Last updated: February 18, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Service Description</h2>
            <p>
              BOOKFORGE provides software tools to research market opportunities,
              generate book drafts with AI, and support publishing workflows for
              platforms such as Amazon KDP.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Accounts and Access</h2>
            <p>
              You are responsible for maintaining the security of your account
              credentials and for all activity under your account.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">User Content and Ownership</h2>
            <p>
              You are the owner of the books and related content generated through
              your account. You are responsible for ensuring your content complies
              with applicable law, copyright rules, and Amazon KDP policies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Billing and Payments</h2>
            <p>
              Paid plans are billed through Stripe. Subscription renewals,
              cancellations, refunds, and payment disputes are handled according to
              BOOKFORGE and Stripe billing terms in effect at the time of purchase.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Acceptable Use</h2>
            <p>
              You agree not to use BOOKFORGE for unlawful, fraudulent, or abusive
              activity. We may suspend or terminate accounts that violate these
              Terms or create material risk to the platform.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Changes to Terms</h2>
            <p>
              BOOKFORGE may update these Terms periodically. Continued use of the
              service after updates means you accept the revised Terms.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
