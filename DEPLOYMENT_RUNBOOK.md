# BOOKFORGE Deployment Runbook

## 1) Configure Environment Variables

Set these in both API and Web runtimes:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default: `books`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ENTERPRISE`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_DEFAULT_VOICE_ID`
- `CRON_SECRET`

Run preflight locally:

```bash
python3 scripts/ops/preflight_check.py
```

## 2) Apply Supabase Migrations

Run migrations in order:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_book_jobs_and_audiobook_url.sql`

## 3) Deploy API (FastAPI) — Railway (recommended)

1. Go to **railway.app** → Login with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `z2mpxm549s-dotcom/BOOKFORGE`
4. Set **Root Directory** to `apps/api`
5. Railway auto-detects the Dockerfile and builds it

Add these env vars in Railway dashboard:
```
ANTHROPIC_API_KEY=<from .env>
OPENAI_API_KEY=<from .env>
GEMINI_API_KEY=AIzaSyCmTVjH-kipmq5zMlMZ5lpTAzxD8f04VwU
ELEVENLABS_API_KEY=<from .env>
SUPABASE_URL=https://amtaknnojcoahqwkfodg.supabase.co
SUPABASE_ANON_KEY=<from .env>
SUPABASE_SERVICE_ROLE_KEY=<from .env>
SUPABASE_STORAGE_BUCKET=books
```

6. Once deployed, copy the Railway URL (e.g. `https://bookforge-api.up.railway.app`)
7. Update `NEXT_PUBLIC_API_URL` in Vercel dashboard to that URL

**Alternative — Render (free tier):**
- render.yaml is already configured in the repo root
- Go to render.com → New → Blueprint → Connect GitHub repo

**Local Docker test:**
```bash
docker build -f apps/api/Dockerfile apps/api -t bookforge-api:latest
docker run --env-file .env -p 8000:8000 bookforge-api:latest
curl http://localhost:8000/health
```

## 4) Deploy Web (Next.js)

Web app lives in `apps/web`. Vercel root is already configured in `vercel.json`.

Build check:

```bash
cd apps/web
npm run lint
npm run build
```

## 5) Stripe Webhook Setup

Webhook endpoint:

- `POST /api/webhooks/stripe`

Required events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## 6) Monthly Credit Reset

Cron endpoint (already implemented):

- `POST /api/cron/reset-credits`

Vercel cron is configured in `vercel.json` for:

- `0 0 1 * *` (monthly reset)

Use `CRON_SECRET` as `Authorization: Bearer ...` or `x-cron-secret`.

## 7) Post-Deploy Smoke Tests

1. Register/Login user.
2. Generate a Starter book and confirm:
   - `books` row created
   - `pdf_url` + `epub_url` saved
3. Upgrade to Pro and generate again:
   - full chapters generated
   - cover image generated and URL saved
4. Upgrade to Enterprise and generate audiobook:
   - audiobook URL saved
5. Open `/library` and `/library/[id]`, verify downloads.
6. Confirm billing events and emails from webhook triggers.

## 8) Security Follow-up

- Rotate any previously exposed secrets in Stripe, Supabase, OpenAI, Anthropic, Gemini, ElevenLabs, GitHub.
- Replace temporary or leaked tokens with new values in all environments.
- Re-run preflight after rotation.
