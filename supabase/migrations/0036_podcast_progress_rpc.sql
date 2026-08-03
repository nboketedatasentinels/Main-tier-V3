-- ============================================================================
-- T4L  ·  Podcast quiz progress — reliable write path
-- 0036: grants + realtime + SECURITY DEFINER upsert RPC
--
-- Learners were seeing "Could not save your quiz" / "Nice work!" with
-- "0 of 3 passed" still showing. Common causes after the auth cutover:
--   * client upsert blocked by RLS / missing table grants
--   * table not on supabase_realtime, so a successful write never refreshed UI
--
-- This migration makes writes go through a SECURITY DEFINER RPC (same pattern
-- as award_checklist_points / claim_organization_code): auth.uid() must match
-- the learner, then the row is upserted atomically. Also wires grants +
-- realtime so the checklist panel updates without a full reload.
--
-- Safe to re-run (idempotent).
-- ============================================================================

-- Ensure base table exists (0021) even if that migration was skipped in an env.
create table if not exists public.podcast_progress (
  uid                uuid        not null references public.profiles(id) on delete cascade,
  podcast_id         text        not null,
  watched            boolean     not null default false,
  watched_at         timestamptz,
  passed             boolean     not null default false,
  best_score         int         not null default 0,
  attempts           int         not null default 0,
  points_awarded_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (uid, podcast_id)
);

create index if not exists podcast_progress_uid_idx on public.podcast_progress(uid);

-- updated_at trigger (no-op if set_updated_at is missing in a broken env)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists podcast_progress_set_updated_at on public.podcast_progress;
    create trigger podcast_progress_set_updated_at
      before update on public.podcast_progress
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.podcast_progress enable row level security;

drop policy if exists podcast_progress_select on public.podcast_progress;
create policy podcast_progress_select on public.podcast_progress for select
  using (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists podcast_progress_insert on public.podcast_progress;
create policy podcast_progress_insert on public.podcast_progress for insert
  with check (uid = auth.uid());

drop policy if exists podcast_progress_update on public.podcast_progress;
create policy podcast_progress_update on public.podcast_progress for update
  using (uid = auth.uid()) with check (uid = auth.uid());

grant select, insert, update on public.podcast_progress to authenticated;
grant select on public.podcast_progress to anon;

-- Realtime so subscribeToPodcastProgress() refreshes after a quiz save.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'podcast_progress'
     )
  then
    alter publication supabase_realtime add table public.podcast_progress;
  end if;
end $$;

-- Atomic quiz / watch write. Auth-gated; never clears a prior pass.
create or replace function public.record_podcast_progress(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_target         uuid;
  v_podcast_id     text;
  v_watched        boolean;
  v_passed         boolean;
  v_score          int;
  v_award_points   boolean;
  v_row            public.podcast_progress%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_target := nullif(p->>'uid', '')::uuid;
  if v_target is null or v_target <> v_uid then
    raise exception 'forbidden';
  end if;

  v_podcast_id := nullif(trim(coalesce(p->>'podcast_id', '')), '');
  if v_podcast_id is null then
    raise exception 'podcast_id_required';
  end if;

  v_watched := coalesce((p->>'watched')::boolean, false);
  v_passed := coalesce((p->>'passed')::boolean, false);
  v_score := greatest(0, coalesce((p->>'score')::int, 0));
  v_award_points := coalesce((p->>'award_points')::boolean, false);

  insert into public.podcast_progress as pp (
    uid,
    podcast_id,
    watched,
    watched_at,
    passed,
    best_score,
    attempts,
    points_awarded_at
  )
  values (
    v_uid,
    v_podcast_id,
    v_watched,
    case when v_watched then now() else null end,
    v_passed,
    v_score,
    case when p ? 'score' or p ? 'passed' then 1 else 0 end,
    case when v_award_points and v_passed then now() else null end
  )
  on conflict (uid, podcast_id) do update
    set watched = pp.watched or excluded.watched,
        watched_at = case
          when (pp.watched or excluded.watched) and pp.watched_at is null
            then coalesce(excluded.watched_at, now())
          else pp.watched_at
        end,
        -- Once passed, stay passed (retries must not wipe completion).
        passed = pp.passed or excluded.passed,
        best_score = greatest(pp.best_score, excluded.best_score),
        attempts = case
          when p ? 'score' or p ? 'passed' then pp.attempts + 1
          else pp.attempts
        end,
        points_awarded_at = coalesce(
          pp.points_awarded_at,
          case when v_award_points and (pp.passed or excluded.passed) then now() else null end
        ),
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'podcast_id', v_row.podcast_id,
    'watched', v_row.watched,
    'passed', v_row.passed,
    'best_score', v_row.best_score,
    'attempts', v_row.attempts,
    'points_awarded_at', v_row.points_awarded_at
  );
end;
$$;

revoke all on function public.record_podcast_progress(jsonb) from public;
grant execute on function public.record_podcast_progress(jsonb) to authenticated;
