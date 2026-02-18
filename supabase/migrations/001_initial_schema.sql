-- ============================================================
-- BOOKFORGE — Initial Database Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Profiles ───────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific fields
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  plan text default 'starter' check (plan in ('starter', 'pro', 'enterprise')),
  credits_remaining integer default 1,
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Books ──────────────────────────────────────────────────
create table public.books (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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

-- ─── Subscriptions ──────────────────────────────────────────
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  plan text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Row Level Security ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Books: users can CRUD their own books
create policy "Users can view own books"
  on public.books for select
  using (auth.uid() = user_id);

create policy "Users can insert own books"
  on public.books for insert
  with check (auth.uid() = user_id);

create policy "Users can update own books"
  on public.books for update
  using (auth.uid() = user_id);

create policy "Users can delete own books"
  on public.books for delete
  using (auth.uid() = user_id);

-- Subscriptions: users can only view their own
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ─── Auto-create Profile on Signup ──────────────────────────
-- Trigger: when a new user signs up via Supabase Auth,
-- automatically create their profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Updated At Trigger ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();
