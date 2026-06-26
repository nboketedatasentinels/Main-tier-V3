-- ============================================================================
-- T4L  ·  LIFT Leads (public, assessment-first funnel)
-- 0024: lift_leads table + RLS
--
-- Anonymous visitors take the public LIFT assessment, enter their contact
-- details, see their result, and land on a thank-you page - WITHOUT creating an
-- account. This table captures those leads so partner/admin can follow up.
--
-- Distinct from `lift_assessments` (which is keyed to an authenticated profile
-- and is one-per-user). A lead has no account: many rows per email are allowed,
-- and anyone (the `anon` role) may insert, but only partner/admin may read.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0011.
-- ============================================================================

create table if not exists public.lift_leads (
  id                  uuid primary key default gen_random_uuid(),
  -- Contact details captured after the questions
  first_name          text,
  last_name           text,
  email               text,
  organisation        text,
  country             text,
  gender              text,                                  -- woman | man | non_binary | prefer_not
  phone               text,
  -- Full assessment payload (mirrors lift_assessments, minus the uid/profile FK)
  intake              jsonb  not null default '{}'::jsonb,   -- Part A answers + raw contact fields
  item_scores         jsonb  not null default '{}'::jsonb,   -- { "L1": 3, ..., "T5": 2 }
  pillar_l            int    not null default 0,             -- 0..100
  pillar_i            int    not null default 0,
  pillar_f            int    not null default 0,
  pillar_t            int    not null default 0,
  lift_index          int    not null default 0,             -- 0..100
  archetype           text,                                  -- Anchor | Architect | Catalyst | Operator | Practitioner | Emerging Leader
  development_edge    text,                                  -- L | I | F | T | null (Practitioner)
  recommended_offer   text,                                  -- offer key/label
  lead_tier           text   check (lead_tier in ('A','B','C')),
  coaching_triggered  boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists lift_leads_email_idx     on public.lift_leads(email);
create index if not exists lift_leads_archetype_idx on public.lift_leads(archetype);
create index if not exists lift_leads_lead_tier_idx on public.lift_leads(lead_tier);
create index if not exists lift_leads_created_at_idx on public.lift_leads(created_at desc);

-- ── RLS: anyone may insert a lead (public funnel); only partner/admin may read ──
alter table public.lift_leads enable row level security;

-- Public, anonymous capture. No update/delete policies -> leads are immutable
-- and undeletable from the client (service-role bypasses RLS for admin tooling).
drop policy if exists lift_leads_insert on public.lift_leads;
create policy lift_leads_insert on public.lift_leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists lift_leads_select on public.lift_leads;
create policy lift_leads_select on public.lift_leads for select
  using (public.is_partner_or_admin());
