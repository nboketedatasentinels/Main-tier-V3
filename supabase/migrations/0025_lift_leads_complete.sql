-- ============================================================================
-- T4L  ·  LIFT Leads — capture-first (complete-later)
-- 0025: add `completed_at` + an UPDATE policy so the public funnel can finish a
--       lead it created up-front.
--
-- The funnel now captures contact details BEFORE the questions and inserts the
-- lead immediately, so the admin keeps the lead even if the visitor abandons the
-- assessment partway. When (if) they finish, the scores are written back with an
-- UPDATE. A lead locks once completed: only not-yet-completed rows are updatable
-- from the client, so finished leads stay immutable.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0024_lift_leads.
-- ============================================================================

alter table public.lift_leads
  add column if not exists completed_at timestamptz;

create index if not exists lift_leads_completed_at_idx on public.lift_leads(completed_at);

-- ── RLS: anyone may COMPLETE an incomplete lead they created (public funnel) ──
-- The row id is a random uuid handed only to the client that created it and is
-- never exposed via select (read stays partner/admin-only), so this cannot be
-- used to enumerate or tamper with other leads. Once `completed_at` is set the
-- row drops out of `using`, locking it against further client updates.
drop policy if exists lift_leads_update on public.lift_leads;
create policy lift_leads_update on public.lift_leads for update
  to anon, authenticated
  using (completed_at is null)
  with check (true);
