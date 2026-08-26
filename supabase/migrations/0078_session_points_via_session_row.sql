-- ============================================================================
-- T4L  ·  Session points when mentor_id is not stamped on the profile
-- 0078: Mentors could mark attendance (session.mentor_id) but
--       can_issue_session_attendance_points only trusted profiles.mentor_id /
--       org-scope. Unassigned mentees returned "no active journey" and skipped
--       +2,000 points even when journey_type was set (e.g. 3M).
--       Also treat an existing mentorship / coach booking row as proof.
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

  v_role := lower(trim(coalesce(v_me.role, '')));

  -- Mentor Meet Up (2,000) — mentor only, attendance source only.
  if p_activity_id = 'mentor_meetup' then
    if coalesce(p_source, '') not in ('mentor_confirmed_session', 'mentor_issued') then
      return false;
    end if;
    if v_role <> 'mentor' then
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

    -- Session row proves this mentor is working with the learner (even when
    -- profiles.mentor_id was never stamped).
    if exists (
      select 1
      from public.mentorship_sessions ms
      where ms.learner_id = p_learner
        and ms.mentor_id = v_caller
        and ms.status in ('requested', 'scheduled', 'completed')
    ) then
      return true;
    end if;

    -- Org mentor covering learners without a stamped mentor_id.
    if public._peer_shares_org_scope(v_me, v_learner) then
      return true;
    end if;

    return false;
  end if;

  -- Coach / Ambassador Session (2,000) — coach only, attendance source only.
  if p_activity_id = 'ambassador_session' then
    if coalesce(p_source, '') not in ('ambassador_attendance', 'ambassador_issued') then
      return false;
    end if;
    if v_role <> 'ambassador' then
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

comment on function public.can_issue_session_attendance_points(uuid, text, text) is
  'True when the caller may award mentor_meetup / ambassador_session attendance points for the learner (profile link, session/booking row, or shared org).';
