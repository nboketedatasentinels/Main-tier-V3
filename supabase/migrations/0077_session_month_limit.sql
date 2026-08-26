-- ============================================================================
-- T4L  ·  One mentor / coach meeting per calendar month
-- 0077: Learners may have at most 1 active mentor meet-up and 1 active coach
--       session per calendar month. SECURITY DEFINER so leadership can count
--       even when RLS would hide rows from another mentor/coach.
-- ============================================================================

create or replace function public.learner_has_session_in_month(
  p_kind text,
  p_learner_id uuid,
  p_session_at timestamptz,
  p_exclude_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_found boolean := false;
begin
  if v_caller is null or p_learner_id is null or p_session_at is null then
    return false;
  end if;

  if p_kind not in ('mentor', 'coach') then
    raise exception 'invalid kind';
  end if;

  -- Self, partner/admin, or authorised mentor/coach for this learner.
  if not (
    v_caller = p_learner_id
    or public.is_partner_or_admin()
    or public.can_issue_session_attendance_points(
      p_learner_id, 'mentor_meetup', 'mentor_confirmed_session'
    )
    or public.can_issue_session_attendance_points(
      p_learner_id, 'ambassador_session', 'ambassador_attendance'
    )
  ) then
    raise exception 'forbidden';
  end if;

  v_month_start := date_trunc('month', p_session_at at time zone 'UTC');
  v_month_end := v_month_start + interval '1 month';

  if p_kind = 'mentor' then
    select exists (
      select 1
      from public.mentorship_sessions ms
      where ms.learner_id = p_learner_id
        and ms.status in ('requested', 'scheduled', 'completed')
        and (p_exclude_id is null or ms.id <> p_exclude_id)
        and coalesce(ms.scheduled_at, ms.proposed_at, ms.created_at) >= v_month_start
        and coalesce(ms.scheduled_at, ms.proposed_at, ms.created_at) < v_month_end
    ) into v_found;
  else
    select exists (
      select 1
      from public.ambassador_slot_bookings b
      join public.ambassador_slots s on s.id = b.slot_id
      where b.learner_id = p_learner_id
        and b.status in ('booked', 'attended')
        and (p_exclude_id is null or b.id <> p_exclude_id)
        and s.scheduled_at >= v_month_start
        and s.scheduled_at < v_month_end
    ) into v_found;
  end if;

  return coalesce(v_found, false);
end;
$function$;

revoke all on function public.learner_has_session_in_month(text, uuid, timestamptz, uuid) from public;
grant execute on function public.learner_has_session_in_month(text, uuid, timestamptz, uuid) to authenticated;

comment on function public.learner_has_session_in_month(text, uuid, timestamptz, uuid) is
  'True when the learner already has an active mentor or coach meeting in the UTC calendar month of p_session_at.';
