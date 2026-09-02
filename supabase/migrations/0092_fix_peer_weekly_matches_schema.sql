-- ============================================================================
-- T4L  ·  Fix peer weekly matches missing updated_at
-- 0092: peer_weekly_matches already existed as a legacy table (text id,
-- no updated_at). Migration 0087 used CREATE TABLE IF NOT EXISTS so the new
-- schema never applied. ensure_my_current_peer_match then failed with:
--   column "updated_at" of relation "peer_weekly_matches" does not exist
-- which the Peer Connect UI surfaces as "We could not load your peer match".
--
-- Safe to re-run (idempotent).
-- ============================================================================

alter table public.peer_weekly_matches
  add column if not exists updated_at timestamptz not null default now();

alter table public.peer_weekly_matches
  add column if not exists last_refresh_at timestamptz not null default now();

alter table public.peer_weekly_matches
  add column if not exists refresh_count integer not null default 0;

alter table public.peer_weekly_matches
  add column if not exists automated_match boolean not null default true;

alter table public.peer_weekly_matches
  add column if not exists match_reason text;

alter table public.peer_weekly_matches
  add column if not exists match_status text not null default 'new';

alter table public.peer_weekly_matches
  add column if not exists match_refresh_preference text not null default 'weekly';

alter table public.peer_weekly_matches
  add column if not exists preferred_match_day integer not null default 1;

-- Ensure inserts that omit id still work when id is text (legacy) or uuid.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'peer_weekly_matches'
      and column_name = 'id'
      and data_type = 'text'
  ) then
    execute $sql$
      alter table public.peer_weekly_matches
        alter column id set default gen_random_uuid()::text
    $sql$;
  end if;
end $$;

-- Unique (uid, match_key) required by ON CONFLICT in match RPCs.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'peer_weekly_matches_uid_key_unique'
      and conrelid = 'public.peer_weekly_matches'::regclass
  ) then
    alter table public.peer_weekly_matches
      add constraint peer_weekly_matches_uid_key_unique unique (uid, match_key);
  end if;
exception when others then
  raise notice 'peer_weekly_matches_uid_key_unique skipped: %', sqlerrm;
end $$;
