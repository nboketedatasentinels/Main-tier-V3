-- ============================================================================
-- T4L  ·  Partner interventions (Supabase)
-- 0024: interventions table + RLS, and a partner/admin read policy on invitations
--
-- The partner dashboard's at-risk intervention queue was the last Firestore
-- read/write on the partner path. Auth cutover (Firebase -> Supabase) left it
-- with no Firebase session, so every `onSnapshot(interventions)` and the
-- create/update writes failed with "Missing or insufficient permissions".
--
-- This moves interventions to Supabase. One row per case; a partner/admin can
-- read, open, and update cases (RLS via the existing `is_partner_or_admin()`
-- helper). It also grants partners/admins SELECT on `invitations` so the
-- dashboard's pending-invitations widget reads from Supabase too.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER the base
-- schema and 0013 (which defines is_partner_or_admin) / 0021 (set_updated_at).
-- ============================================================================

create table if not exists public.interventions (
  id                      uuid        primary key default gen_random_uuid(),
  name                    text        not null default 'Intervention',
  target                  text,
  reason                  text,
  status                  text        not null default 'active',
  deadline                timestamptz,
  organization_code       text,
  user_id                 text,
  partner_id              text,
  opened_at               timestamptz not null default now(),
  status_changed_at       timestamptz,
  started_at              timestamptz,
  escalated_at            timestamptz,
  completed_at            timestamptz,
  escalation_reason       text,
  assigned_admin_name     text,
  extension_reason        text,
  extension_requested_at  timestamptz,
  intervention_outcome    text,
  risk_verdicts           jsonb       not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists interventions_org_code_idx on public.interventions(organization_code);
create index if not exists interventions_partner_idx  on public.interventions(partner_id);
create index if not exists interventions_user_idx      on public.interventions(user_id);

drop trigger if exists interventions_set_updated_at on public.interventions;
create trigger interventions_set_updated_at before update on public.interventions
  for each row execute function public.set_updated_at();

-- ── RLS: any partner/admin may read + manage intervention cases ──
alter table public.interventions enable row level security;

drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions for select
  using (public.is_partner_or_admin());

drop policy if exists interventions_insert on public.interventions;
create policy interventions_insert on public.interventions for insert
  with check (public.is_partner_or_admin());

drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions for update
  using (public.is_partner_or_admin()) with check (public.is_partner_or_admin());

-- ── invitations: let the partner dashboard read pending invites ──
-- The pending-invitations widget previously read Firestore. The invitations
-- table already exists (see 0018); add a partner/admin SELECT policy so the
-- Supabase read is permitted. Additive/permissive - existing policies still apply.
alter table public.invitations enable row level security;

drop policy if exists invitations_partner_select on public.invitations;
create policy invitations_partner_select on public.invitations for select
  using (public.is_partner_or_admin());
