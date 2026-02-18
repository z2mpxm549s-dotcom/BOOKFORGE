-- ============================================================
-- BOOKFORGE — Jobs + Audiobook URL
-- ============================================================

alter table public.books
  add column if not exists audiobook_url text;

create table if not exists public.book_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  progress integer not null default 0
    check (progress >= 0 and progress <= 100),
  step text,
  request_json jsonb,
  result_json jsonb,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_book_jobs_user_id_created_at
  on public.book_jobs (user_id, created_at desc);

alter table public.book_jobs enable row level security;

create policy "Users can view own book jobs"
  on public.book_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own book jobs"
  on public.book_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own book jobs"
  on public.book_jobs for update
  using (auth.uid() = user_id);

drop trigger if exists book_jobs_updated_at on public.book_jobs;

create trigger book_jobs_updated_at
  before update on public.book_jobs
  for each row execute procedure public.set_updated_at();
