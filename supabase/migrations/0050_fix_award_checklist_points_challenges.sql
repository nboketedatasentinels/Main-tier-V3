-- ============================================================================
-- T4L  ·  Fix award_checklist_points challenge metrics update
-- 0050: Challenges use challenger_id / challenged_id, but award_checklist_points
-- still referenced challenger_uid. That raised ERROR 42703 and rolled back the
-- whole award - so Impact Log (and every other checklist award) never wrote to
-- points_ledger / profiles.total_points. Weekly Glance stayed at 0.
--
-- Safe to re-run (idempotent replace).
-- ============================================================================

create or replace function public.award_checklist_points(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid           uuid   := (p->>'uid')::uuid;
  v_ledger_id     text   := p->>'ledger_id';
  v_week          int    := (p->>'week')::int;
  v_month         int    := (p->>'month')::int;
  v_activity_id   text   := p->>'activity_id';
  v_points        bigint := coalesce((p->>'points')::bigint, 0);
  v_source        text   := p->>'source';
  v_claim_ref     text   := p->>'claim_ref';
  v_approval_type text   := p->>'approval_type';
  v_category      text   := p->>'category';
  v_reason        text   := p->>'reason';
  v_weekly_target bigint := coalesce((p->>'weekly_target')::bigint, 0);
  v_max_per_week  int    := nullif(p->>'max_per_week','')::int;
  v_max_per_window int   := nullif(p->>'max_per_window','')::int;
  v_max_total     int    := nullif(p->>'max_total','')::int;
  v_cooldown_weeks int   := nullif(p->>'cooldown_weeks','')::int;
  v_bypass        boolean := coalesce((p->>'bypass_limits')::boolean, false);
  v_track_window  boolean := coalesce((p->>'track_window')::boolean, false);
  v_journey_type  text   := p->>'journey_type';
  v_window_number int    := nullif(p->>'window_number','')::int;
  v_window_target bigint := coalesce((p->>'window_target')::bigint, 0);

  v_company_id    text;
  v_company_code  text;
  v_village_id    text;
  v_cluster_id    text;

  v_rowcount      int;
  v_wp_id         text;
  v_cur_points    bigint;
  v_cur_status    text;
  v_new_points    bigint;
  v_status        text;
  v_engagement    int;
  v_ratio         numeric;
  v_cur_total     bigint;
  v_new_total     bigint;
  v_level         int;
  v_last_week     int;

  v_win_id        text;
  v_win_cur_pts   bigint;
  v_win_prev      text;
  v_win_new_pts   bigint;
  v_win_status    text;
  v_win_ratio     numeric;
begin
  if not (auth.uid() = v_uid or public.is_partner_or_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from public.points_ledger where id = v_ledger_id) then
    return jsonb_build_object('awarded', false, 'reason', 'already_awarded');
  end if;

  if not v_bypass then
    if v_max_per_week is not null and (
      select count(*) from public.points_ledger
      where uid = v_uid and week_number = v_week and activity_id = v_activity_id
    ) >= v_max_per_week then
      raise exception 'Weekly activity limit reached';
    end if;

    if v_max_per_window is not null and (
      select count(*) from public.points_ledger
      where uid = v_uid and month_number = v_month and activity_id = v_activity_id
    ) >= v_max_per_window then
      raise exception 'Window activity limit reached';
    end if;

    if v_max_total is not null and (
      select count(*) from public.points_ledger
      where uid = v_uid and activity_id = v_activity_id
    ) >= v_max_total then
      raise exception 'Total activity limit reached';
    end if;

    if v_cooldown_weeks is not null and v_cooldown_weeks > 0 then
      select max(week_number) into v_last_week
        from public.points_ledger
       where uid = v_uid and activity_id = v_activity_id;
      if v_last_week is not null and (v_week - v_last_week) <= v_cooldown_weeks then
        raise exception 'Activity cooldown in effect';
      end if;
    end if;
  end if;

  select company_id, company_code, village_id, cluster_id
    into v_company_id, v_company_code, v_village_id, v_cluster_id
    from public.profiles where id = v_uid;

  insert into public.points_ledger (
    id, uid, points, source, week_number, month_number, activity_id,
    claim_ref, approval_type, category, reason,
    company_id, company_code, village_id, cluster_id, created_at
  ) values (
    v_ledger_id, v_uid, v_points, v_source, v_week, v_month, v_activity_id,
    v_claim_ref, v_approval_type, v_category, v_reason,
    v_company_id, v_company_code, v_village_id, v_cluster_id, now()
  )
  on conflict (id) do nothing;

  get diagnostics v_rowcount = row_count;
  if v_rowcount = 0 then
    return jsonb_build_object('awarded', false, 'reason', 'already_awarded');
  end if;

  select id, points_earned, status
    into v_wp_id, v_cur_points, v_cur_status
    from public.weekly_progress
   where uid = v_uid and week_number = v_week
   order by (source = 'weeklyProgress') desc nulls last
   limit 1;

  v_cur_points := coalesce(v_cur_points, 0);
  v_cur_status := coalesce(v_cur_status, 'alert');
  v_new_points := v_cur_points + v_points;

  select count(*) into v_engagement
    from public.points_ledger
   where uid = v_uid and week_number = v_week
     and (source is null or source not in ('transaction','user_points'));

  v_ratio := case when v_weekly_target > 0 then v_new_points::numeric / v_weekly_target else 0 end;
  if v_ratio >= 1 then
    v_status := case when v_cur_status = 'alert' then 'recovery' else 'on_track' end;
  elsif v_ratio >= 0.75 then
    v_status := 'warning';
  else
    v_status := 'alert';
  end if;

  if v_wp_id is not null then
    update public.weekly_progress set
      week_number = v_week, month_number = v_month, weekly_target = v_weekly_target,
      points_earned = v_new_points, engagement_count = v_engagement,
      status = v_status, updated_at = now()
    where id = v_wp_id;
  else
    insert into public.weekly_progress (
      id, uid, week_number, month_number, weekly_target,
      points_earned, engagement_count, status, source, created_at, updated_at
    ) values (
      v_uid::text || '__' || v_week::text, v_uid, v_week, v_month, v_weekly_target,
      v_new_points, v_engagement, v_status, 'weeklyProgress', now(), now()
    );
  end if;

  select total_points into v_cur_total from public.profiles where id = v_uid for update;
  v_cur_total := greatest(coalesce(v_cur_total, 0), 0);
  v_new_total := v_cur_total + v_points;
  v_level := greatest(1, (greatest(v_new_total, 0) / 500)::int + 1);
  update public.profiles set
    total_points = v_new_total,
    level = v_level,
    data = jsonb_set(coalesce(data, '{}'::jsonb), '{pointsVersion}',
                     to_jsonb(coalesce((data->>'pointsVersion')::bigint, 0) + 1), true),
    updated_at = now()
  where id = v_uid;

  if v_track_window and v_journey_type is not null and v_window_number is not null then
    select id, points_earned, status
      into v_win_id, v_win_cur_pts, v_win_prev
      from public.window_progress
     where uid = v_uid and journey_type = v_journey_type and window_number = v_window_number
     limit 1;
    v_win_cur_pts := coalesce(v_win_cur_pts, 0);
    v_win_prev := coalesce(v_win_prev, 'alert');
    v_win_new_pts := v_win_cur_pts + v_points;
    v_win_ratio := case when v_window_target > 0 then v_win_new_pts::numeric / v_window_target else 0 end;
    if v_win_ratio >= 1 then v_win_status := 'on_track';
    elsif v_win_ratio >= 0.75 then v_win_status := 'warning';
    else v_win_status := 'alert';
    end if;
    if v_win_prev = 'alert' and v_win_status in ('on_track','warning') then
      v_win_status := 'recovery';
    end if;

    if v_win_id is not null then
      update public.window_progress set
        window_target = v_window_target, points_earned = v_win_new_pts,
        status = v_win_status, previous_status = v_win_prev, updated_at = now()
      where id = v_win_id;
    else
      insert into public.window_progress (
        id, uid, journey_type, window_number, window_target,
        points_earned, status, previous_status, updated_at
      ) values (
        v_uid::text || '__' || v_journey_type || '__' || v_window_number::text,
        v_uid, v_journey_type, v_window_number, v_window_target,
        v_win_new_pts, v_win_status, v_win_prev, now()
      );
    end if;
  end if;

  -- Best-effort challenge metrics. Never fail the award if challenges schema
  -- drifts (this previously referenced non-existent challenger_uid).
  begin
    update public.challenges c
    set metrics = jsonb_set(
          coalesce(c.metrics, '{}'::jsonb)
            || jsonb_build_object(s.side, coalesce(c.metrics -> s.side, '{}'::jsonb)),
          array[s.side, 'total'],
          to_jsonb(coalesce((c.metrics #>> array[s.side, 'total'])::bigint, 0) + v_points),
          true),
        updated_at = now()
    from (
      select id,
             case
               when challenger_id = v_uid then 'challenger'
               else 'challenged'
             end as side
      from public.challenges
      where v_uid = any(participants)
        and status in ('active','pending')
        and start_date is not null and end_date is not null
        and now() >= start_date and now() <= end_date
    ) s
    where c.id = s.id;
  exception
    when others then
      raise notice 'award_checklist_points challenge metrics skipped: %', sqlerrm;
  end;

  return jsonb_build_object(
    'awarded', true,
    'previous_status', v_cur_status,
    'status', v_status,
    'points_earned', v_new_points,
    'window_tracked', (v_track_window and v_win_id is not null) or (v_track_window and v_journey_type is not null and v_window_number is not null),
    'window_previous_status', v_win_prev,
    'window_status', v_win_status,
    'window_points_earned', v_win_new_pts,
    'window_target', v_window_target
  );
end;
$function$;
