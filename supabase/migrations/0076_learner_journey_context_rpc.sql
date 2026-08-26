-- ============================================================================
-- T4L  ·  Journey context for mentor/coach session points
-- 0076: Mentors/coaches marking attendance could not read mentee profiles
--       under RLS, so getJourneyContext returned null and +2,000 points were
--       skipped with "no active journey was found". SECURITY DEFINER RPC lets
--       an authorised mentor/coach/partner resolve journey_type + week only.
-- ============================================================================

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
begin
  if v_caller is null or p_learner_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  -- Self, partner/admin, or authorised mentor/coach for session attendance points.
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

revoke all on function public.get_learner_journey_context(uuid) from public;
grant execute on function public.get_learner_journey_context(uuid) to authenticated;

comment on function public.get_learner_journey_context(uuid) is
  'Returns journeyType + weekNumber for a learner when the caller may issue session attendance points.';
