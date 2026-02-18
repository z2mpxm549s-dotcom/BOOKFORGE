# BOOKFORGE — Master Project Document
> Last updated: February 2026 | Status: Active Development | Target Launch: 30 days

---

## 1. CONTEXT & PURPOSE

This document is the single source of truth for the BOOKFORGE project. It covers business decisions, technical architecture, feature roadmap, and implementation guidelines. Every developer (or AI agent) working on this project should read this first.

**Why this document exists:** BOOKFORGE is being built at speed with AI assistance. Without a master document, decisions get lost, duplicate work happens, and the architecture drifts. This file prevents that.

---

## 2. PROJECT OVERVIEW

**BOOKFORGE** is an AI-powered SaaS platform that generates complete, market-optimized books (ebooks + audiobooks) designed to sell on Amazon KDP and other publishing platforms.

**Core Value Proposition:**
> "Tell us your idea, or let AI decide. BOOKFORGE researches what's selling NOW, then writes the full book — optimized title, cover, Amazon listing, and all chapters — in under 2 minutes."

**What makes it different from competitors (Sudowrite, Jasper, NovelAI):**
- Researches market BEFORE generating (data-driven, not random)
- Full pipeline: research → write → format → Amazon listing → publish
- Human-quality writing (multi-model pipeline, not a single LLM dump)
- Audiobook generation built in (3x revenue multiplier)

---

## 3. BUSINESS INFORMATION

| Field | Value |
|-------|-------|
| **Project Name** | BOOKFORGE |
| **Legal Status** | Registering company (in progress) |
| **Owner** | luisteixeiracudeiro |
| **GitHub** | github.com/z2mpxm549s-dotcom/BOOKFORGE |
| **Domain** | Not yet purchased — **recommend: bookforge.app** |
| **Target Launch** | 30 days from now (mid-March 2026) |

### Target Markets (ALL simultaneously)
1. **Anglophone Global** — USA, UK, Australia (Amazon.com) — Primary, largest market
2. **Spain & Latin America** — Amazon.es and regional stores
3. **Europe Multilingual** — English + French, German, Italian expansion later

### Business Model
| Plan | Price | Books/mo | Key Features |
|------|-------|----------|--------------|
| Starter | $9/mo | 1 | Market research, PDF + EPUB, Amazon listing |
| Pro | $29/mo | 5 | + Auto-publish KDP, cover generation, all formats |
| Enterprise | $99/mo | 20 | + Audiobook (ElevenLabs), API access, white label |

**Secondary revenue:** Owner uses the platform themselves to generate books and sell on Amazon KDP (passive income channel running in parallel to the SaaS subscriptions).

### Copyright Policy
- Each user **owns 100% of the books they generate**
- BOOKFORGE makes no claim on generated content
- AI disclosure: Users are responsible for compliance with Amazon's AI disclosure requirements
- Jurisdiction: To be defined when company is registered

---

## 4. TECHNICAL ARCHITECTURE

### Monorepo Structure
```
BOOKFORGE/
├── apps/
│   ├── api/          FastAPI (Python 3.14) — backend
│   └── web/          Next.js 16 (TypeScript) — frontend
├── packages/
│   └── core/         Shared types (future use)
├── .env              Local secrets (gitignored)
└── .env.example      Template for all required keys
```

### Tech Stack

**Backend (apps/api/)**
| Layer | Tech | Version |
|-------|------|---------|
| Framework | FastAPI | 0.129.0 |
| Server | Uvicorn | 0.41.0 |
| Language | Python | 3.14 |
| AI Primary | Anthropic Claude Opus 4.6 | SDK 0.81.0 |
| AI Fast/Cheap | Anthropic Claude Haiku 4.5 | SDK 0.81.0 |
| AI Secondary | OpenAI GPT-5 | SDK 2.21.0 |
| Validation | Pydantic | 2.12.5 |
| HTTP Client | httpx + aiohttp | 0.28.1 / 3.13.3 |

**Frontend (apps/web/)**
| Layer | Tech | Version |
|-------|------|---------|
| Framework | Next.js | 16.1.6 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui + Radix UI | Latest |
| Icons | Lucide React | 0.574.0 |
| DB Client | @supabase/supabase-js | 2.97.0 |

**Infrastructure**
| Service | Purpose | Status |
|---------|---------|--------|
| Supabase | PostgreSQL DB + Auth + Storage | Configured, not implemented |
| Vercel | Frontend hosting | Planned |
| Railway/Render | FastAPI hosting | Planned |
| Cloudflare | DNS + CDN | Planned |
| GitHub | Source control | Active (z2mpxm549s-dotcom/BOOKFORGE) |

### API Endpoints (Current)
```
GET  /health                      Health check
POST /api/research/analyze        Market research (top 3 opportunities)
GET  /api/research/trending       Trending genres quick list
POST /api/books/generate          Full book pipeline
POST /api/books/outline-only      Outline only (fast preview)
```

