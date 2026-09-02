-- ============================================================================
-- T4L  ·  Peer weekly matches (Supabase)
-- 0087: Peer Connect must assign a match for the CURRENT 7-day window as soon
-- as a learner opens the page — not only when the old Monday Firestore cron runs.
-- Auth is Supabase; Firestore writes fail without Firebase Auth.
--
-- Safe to re-run (idempotent).
-- ============================================================================

create table if not exists public.peer_weekly_matches (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references public.profiles(id) on delete cascade,
  peer_uid uuid not null references public.profiles(id) on delete cascade,
  match_key text not null,
  match_reason text,
  match_status text not null default 'new'
    check (match_status in ('new', 'viewed', 'contacted', 'completed', 'expired')),
  match_refresh_preference text not null default 'weekly',
  preferred_match_day integer not null default 1
    check (preferred_match_day between 0 and 6),
  refresh_count integer not null default 0,
  automated_match boolean not null default true,
  created_at timestamptz not null default now(),
  last_refresh_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint peer_weekly_matches_uid_peer_distinct check (uid <> peer_uid),
  constraint peer_weekly_matches_uid_key_unique unique (uid, match_key)
);

create index if not exists peer_weekly_matches_uid_idx
  on public.peer_weekly_matches (uid, created_at desc);

create index if not exists peer_weekly_matches_peer_uid_idx
  on public.peer_weekly_matches (peer_uid);

create index if not exists peer_weekly_matches_match_key_idx
  on public.peer_weekly_matches (match_key);

alter table public.peer_weekly_matches enable row level security;

drop policy if exists peer_weekly_matches_select_own on public.peer_weekly_matches;
create policy peer_weekly_matches_select_own
  on public.peer_weekly_matches
  for select
  to authenticated
  using (uid = auth.uid() or peer_uid = auth.uid());

drop policy if exists peer_weekly_matches_update_own on public.peer_weekly_matches;
create policy peer_weekly_matches_update_own
  on public.peer_weekly_matches
  for update
  to authenticated
  using (uid = auth.uid())
  with check (uid = auth.uid());

-- No direct inserts from clients; creation goes through ensure RPC.

create or replace function public._peer_allows_matching(p_profile public.profiles)
returns boolean
language sql
stable
as $$
  select coalesce((p_profile.data->'privacySettings'->>'allowPeerMatching')::boolean, true)
    and coalesce(
      nullif(lower(trim(coalesce(p_profile.data->>'matchRefreshPreference', 'weekly'))), ''),
      'weekly'
    ) <> 'disabled'
    and public._is_learner_role(p_profile.role)
    and nullif(trim(coalesce(p_profile.email, '')), '') is not null
    and coalesce(nullif(trim(coalesce(p_profile.data->>'mergedInto', '')), ''), '') = '';
$$;

create or replace function public.ensure_my_current_peer_match(
  p_match_key text,
  p_refresh_preference text default 'weekly',
  p_preferred_match_day integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_existing public.peer_weekly_matches%rowtype;
  v_peer_id uuid;
  v_pref text := lower(trim(coalesce(nullif(p_refresh_preference, ''), 'weekly')));
  v_day integer := coalesce(p_preferred_match_day, 1);
  v_key text := nullif(trim(coalesce(p_match_key, '')), '');
  v_created boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'missing_match_key');
  end if;

  if v_pref = 'disabled' then
    return jsonb_build_object('ok', false, 'error', 'matching_disabled');
  end if;

  if v_day < 0 or v_day > 6 then
    v_day := 1;
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if public._is_free_non_org_learner(v_me) then
    perform public.ensure_free_user_village();
    select * into v_me from public.profiles where id = v_uid;
  end if;

  if not public._peer_allows_matching(v_me) then
    return jsonb_build_object('ok', false, 'error', 'matching_disabled');
  end if;

  select * into v_existing
  from public.peer_weekly_matches
  where uid = v_uid and match_key = v_key
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'match', jsonb_build_object(
        'id', v_existing.id,
        'uid', v_existing.uid,
        'peer_uid', v_existing.peer_uid,
        'match_key', v_existing.match_key,
        'match_reason', v_existing.match_reason,
        'match_status', v_existing.match_status,
        'match_refresh_preference', v_existing.match_refresh_preference,
        'preferred_match_day', v_existing.preferred_match_day,
        'refresh_count', v_existing.refresh_count,
        'automated_match', v_existing.automated_match,
        'created_at', v_existing.created_at,
        'last_refresh_at', v_existing.last_refresh_at
      )
    );
  end if;

  -- Pick a random eligible peer in the same org/village scope.
  select p.id
    into v_peer_id
  from public.profiles p
  where p.id <> v_uid
    and public._peer_allows_matching(p)
    and public._peer_shares_org_scope(v_me, p)
  order by random()
  limit 1;

  if v_peer_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_eligible_peers');
  end if;

  insert into public.peer_weekly_matches (
    uid,
    peer_uid,
    match_key,
    match_reason,
    match_status,
    match_refresh_preference,
    preferred_match_day,
    refresh_count,
    automated_match,
    created_at,
    last_refresh_at,
    updated_at
  ) values (
    v_uid,
    v_peer_id,
    v_key,
    'Automatic match for this week',
    'new',
    v_pref,
    v_day,
    0,
    true,
    now(),
    now(),
    now()
  )
  returning * into v_existing;

  v_created := true;

  -- Reciprocal row so the peer also sees this pairing for the same window key.
  insert into public.peer_weekly_matches (
    uid,
    peer_uid,
    match_key,
    match_reason,
    match_status,
    match_refresh_preference,
    preferred_match_day,
    refresh_count,
    automated_match,
    created_at,
    last_refresh_at,
    updated_at
  ) values (
    v_peer_id,
    v_uid,
    v_key,
    'Automatic match for this week',
    'new',
    v_pref,
    v_day,
    0,
    true,
    now(),
    now(),
    now()
  )
  on conflict (uid, match_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'match', jsonb_build_object(
      'id', v_existing.id,
      'uid', v_existing.uid,
      'peer_uid', v_existing.peer_uid,
      'match_key', v_existing.match_key,
      'match_reason', v_existing.match_reason,
      'match_status', v_existing.match_status,
      'match_refresh_preference', v_existing.match_refresh_preference,
      'preferred_match_day', v_existing.preferred_match_day,
      'refresh_count', v_existing.refresh_count,
      'automated_match', v_existing.automated_match,
      'created_at', v_existing.created_at,
      'last_refresh_at', v_existing.last_refresh_at
    )
  );
