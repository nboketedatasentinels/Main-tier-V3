-- ============================================================================
-- T4L  ·  Harden mentor/coach journey + points auth via session rows
-- 0079: get_learner_journey_context was still "forbidden" when profiles.mentor_id
--       was null, which surfaced as "no active journey" and skipped +2,000.
--       Allow callers who already have a mentorship_sessions / coach booking row.
-- ============================================================================

create or replace function public.can_issue_session_attendance_points(
  p_learner uuid,
  p_activity_id text,
  p_source text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_learner public.profiles%rowtype;
  v_role text;
  v_override text;
begin
  if v_caller is null or p_learner is null or nullif(trim(coalesce(p_activity_id, '')), '') is null then
    return false;
  end if;

  select * into v_me from public.profiles where id = v_caller;
  if not found then
    return false;
  end if;

  select * into v_learner from public.profiles where id = p_learner;
  if not found then
    return false;
  end if;

  v_role := lower(trim(coalesce(v_me.role, v_me.data->>'role', '')));

  if p_activity_id = 'mentor_meetup' then
    if coalesce(p_source, '') not in ('mentor_confirmed_session', 'mentor_issued') then
      return false;
    end if;
    if v_role not in ('mentor') then
      return false;
    end if;

    if v_learner.mentor_id = v_caller then
      return true;
    end if;

    v_override := nullif(trim(coalesce(
      v_learner.data->>'mentorOverrideId',
      v_learner.data->>'mentorId',
      ''
    )), '');
    if v_override is not null and v_override = v_caller::text then
      return true;
    end if;

    if exists (
      select 1
      from public.mentorship_sessions ms
      where ms.learner_id = p_learner
        and ms.mentor_id = v_caller
        and ms.status in ('requested', 'scheduled', 'completed')
    ) then
      return true;
    end if;

    if public._peer_shares_org_scope(v_me, v_learner) then
      return true;
    end if;

    return false;
  end if;

  if p_activity_id = 'ambassador_session' then
    if coalesce(p_source, '') not in ('ambassador_attendance', 'ambassador_issued') then
      return false;
    end if;
    if v_role not in ('ambassador', 'coach') then
      return false;
    end if;

    if v_learner.ambassador_id = v_caller then
      return true;
    end if;

    v_override := nullif(trim(coalesce(
      v_learner.data->>'ambassadorOverrideId',
      v_learner.data->>'ambassadorId',
      ''
    )), '');
    if v_override is not null and v_override = v_caller::text then
      return true;
    end if;

    if exists (
      select 1
      from public.ambassador_slot_bookings b
      where b.learner_id = p_learner
        and b.ambassador_id = v_caller
        and b.status in ('booked', 'attended')
    ) then
      return true;
    end if;

    if public._peer_shares_org_scope(v_me, v_learner) then
      return true;
    end if;

    return false;
  end if;

  return false;
end;
$function$;

create or replace function public.get_learner_journey_context(p_learner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_learner public.profiles%rowtype;
  v_journey text;
  v_week int;
  v_allowed boolean := false;
begin
  if v_caller is null or p_learner_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if v_caller = p_learner_id or public.is_partner_or_admin() then
    v_allowed := true;
  elsif public.can_issue_session_attendance_points(
    p_learner_id, 'mentor_meetup', 'mentor_confirmed_session'
  ) or public.can_issue_session_attendance_points(
    p_learner_id, 'ambassador_session', 'ambassador_attendance'
  ) then
    v_allowed := true;
  elsif exists (
    select 1 from public.mentorship_sessions ms
    where ms.learner_id = p_learner_id
      and ms.mentor_id = v_caller
      and ms.status in ('requested', 'scheduled', 'completed')
  ) then
    v_allowed := true;
  elsif exists (
    select 1 from public.ambassador_slot_bookings b
    where b.learner_id = p_learner_id
      and b.ambassador_id = v_caller
      and b.status in ('booked', 'attended')
  ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_learner from public.profiles where id = p_learner_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'learner_not_found');
  end if;

  v_journey := nullif(trim(coalesce(
    v_learner.journey_type,
    v_learner.data->>'journeyType',
    ''
  )), '');

  begin
    v_week := greatest(
      1,
      coalesce(
        v_learner.current_week,
        nullif(trim(coalesce(v_learner.data->>'currentWeek', '')), '')::int,
        1
      )
    );
  exception when others then
    v_week := 1;
  end;

  if v_journey is null then
    return jsonb_build_object('ok', true, 'journeyType', null, 'weekNumber', v_week);
  end if;

  return jsonb_build_object(
    'ok', true,
    'journeyType', v_journey,
    'weekNumber', v_week
  );
end;
$function$;

comment on function public.get_learner_journey_context(uuid) is
  'Returns journeyType + weekNumber for a learner when caller is self, partner/admin, or linked mentor/coach (profile or session/booking row).';

-- Backfill missing profile mentor links from existing session rows so future
-- awards also pass the profiles.mentor_id check.
update public.profiles p
set mentor_id = s.mentor_id
from (
  select distinct on (learner_id) learner_id, mentor_id
  from public.mentorship_sessions
  where mentor_id is not null
    and learner_id is not null
    and status in ('requested', 'scheduled', 'completed')
  order by learner_id, updated_at desc nulls last, created_at desc nulls last
) s
where p.id = s.learner_id
  and p.mentor_id is null;