### Running Locally
```bash
# Terminal 1 — Backend
cd apps/api && source venv/bin/activate
uvicorn main:app --reload
# → http://localhost:8000/docs

# Terminal 2 — Frontend
cd apps/web && npm run dev
# → http://localhost:3000
```

---

## 5. API KEYS & SERVICES

### Configured & Working
| Service | Key in .env | Status |
|---------|-------------|--------|
| Anthropic Claude | `ANTHROPIC_API_KEY` | ✅ Active |
| OpenAI GPT-5 | `OPENAI_API_KEY` | ✅ Active |
| Grok (xAI) | `GROK_API_KEY` | ✅ Active |
| ElevenLabs | `ELEVENLABS_API_KEY` | ✅ Active (not yet used in code) |
| Gemini (Google) | `GEMINI_API_KEY` | ✅ Active (for image generation) |

### Configured, Key Needed
| Service | Key in .env | Next Step |
|---------|-------------|-----------|
| Stripe | `STRIPE_SECRET_KEY` etc. | Get keys from stripe.com |
| Resend | `RESEND_API_KEY` | Sign up at resend.com |
| Supabase | `SUPABASE_URL` etc. | ✅ URL configured |

### Not Yet Configured
| Service | Purpose | Priority |
|---------|---------|----------|
| Reddit API | Trend research | Medium |
| Twitter/X API | Trend research | Medium |
| Amazon KDP API | Auto-publish | High |
| SEMrush API | Keyword research | Low |

### Supabase Project
- **URL:** `https://amtaknnojcoahqwkfodg.supabase.co`
- **Project Ref:** `amtaknnojcoahqwkfodg`
- **DB Password:** In `.env` as `SUPABASE_DB_PASSWORD`

---

## 6. CURRENT STATE (What's Built)

### ✅ Done & Working
- **Market Research Engine** (`apps/api/routers/research.py`)
  - Claude Opus analyzes trends + opportunities in real time
  - Amazon bestseller scraping (public, no API key needed)
  - Returns 3 ranked opportunities with demand scores, revenue estimates, keywords
  - Tested and verified working

- **Book Generation Pipeline** (`apps/api/routers/books.py`)
  - Complete outline (20-30 chapters)
  - Full Chapter 1 (2,500-3,500 words, human-quality)
  - Amazon KDP listing (HTML-formatted description + categories + keywords)
  - Cover generation prompt (for Gemini Imagen)
  - Tested and verified working

- **Landing Page** (`apps/web/app/page.tsx`)
  - Hero, features, how-it-works, pricing, CTA, footer
  - Dark theme (zinc-950 + violet-500 accent)
  - Responsive, builds clean

- **Dashboard / Book Wizard** (`apps/web/app/dashboard/page.tsx`)
  - 4-step wizard: research → select opportunity → generate → download
  - Live API calls with mock fallback
  - Progress tracking UI
  - Results display

### ⚠️ Partially Done
- **API Integration in Dashboard:** Works but falls back to mock data if API isn't running
- **Download buttons:** UI exists, actual PDF/EPUB generation not implemented

### ❌ Not Yet Built
- User authentication (Supabase Auth)
- Database schema (users, books, subscriptions tables)
- PDF/EPUB file generation
- Cover image generation (Gemini Imagen)
- Audiobook generation (ElevenLabs)
- Stripe payments + subscription management
- Auto-publish to Amazon KDP
- Email notifications (Resend)
- Privacy Policy page
- Terms of Service page
- Admin dashboard
- User book library / history

---

## 7. ROADMAP — 30-DAY SPRINT TO LAUNCH

### Week 1 — Foundation (Auth + DB)
**Priority: Users must be able to register, login, and have their books saved.**

1. **Supabase Database Schema**
   ```sql
   -- Tables to create:
   users (id, email, plan, credits_remaining, created_at)
   books (id, user_id, title, genre, status, outline_json, chapter1, amazon_listing, cover_prompt, epub_url, pdf_url, created_at)
   subscriptions (id, user_id, stripe_customer_id, plan, status, current_period_end)
   market_research (id, user_id, topic, result_json, created_at)
   ```

2. **Auth Implementation**
   - Methods: Email + password, Google OAuth
   - Supabase Auth (built-in, no extra library)
   - Protected routes: `/dashboard` requires login
   - Auth pages: `/login`, `/register`, `/forgot-password`

3. **User Session in Frontend**
   - `createBrowserClient` from `@supabase/ssr`
   - Middleware to protect dashboard routes
   - User data in React context

### Week 2 — Core Product (PDF/EPUB + Covers)
**Priority: Users get a real downloadable book.**

