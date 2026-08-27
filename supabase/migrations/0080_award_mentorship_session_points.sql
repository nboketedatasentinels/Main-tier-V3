-- ============================================================================
-- T4L  ·  Atomic mentor session points award
-- 0080: Client multi-step award kept failing. Award +2,000 in one SECURITY
--       DEFINER RPC keyed to mentorship_sessions.mentor_id = auth.uid().
-- ============================================================================

create or replace function public.award_mentorship_session_points(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_session public.mentorship_sessions%rowtype;
  v_learner public.profiles%rowtype;
  v_role text;
  v_journey text;
  v_week int;
  v_month int;
  v_points bigint := 2000;
  v_claim_ref text;
  v_ledger_id text;
  v_max_total int;
  v_rowcount int;
  v_cur_total bigint;
  v_new_total bigint;
  v_level int;
  v_wp_id text;
  v_cur_points bigint;
  v_new_points bigint;
  v_company_id text;
  v_company_code text;
  v_village_id text;
  v_cluster_id text;
begin
  if v_caller is null or p_session_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_session from public.mentorship_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_not_found');
  end if;

  select lower(trim(coalesce(role, data->>'role', ''))) into v_role
  from public.profiles where id = v_caller;

  if not (
    public.is_partner_or_admin()
    or (v_session.mentor_id = v_caller and coalesce(v_role, '') = 'mentor')
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_session.status not in ('scheduled', 'completed') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_session.status);
  end if;

  if v_session.status = 'scheduled' then
    update public.mentorship_sessions
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where id = p_session_id
    returning * into v_session;
  end if;

  if coalesce(v_session.points_awarded, false) then
    return jsonb_build_object(
      'ok', true,
      'awarded', true,
      'reason', 'already_awarded',
      'points', v_points
    );
  end if;

  select * into v_learner from public.profiles where id = v_session.learner_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'learner_not_found');
  end if;

  if v_learner.mentor_id is null then
    update public.profiles
    set mentor_id = v_session.mentor_id, updated_at = now()
    where id = v_session.learner_id and mentor_id is null;
  end if;

  v_journey := nullif(trim(coalesce(
    v_learner.journey_type,
    v_learner.data->>'journeyType',
    ''
  )), '');

  if v_journey is null then
    return jsonb_build_object('ok', false, 'error', 'missing_journey');
  end if;

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

  v_month := greatest(1, ceil(v_week::numeric / 2.0)::int);
  v_claim_ref := 'mentor_session:' || p_session_id::text;
  v_ledger_id := v_session.learner_id::text || '__w' || v_week::text || '__mentor_meetup__' ||
    regexp_replace(v_claim_ref, '[^a-zA-Z0-9_.-]', '_', 'g');

  v_max_total := case v_journey
    when '6M' then 6
    when '9M' then 9
    when '3M' then 3
    else 3
  end;

  if (
    select count(*) from public.points_ledger
    where uid = v_session.learner_id and activity_id = 'mentor_meetup'
  ) >= v_max_total then
    return jsonb_build_object('ok', false, 'error', 'limit_exceeded', 'max_total', v_max_total);
  end if;

  if exists (select 1 from public.points_ledger where id = v_ledger_id) then
    update public.mentorship_sessions
    set points_awarded = true,
        points_awarded_at = coalesce(points_awarded_at, now()),
        updated_at = now()
    where id = p_session_id;
    return jsonb_build_object(
      'ok', true,
      'awarded', true,
      'reason', 'already_awarded',
      'points', v_points
    );
  end if;

  select company_id::text, company_code, village_id::text, cluster_id::text
    into v_company_id, v_company_code, v_village_id, v_cluster_id
    from public.profiles where id = v_session.learner_id;

  insert into public.points_ledger (
    id, uid, points, source, week_number, month_number, activity_id,
    claim_ref, approval_type, category, reason,
    company_id, company_code, village_id, cluster_id, created_at
  ) values (
    v_ledger_id, v_session.learner_id, v_points, 'mentor_confirmed_session',
    v_week, v_month, 'mentor_meetup',
    v_claim_ref, 'mentor_issued', 'Leadership', 'Mentor Meet Up',
    v_company_id, v_company_code, v_village_id, v_cluster_id, now()
  )
  on conflict (id) do nothing;

  get diagnostics v_rowcount = row_count;
  if v_rowcount = 0 then
    update public.mentorship_sessions
    set points_awarded = true,
        points_awarded_at = coalesce(points_awarded_at, now()),
        updated_at = now()
    where id = p_session_id;
    return jsonb_build_object(
      'ok', true,
      'awarded', true,
      'reason', 'already_awarded',
      'points', v_points
    );
  end if;

  select id, points_earned
    into v_wp_id, v_cur_points
    from public.weekly_progress
   where uid = v_session.learner_id and week_number = v_week
   order by (source = 'weeklyProgress') desc nulls last
   limit 1;

  v_cur_points := coalesce(v_cur_points, 0);
  v_new_points := v_cur_points + v_points;

  if v_wp_id is not null then
    update public.weekly_progress set
      points_earned = v_new_points,
      updated_at = now()
    where id = v_wp_id;
  else
    insert into public.weekly_progress (
      id, uid, week_number, month_number, weekly_target,
      points_earned, engagement_count, status, source, created_at, updated_at
    ) values (
      v_session.learner_id::text || '__' || v_week::text,
      v_session.learner_id, v_week, v_month, 0,
      v_new_points, 1, 'alert', 'weeklyProgress', now(), now()
    );
  end if;

  select total_points into v_cur_total
    from public.profiles where id = v_session.learner_id for update;
  v_cur_total := greatest(coalesce(v_cur_total, 0), 0);
  v_new_total := v_cur_total + v_points;
  v_level := greatest(1, (greatest(v_new_total, 0) / 500)::int + 1);
  update public.profiles set
    total_points = v_new_total,
    level = v_level,
    data = jsonb_set(
      coalesce(data, '{}'::jsonb),
      '{pointsVersion}',
      to_jsonb(coalesce((data->>'pointsVersion')::bigint, 0) + 1),
      true
    ),
    updated_at = now()
  where id = v_session.learner_id;

  update public.mentorship_sessions
  set points_awarded = true,
      points_awarded_at = now(),
      updated_at = now()
  where id = p_session_id;

  -- Checklist mark (definer write; ignore failures).
  begin
    insert into public.checklists as c (id, uid, week_number, activities)
    values (
      v_session.learner_id::text || '_' || v_week::text,
      v_session.learner_id,
      v_week,
      jsonb_build_object(
        'mentor_meetup',
        jsonb_build_object('status', 'completed', 'hasInteracted', true)
      )
    )
    on conflict (id) do update
      set activities = c.activities || jsonb_build_object(
            'mentor_meetup',
            coalesce(c.activities -> 'mentor_meetup', '{}'::jsonb)
              || jsonb_build_object('status', 'completed', 'hasInteracted', true)
          ),
          updated_at = now();
  exception when others then
    raise notice 'checklist upsert skipped: %', sqlerrm;
  end;

  return jsonb_build_object(
    'ok', true,
    'awarded', true,
    'points', v_points,
    'weekNumber', v_week,
    'journeyType', v_journey,
    'totalPoints', v_new_total
  );
end;
$function$;

revoke all on function public.award_mentorship_session_points(uuid) from public;
grant execute on function public.award_mentorship_session_points(uuid) to authenticated;

comment on function public.award_mentorship_session_points(uuid) is
  'Marks mentorship session complete if needed and awards +2000 mentor_meetup points atomically.';
