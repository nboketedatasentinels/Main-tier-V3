-- ============================================================================
-- T4L  ·  Weekly checklist state (per-user, per-week)
-- 0035: adapt the existing `checklists` table for app use + partner writes
--
-- WHY: checklist state was still written to the Firestore `checklists/{uid}_{week}`
-- document, but since the Supabase auth cutover there is no Firebase Auth
-- session, so the rule `allow create/update: if isAuthenticated()`
-- (request.auth != null) denied every write. Learners saw
-- "Sync Error: Could not save your checklist progress" on proof submission.
-- See src/utils/firestoreMigration.ts, which documents the same problem for the
-- collections that were already gated.
--
-- The `checklists` TABLE already exists (created in 0001-0010, which are not in
-- this repo) but no application code ever read or wrote it, and it holds zero
-- rows. This migration adapts it rather than creating anything new:
--   * id is text PRIMARY KEY, keeping the Firestore doc-id convention
--     `${uid}_${week_number}` so the identifier scheme is unchanged.
--   * activities switches from an ARRAY of {id, ...} to a jsonb OBJECT keyed by
--     activity id, so one activity can be patched in a single atomic statement
--     instead of read-modify-write - which raced when a learner submitted proof
--     while a partner approved a different activity. Safe to change the shape
--     because the table is empty; the service layer converts to/from the array
--     the UI works in.
--   * the insert/update policies previously allowed only `uid = auth.uid()`,
--     which blocked the approve/reject and partner-issued-points flows - those
--     patch ANOTHER learner's row. Partners/admins now get write access.
--
-- Safe to re-run (idempotent).
-- ============================================================================

-- ── Shape ───────────────────────────────────────────────────────────────────
-- Existing columns: id (text, pk), uid, week_number, activities, data, updated_at.
-- Only the activities default changes; nothing is dropped.
alter table public.checklists
  alter column activities set default '{}'::jsonb;

create index if not exists checklists_uid_week_idx
  on public.checklists(uid, week_number);

drop trigger if exists checklists_set_updated_at on public.checklists;
create trigger checklists_set_updated_at before update on public.checklists
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Learners read/write their own week. Partners and admins need BOTH read (the
-- learner progress snapshots on their dashboards) and write, because approving
-- or rejecting a submission and issuing partner points all patch the learner's
-- row via upsert_checklist_activity(). The pre-existing insert/update policies
-- only permitted `uid = auth.uid()`, so those flows would have been denied.
alter table public.checklists enable row level security;

drop policy if exists checklists_select on public.checklists;
create policy checklists_select on public.checklists for select
  using (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists checklists_insert on public.checklists;
create policy checklists_insert on public.checklists for insert
  with check (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists checklists_update on public.checklists;
create policy checklists_update on public.checklists for update
  using (uid = auth.uid() or public.is_partner_or_admin())
  with check (uid = auth.uid() or public.is_partner_or_admin());

-- ── Realtime ────────────────────────────────────────────────────────────────
-- subscribeToChecklist() listens for postgres_changes on this table, so it must
-- belong to the supabase_realtime publication or live updates never arrive (the
-- initial fetch would still work, masking the problem). The `uid=eq.` filter is
-- satisfied by the default replica identity, so no `replica identity full`.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'checklists'
     )
  then
    alter publication supabase_realtime add table public.checklists;
  end if;
end $$;

-- ── Atomic single-activity patch ────────────────────────────────────────────
-- Deep-merges p_patch into activities->p_activity_id, creating the row and/or
-- the activity entry when absent. Conflict target is the `id` primary key, built
-- from uid + week_number to match the existing identifier convention.
-- SECURITY INVOKER (the default) so the RLS policies above still decide who may
-- write which learner's row.
create or replace function public.upsert_checklist_activity(
  p_uid         uuid,
  p_week        int,
  p_activity_id text,
  p_patch       jsonb
) returns void
language sql
as $$
  insert into public.checklists as c (id, uid, week_number, activities)
  values (
    p_uid::text || '_' || p_week::text,
    p_uid,
    p_week,
    jsonb_build_object(p_activity_id, p_patch)
  )
  on conflict (id) do update
    set activities = c.activities
                     || jsonb_build_object(
                          p_activity_id,
                          coalesce(c.activities -> p_activity_id, '{}'::jsonb) || p_patch
                        ),
        uid         = coalesce(c.uid, p_uid),
        week_number = coalesce(c.week_number, p_week),
        updated_at  = now();
$$;
