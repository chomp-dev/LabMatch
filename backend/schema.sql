-- Enable Extensions
create extension if not exists vector;

-- Profiles Table (Users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  name text,
  school text,
  major text,
  interests text[],
  resume_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Scrape Sessions
create table public.scrape_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  root_urls text[],
  objective_prompt text,
  major text,
  custom_prompt text,
  status text check (status in ('queued', 'running', 'done', 'error', 'blocked')) default 'queued',
  blocked_reason text,
  blocked_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  finished_at timestamp with time zone
);

-- Professor Cards
create table public.professor_cards (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.scrape_sessions(id) not null,
  professor_name text,
  title text,
  department text,
  school text,
  primary_url text,
  personal_urls text[],
  summary text,
  research_themes text[],
  keywords text[],
  evidence_snippets jsonb,
  recent_papers jsonb,
  undergrad_friendly_score float,
  match_score float,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Swipes
create table public.swipes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  professor_card_id uuid references public.professor_cards(id) not null,
  decision text check (decision in ('like', 'pass')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Email Drafts
create table public.email_drafts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  professor_card_id uuid references public.professor_cards(id) not null,
  subject text,
  body text,
  tone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Scrape Artifacts (Extension Ingest)
create table public.scrape_artifacts (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.scrape_sessions(id),
  source text check (source in ('backend_crawler', 'chrome_extension')),
  url text,
  title text,
  extracted_text text,
  out_links text[],
  captured_at timestamp with time zone default timezone('utc'::text, now()) not null,
  raw_metadata jsonb
);

-- Storage Buckets (need to be enabled in Storage UI as well, but RLS policies can be set here)
-- insert into storage.buckets (id, name) values ('resumes', 'resumes');

-- RLS Policies (Basic examples, need refinement)
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

alter table public.scrape_sessions enable row level security;
create policy "Users can view own sessions" on public.scrape_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.scrape_sessions for insert with check (auth.uid() = user_id);