4. **PDF Generation**
   - Library: `reportlab` (Python) or `weasyprint`
   - Include: cover image + all chapters + Amazon back cover
   - Store in Supabase Storage, return download URL

5. **EPUB Generation**
   - Library: `ebooklib` (Python)
   - Valid EPUB 3.0 format for Kindle compatibility
   - Include metadata: title, author, genre, cover

6. **Cover Image Generation (Gemini Imagen)**
   - API: Google AI `imagegeneration@006` via `AIzaSy...` key
   - Input: cover_prompt from Book Generation Pipeline
   - Output: 6:9 ratio JPG, 300 DPI
   - Store in Supabase Storage

7. **Connect Full Pipeline in Backend**
   ```
   POST /api/books/generate →
     1. Generate outline + chapter (Claude Opus)
     2. Generate cover (Gemini Imagen)
     3. Create EPUB + PDF (with cover embedded)
     4. Upload to Supabase Storage
     5. Save book record to DB
     6. Return download URLs
   ```

### Week 3 — Monetization (Stripe)
**Priority: Paying customers.**

8. **Stripe Integration**
   - Products: 3 subscription tiers ($9, $29, $99)
   - Checkout: Stripe Checkout (hosted, fast to implement)
   - Webhook: Handle subscription events (created, updated, cancelled)
   - Credit system: deduct book credits on generation
   - Upgrade/downgrade flow in settings

9. **Plan Enforcement in Backend**
   - Middleware checks user plan before `/api/books/generate`
   - Returns 403 if credits exhausted
   - Monthly credit reset via cron job

### Week 4 — Polish & Launch
**Priority: Ship it.**

10. **Email Notifications (Resend)**
    - Welcome email (signup)
    - Book ready email (with download link)
    - Payment receipt
    - Templates: HTML emails with BOOKFORGE branding

11. **Legal Pages**
    - `/privacy` — Privacy Policy
    - `/terms` — Terms of Service (include AI disclosure)

12. **Domain + Deploy**
    - Buy `bookforge.app` (Cloudflare Registrar or Namecheap)
    - Frontend: Vercel (connect GitHub repo, auto-deploy)
    - Backend: Railway (Docker or Python runtime)
    - DNS: Cloudflare (proxy + SSL)

13. **Amazon KDP Auto-Publish (Stretch Goal)**
    - Amazon SP-API or KDP API
    - Requires Amazon Seller Central account
    - If too complex for launch: make it "guided manual" (copy-paste to KDP)

---

## 8. DATABASE SCHEMA

### Supabase Tables to Create

```sql
-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text not null,
  full_name text,
  plan text default 'starter' check (plan in ('starter', 'pro', 'enterprise')),
  credits_remaining integer default 1,
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Books
create table public.books (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  genre text,
  subgenre text,
  target_audience text,
  status text default 'generating' check (status in ('generating', 'ready', 'published', 'failed')),
  outline_json jsonb,
  chapter_1 text,
  amazon_listing jsonb,
  cover_prompt text,
  cover_image_url text,
  epub_url text,
  pdf_url text,
  demand_score integer,
  estimated_revenue text,
  created_at timestamptz default now()
);

-- Subscriptions
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  plan text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.subscriptions enable row level security;

-- Policies: users can only see their own data
create policy "Users see own profile" on public.profiles for all using (auth.uid() = id);
create policy "Users see own books" on public.books for all using (auth.uid() = user_id);
create policy "Users see own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);
```

---

## 9. AUTHENTICATION FLOW

### Methods
- Email + Password (Supabase built-in)
- Google OAuth (Supabase provider)

### Pages to Build
| Route | Purpose |
|-------|---------|
| `/login` | Email/password + Google button |
| `/register` | Sign up form |
| `/forgot-password` | Password reset email |
| `/auth/callback` | OAuth redirect handler (required by Supabase) |

### Protected Routes
- `/dashboard` and all subroutes require authenticated session
- Middleware in `apps/web/middleware.ts` using `@supabase/ssr`

---

## 10. BOOK GENERATION OUTPUT SPEC

### What Each Book Includes
| Component | Format | Generator |
|-----------|--------|-----------|
| Title + Subtitle | Text | Claude Opus |
| Back Cover Description | 150 words | Claude Opus |
| Complete Outline | 20-30 chapters | Claude Opus |
| Chapter 1 (full) | 2,500-3,500 words | Claude Opus |
| Chapters 2-end | Summaries only (full gen = future) | Claude Opus |
| Amazon Listing | HTML-formatted text | Claude Haiku |
| Keywords | 7 Amazon keywords | Claude Haiku |
| Cover Image | 6:9 JPG, 300 DPI | Gemini Imagen |
| PDF | Cover + all content | reportlab/weasyprint |
| EPUB | Kindle-compatible | ebooklib |
| Audiobook | MP3 narration | ElevenLabs (Pro/Enterprise) |

