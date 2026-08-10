-- ============================================================================
-- T4L  ·  Partner manual points adjustment (add / reduce)
-- 0052: SECURITY DEFINER RPC so partners can credit or debit learner points
--
-- WHY: Partner User Management "Adjust points" only logged an engagement
-- action and blocked non-positive amounts. Partners need a real ledger write
-- that can add or reduce points (totals never go below 0).
--
-- Authz: is_partner_or_admin() only — learners cannot call this on themselves.
-- Safe to re-run (idempotent replace).
-- ============================================================================

create or replace function public.partner_adjust_user_points(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller        uuid := auth.uid();
  v_uid           uuid := (p->>'uid')::uuid;
  v_delta         bigint := coalesce((p->>'delta')::bigint, 0);
  v_reason        text := nullif(trim(coalesce(p->>'reason', '')), '');
  v_week          int := nullif(p->>'week','')::int;
  v_month         int;
  v_weekly_target bigint := coalesce((p->>'weekly_target')::bigint, 0);

  v_company_id    text;
  v_company_code  text;
  v_village_id    text;
  v_cluster_id    text;

  v_ledger_id     text;
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
  v_applied       bigint;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not public.is_partner_or_admin() then
    raise exception 'Only partners and admins can adjust points'
      using errcode = '42501';
  end if;

  if v_uid is null then
    raise exception 'uid is required';
  end if;

  if v_delta = 0 then
    raise exception 'delta must be a non-zero number of points';
  end if;

  if v_reason is null then
    v_reason := case when v_delta > 0 then 'Partner points credit' else 'Partner points reduction' end;
  end if;

  -- Resolve week: prefer caller value, else latest weekly_progress, else week 1.
  if v_week is null or v_week < 1 then
    select week_number into v_week
      from public.weekly_progress
     where uid = v_uid
     order by week_number desc
     limit 1;
    v_week := coalesce(v_week, 1);
  end if;
  v_month := greatest(1, ceil(v_week::numeric / 4.0)::int);

  select company_id, company_code, village_id, cluster_id, total_points
    into v_company_id, v_company_code, v_village_id, v_cluster_id, v_cur_total
    from public.profiles
   where id = v_uid
   for update;

  if not found then
    raise exception 'Learner profile not found';
  end if;

  v_cur_total := greatest(coalesce(v_cur_total, 0), 0);

  -- Clamp reductions so totals never go below zero.
  if v_delta < 0 and abs(v_delta) > v_cur_total then
    v_applied := -v_cur_total;
  else
    v_applied := v_delta;
  end if;

  if v_applied = 0 then
    return jsonb_build_object(
      'adjusted', false,
      'reason', 'already_at_zero',
      'delta', 0,
      'total_points', v_cur_total
    );
  end if;

  v_ledger_id := 'manual_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.points_ledger (
    id, uid, points, source, week_number, month_number, activity_id,
    claim_ref, approval_type, category, reason,
    company_id, company_code, village_id, cluster_id, created_at
  ) values (
    v_ledger_id, v_uid, v_applied, 'partner_manual_adjustment', v_week, v_month,
    'partner_manual_adjustment',
    v_ledger_id, 'partner_issued', 'Adjustment', v_reason,
    v_company_id, v_company_code, v_village_id, v_cluster_id, now()
  );

  select id, points_earned, status
    into v_wp_id, v_cur_points, v_cur_status
    from public.weekly_progress
   where uid = v_uid and week_number = v_week
   order by (source = 'weeklyProgress') desc nulls last
   limit 1;

  v_cur_points := coalesce(v_cur_points, 0);
  v_cur_status := coalesce(v_cur_status, 'alert');
  v_new_points := greatest(0, v_cur_points + v_applied);

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
      week_number = v_week,
      month_number = v_month,
      weekly_target = case when v_weekly_target > 0 then v_weekly_target else weekly_target end,
      points_earned = v_new_points,
      engagement_count = v_engagement,
      status = v_status,
      updated_at = now()
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

  v_new_total := greatest(0, v_cur_total + v_applied);
  v_level := greatest(1, (v_new_total / 500)::int + 1);
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
  where id = v_uid;

  -- Best-effort learner notification (never fail the adjustment).
  begin
    insert into public.notifications (
      id, uid, type, notification_type, category, title, message,
      is_read, related_id, data, created_at, updated_at
    ) values (
      gen_random_uuid()::text,
      v_uid,
      'approval',
      'approval',
      'important_updates',
      case
        when v_applied > 0 then format('+%s points added', to_char(v_applied, 'FM999,999,999'))
        else format('%s points removed', to_char(abs(v_applied), 'FM999,999,999'))
      end,
      case
        when v_applied > 0 then format('Your partner added %s points. Reason: %s', v_applied, v_reason)
        else format('Your partner removed %s points. Reason: %s', abs(v_applied), v_reason)
      end,
      false,
      'partner_manual_adjustment',
      jsonb_build_object(
        'priority', 'push',
        'delta', v_applied,
        'source', 'partner_manual_adjustment',
        'reason', v_reason,
        'partnerId', v_caller::text
      ),
      now(),
      now()
    );
  exception when others then
    raise notice 'partner_adjust_user_points notify skipped: %', sqlerrm;
  end;

  return jsonb_build_object(
    'adjusted', true,
    'delta', v_applied,
    'requested_delta', v_delta,
    'total_points', v_new_total,
    'week_points', v_new_points,
    'week', v_week,
    'ledger_id', v_ledger_id,
    'reason', v_reason
  );
end;
$function$;

revoke all on function public.partner_adjust_user_points(jsonb) from public;
grant execute on function public.partner_adjust_user_points(jsonb) to authenticated;