exception
  when unique_violation then
    select * into v_existing
    from public.peer_weekly_matches
    where uid = v_uid and match_key = v_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'created', false,
        'match', jsonb_build_object(
          'id', v_existing.id,
          'uid', v_existing.uid,
          'peer_uid', v_existing.peer_uid,
          'match_key', v_existing.match_key,
          'match_reason', v_existing.match_reason,
          'match_status', v_existing.match_status,
          'match_refresh_preference', v_existing.match_refresh_preference,
          'preferred_match_day', v_existing.preferred_match_day,
          'refresh_count', v_existing.refresh_count,
          'automated_match', v_existing.automated_match,
          'created_at', v_existing.created_at,
          'last_refresh_at', v_existing.last_refresh_at
        )
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'unique_violation');
end;
$$;

create or replace function public.replace_my_peer_match(
  p_match_key text,
  p_unavailable_peer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_existing public.peer_weekly_matches%rowtype;
  v_peer_id uuid;
  v_key text := nullif(trim(coalesce(p_match_key, '')), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'missing_match_key');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  select * into v_existing
  from public.peer_weekly_matches
  where uid = v_uid and match_key = v_key
  limit 1;

  if not found then
    return public.ensure_my_current_peer_match(v_key, 'weekly', 1);
  end if;

  select p.id
    into v_peer_id
  from public.profiles p
  where p.id <> v_uid
    and p.id <> p_unavailable_peer_id
    and public._peer_allows_matching(p)
    and public._peer_shares_org_scope(v_me, p)
  order by random()
  limit 1;

  if v_peer_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_eligible_peers');
  end if;

  update public.peer_weekly_matches
  set peer_uid = v_peer_id,
      match_reason = 'Automatic replacement (peer unavailable)',
      match_status = 'new',
      refresh_count = coalesce(refresh_count, 0) + 1,
      last_refresh_at = now(),
      updated_at = now()
  where id = v_existing.id
  returning * into v_existing;

  return jsonb_build_object(
    'ok', true,
    'created', false,
    'match', jsonb_build_object(
      'id', v_existing.id,
      'uid', v_existing.uid,
      'peer_uid', v_existing.peer_uid,
      'match_key', v_existing.match_key,
      'match_reason', v_existing.match_reason,
      'match_status', v_existing.match_status,
      'match_refresh_preference', v_existing.match_refresh_preference,
      'preferred_match_day', v_existing.preferred_match_day,
      'refresh_count', v_existing.refresh_count,
      'automated_match', v_existing.automated_match,
      'created_at', v_existing.created_at,
      'last_refresh_at', v_existing.last_refresh_at
    )
  );
end;
$$;

revoke all on function public._peer_allows_matching(public.profiles) from public;
revoke all on function public.ensure_my_current_peer_match(text, text, integer) from public;
revoke all on function public.replace_my_peer_match(text, uuid) from public;

grant execute on function public.ensure_my_current_peer_match(text, text, integer) to authenticated;
grant execute on function public.replace_my_peer_match(text, uuid) to authenticated;