### Output Formats by Plan
| Plan | PDF | EPUB | Audiobook | Full chapters |
|------|-----|------|-----------|---------------|
| Starter ($9) | ✅ | ✅ | ❌ | Chapter 1 only |
| Pro ($29) | ✅ | ✅ | ❌ | All chapters |
| Enterprise ($99) | ✅ | ✅ | ✅ | All chapters |

---

## 11. DESIGN SYSTEM

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| Background | `zinc-950` (#0a0a0a) | Page backgrounds |
| Surface | `zinc-900` (#18181b) | Cards, inputs |
| Border | `zinc-800` (#27272a) | Dividers |
| Text Primary | `zinc-50` (#fafafa) | Headings |
| Text Secondary | `zinc-400` (#a1a1aa) | Body text |
| Accent | `violet-600` (#7c3aed) | Buttons, active |
| Accent Light | `violet-400` (#a78bfa) | Icons, highlights |
| Success | `green-400` (#4ade80) | Rising trends |
| Warning | `yellow-400` (#facc15) | Medium competition |
| Danger | `red-400` (#f87171) | High competition |

### Typography
- Font: Geist Sans (already configured in layout.tsx)
- Headings: `font-bold` or `font-extrabold`
- Body: Regular weight, `leading-relaxed`

### Component Patterns
- Cards: `border-zinc-800 bg-zinc-900 rounded-xl`
- Buttons Primary: `bg-violet-600 hover:bg-violet-500 text-white`
- Buttons Secondary: `border-zinc-700 bg-transparent text-zinc-300`
- Badges: `border-violet-500/30 bg-violet-500/10 text-violet-300`

---

## 12. CODING CONVENTIONS

### Python (Backend)
- snake_case for all names
- Async everywhere (AsyncAnthropic, asyncio.gather)
- Pydantic models for all request/response shapes
- HTTPException for API errors, not raw exceptions
- Imports at top of functions only when necessary (json, re)
- Section dividers: `# ─── Section Name ───`

### TypeScript (Frontend)
- "use client" at top for any component with state/events
- Interfaces for all data shapes
- Tailwind classes, no CSS modules
- shadcn/ui components for all UI primitives
- Lucide React for all icons
- No any types

### Git
- Branch: `main` (single branch for now, feature branches when team grows)
- Commits: Imperative tone ("Add Supabase auth", not "Added auth")
- Never commit .env (gitignored)
- Push after each completed feature

---

## 13. NEXT IMMEDIATE ACTION (START HERE)

The next thing to build is **Supabase Auth + protected dashboard**.

### Files to create/modify:
1. **`apps/web/middleware.ts`** — Route protection
2. **`apps/web/lib/supabase/client.ts`** — Browser Supabase client
3. **`apps/web/lib/supabase/server.ts`** — Server Supabase client
4. **`apps/web/app/login/page.tsx`** — Login page
5. **`apps/web/app/register/page.tsx`** — Register page
6. **`apps/web/app/auth/callback/route.ts`** — OAuth callback
7. **`apps/web/app/dashboard/page.tsx`** — Wrap with auth check

### Dependencies to install:
```bash
cd apps/web && npm install @supabase/ssr
```

### Supabase Dashboard actions needed:
- Enable Email auth provider
- Enable Google OAuth provider (needs Google Client ID + Secret)
- Create database tables (SQL in Section 8)
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in .env.local

---

## 14. VERIFICATION CHECKLIST

How to test each feature before marking done:

- [ ] **Auth:** Register with email → verify email → login → access /dashboard → logout → /dashboard redirects to /login
- [ ] **Google OAuth:** Click Google → authorize → land on dashboard with user profile
- [ ] **Market Research:** Run research with and without topic → 3 opportunities returned → demand scores and revenue visible
- [ ] **Book Generation:** Select opportunity → generate → progress bar completes → title/chapter/cover prompt visible
- [ ] **PDF Download:** Click Download PDF → file opens with cover + content
- [ ] **EPUB Download:** Click Download EPUB → file opens in Kindle preview
- [ ] **Stripe:** Click plan → Stripe checkout opens → complete payment → plan updates in DB → credits correct
- [ ] **Book Library:** Generated books appear in user's library → can re-download
- [ ] **Email:** Signup triggers welcome email → book ready triggers notification email

---

## 15. OPEN QUESTIONS TO RESOLVE

- [ ] Company name for registration (BOOKFORGE Ltd? or different name?)
- [ ] Country of company registration (Spain, USA, UK?)
- [ ] Will Amazon KDP auto-publish be MVP or post-launch?
- [ ] How many full chapters does the AI generate vs Chapter 1 only?
- [ ] ElevenLabs voice selection (one voice? user picks? per genre?)
- [ ] Affiliate/referral program (from day 1 or later?)
- [ ] Admin panel (needed before launch or after?)
