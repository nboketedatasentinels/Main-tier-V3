-- ============================================================================
-- T4L  ·  LIFT Assessment History (longitudinal retakes)
-- 0026: append-only lift_assessment_history table + RLS
--
-- `lift_assessments` keeps ONE row per user (the current snapshot, upserted on
-- each take), so it cannot show change over time. This table is the append-only
-- log: every take is its own immutable, timestamped row keyed by uid. With it we
-- can compare a member's take #1 vs a retake 90 days after the intervention and
-- show the improvement (LIFT index + per-pillar deltas).
--
-- Mirrors lift_assessments columns, plus `taken_at`. No update/delete policies
-- -> history rows are immutable from the client.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0011.
-- ============================================================================

create table if not exists public.lift_assessment_history (
  id                  uuid primary key default gen_random_uuid(),
  uid                 uuid not null references public.profiles(id) on delete cascade,
  intake              jsonb  not null default '{}'::jsonb,
  item_scores         jsonb  not null default '{}'::jsonb,
  pillar_l            int    not null default 0,             -- 0..100
  pillar_i            int    not null default 0,
  pillar_f            int    not null default 0,
  pillar_t            int    not null default 0,
  lift_index          int    not null default 0,             -- 0..100
  archetype           text,
  development_edge    text,                                  -- L | I | F | T | null
  recommended_offer   text,
  lead_tier           text   check (lead_tier in ('A','B','C')),
  coaching_triggered  boolean not null default false,
  taken_at            timestamptz not null default now()
);

create index if not exists lift_history_uid_taken_idx on public.lift_assessment_history(uid, taken_at desc);
create index if not exists lift_history_taken_at_idx  on public.lift_assessment_history(taken_at desc);

-- ── RLS: owner reads own takes; partner/admin read all. Insert own only. ──
-- No update/delete -> the history log is immutable from the client.
alter table public.lift_assessment_history enable row level security;

drop policy if exists lift_history_select on public.lift_assessment_history;
create policy lift_history_select on public.lift_assessment_history for select
  using (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists lift_history_insert on public.lift_assessment_history;
create policy lift_history_insert on public.lift_assessment_history for insert
  with check (uid = auth.uid());
