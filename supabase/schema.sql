-- AI Access Equity — Supabase schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query) after creating your project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- responses: one row per survey submission
-- ---------------------------------------------------------------------------
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  age text,
  employment text,
  sector text,
  training_required text,
  hands_on_access text,
  shadow_ai text,
  confidence_impact int,
  story text,
  clarify_question text,
  clarify_answer text,
  help_needed text,
  consent boolean not null default false,
  guidance text
);

alter table responses add column if not exists clarify_question text;
alter table responses add column if not exists clarify_answer text;

alter table responses enable row level security;

-- Anonymous visitors can submit a response, but cannot read other people's
-- raw responses back — only the aggregate view below is public.
drop policy if exists "anyone can insert a response" on responses;
create policy "anyone can insert a response"
  on responses for insert
  to anon
  with check (consent = true);

-- The guidance column is filled in by the server (service role key) right
-- after insert, so anon needs no update policy here.

-- ---------------------------------------------------------------------------
-- ideas: the Ideas & Suggestions Board
-- ---------------------------------------------------------------------------
create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  text text not null check (char_length(text) between 1 and 240),
  votes int not null default 0
);

alter table ideas enable row level security;

drop policy if exists "anyone can read ideas" on ideas;
create policy "anyone can read ideas"
  on ideas for select
  to anon
  using (true);

drop policy if exists "anyone can submit an idea" on ideas;
create policy "anyone can submit an idea"
  on ideas for insert
  to anon
  with check (true);

-- Votes are changed only through the increment_idea_vote() function below,
-- never by a direct UPDATE, so there is no anon update policy on this table.

-- Atomic upvote — avoids the read-then-write race a client-side increment would have.
create or replace function increment_idea_vote(idea_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update ideas set votes = votes + 1 where id = idea_id;
$$;

grant execute on function increment_idea_vote(uuid) to anon;

-- ---------------------------------------------------------------------------
-- synthesized_ideas: LLM-clustered output, written by the server only
-- ---------------------------------------------------------------------------
create table if not exists synthesized_ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  summary text not null,
  supporting_idea_count int not null default 0,
  tag text not null check (tag in ('strong-support', 'out-of-the-box'))
);

alter table synthesized_ideas enable row level security;

drop policy if exists "anyone can read synthesized ideas" on synthesized_ideas;
create policy "anyone can read synthesized ideas"
  on synthesized_ideas for select
  to anon
  using (true);

-- No anon insert/update/delete policy: only the service-role key (used by
-- /api/synthesize-ideas on the server) can write here — RLS is bypassed
-- automatically for the service role, so no policy is needed for it.

-- ---------------------------------------------------------------------------
-- response_stats: public aggregate view for the live stats section
-- Views run with the privileges of their owner (you, running this script),
-- so anon can read aggregates here without needing SELECT on `responses`.
-- ---------------------------------------------------------------------------
create or replace view response_stats as
select
  count(*) as total_responses,
  round(
    100.0 * count(*) filter (where hands_on_access = 'No practical access at all') / nullif(count(*), 0)
  ) as pct_no_access,
  round(
    100.0 * count(*) filter (where shadow_ai like 'Yes%') / nullif(count(*), 0)
  ) as pct_shadow_ai
from responses;

grant select on response_stats to anon;
