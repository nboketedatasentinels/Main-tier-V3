-- ============================================================================
-- T4L  ·  Partner activity issuing (atomic DB write)
-- 0048: Persist partner-issued marks in one SECURITY DEFINER RPC
--
-- WHY: Partner Activity Issuing must always land in Postgres:
--   * points_ledger (+ weekly_progress / profile totals via award_checklist_points)
--   * checklists (activity marked completed / issuedByPartner)
--   * point_verifications (approve pending learner confirmations, or audit row)
--   * notifications (learner push)
--
-- Client-side multi-step writes could award points then fail on a later RLS
-- insert (or a leftover Firestore audit), leaving partners unsure whether
-- marks were saved. This RPC does the whole issue in one place and raises on
-- any critical failure.
--
-- Safe to re-run (idempotent).
-- ============================================================================

create or replace function public.partner_issue_activity(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller        uuid := auth.uid();
  v_learner       uuid;
  v_week          int;
  v_activity_id   text;
  v_points        int;
  v_title         text;
  v_partner_name  text;
  v_org           text;
  v_award_payload jsonb;
  v_award         jsonb;
  v_awarded       boolean := false;
  v_already       boolean := false;
  v_patch         jsonb;
  v_checklist_id  text;
  v_pending_count int := 0;
  v_now           timestamptz := now();
  v_notify_title  text;
  v_notify_body   text;
begin
  if v_caller is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.is_partner_or_admin() then
    raise exception 'Only partners or admins can issue activity marks'
      using errcode = '42501';
  end if;

  v_learner := nullif(p->>'learner_id', '')::uuid;
  v_week := (p->>'week')::int;
  v_activity_id := nullif(p->>'activity_id', '');
  v_points := coalesce((p->>'points')::int, 0);
  v_title := coalesce(nullif(p->>'activity_title', ''), v_activity_id);
  v_partner_name := nullif(p->>'partner_name', '');
  v_award_payload := coalesce(p->'award', '{}'::jsonb);

  if v_learner is null or v_week is null or v_activity_id is null then
    raise exception 'learner_id, week, and activity_id are required';
  end if;

  if v_week < 1 or v_week > 52 then
    raise exception 'week must be between 1 and 52';
  end if;

  select organization_id
    into v_org
    from public.profiles
   where id = v_learner;

  if not found then
    raise exception 'Learner profile not found';
  end if;

  -- 1) Points ledger (skip zero-point deliverables such as Practical)
  if v_points > 0 then
    if coalesce(v_award_payload->>'uid', '') = '' then
      v_award_payload := v_award_payload || jsonb_build_object('uid', v_learner);
    end if;
    if coalesce(v_award_payload->>'activity_id', '') = '' then
      v_award_payload := v_award_payload || jsonb_build_object('activity_id', v_activity_id);
    end if;
    if coalesce(v_award_payload->>'week', '') = '' then
      v_award_payload := v_award_payload || jsonb_build_object('week', v_week);
    end if;
    if coalesce(v_award_payload->>'points', '') = '' then
      v_award_payload := v_award_payload || jsonb_build_object('points', v_points);
    end if;
    if coalesce(v_award_payload->>'source', '') = '' then
      v_award_payload := v_award_payload || jsonb_build_object('source', 'partner_issued');
    end if;
    if v_award_payload->>'bypass_limits' is null then
      v_award_payload := v_award_payload || jsonb_build_object('bypass_limits', true);
    end if;

    v_award := public.award_checklist_points(v_award_payload);
    v_awarded := coalesce((v_award->>'awarded')::boolean, false);

    if not v_awarded then
      if lower(coalesce(v_award->>'reason', '')) like '%already%' then
        v_already := true;
      else
        raise exception '%',
          coalesce(
            nullif(v_award->>'message', ''),
            nullif(v_award->>'reason', ''),
            format('%s could not be awarded for week %s', v_title, v_week)
          );
      end if;
    end if;
  end if;

  -- 2) Checklist row (always required so the learner UI shows completed)
  v_patch := jsonb_build_object(
    'status', 'completed',
    'hasInteracted', true,
    'issuedByPartner', true,
    'issuedBy', v_caller::text,
    'issuedAt', v_now,
    'rejectionReason', null
  );
  v_checklist_id := v_learner::text || '_' || v_week::text;

  insert into public.checklists as c (id, uid, week_number, activities, updated_at)
  values (
    v_checklist_id,
    v_learner,
    v_week,
    jsonb_build_object(v_activity_id, v_patch),
    v_now
  )
  on conflict (id) do update
    set activities = c.activities
                     || jsonb_build_object(
                          v_activity_id,
                          coalesce(c.activities -> v_activity_id, '{}'::jsonb) || v_patch
                        ),
        uid         = coalesce(c.uid, v_learner),
        week_number = coalesce(c.week_number, v_week),
        updated_at  = v_now;

  -- 3) point_verifications: approve pending learner confirmations, else audit insert
  update public.point_verifications
     set status = 'approved',
         approved_by = v_caller::text,
         approved_by_name = v_partner_name,
         approved_at = v_now
   where uid = v_learner
     and week = v_week
     and activity_id = v_activity_id
     and status = 'pending';

  get diagnostics v_pending_count = row_count;

  if v_pending_count = 0
     and not exists (
       select 1
         from public.point_verifications
        where uid = v_learner
          and week = v_week
          and activity_id = v_activity_id
     )
  then
    insert into public.point_verifications (
      id,
      uid,
      organization_id,
      week,
      activity_id,
      activity_title,
      points,
      proof_url,
      notes,
      status,
      approved_by,
      approved_by_name,
      approved_at,
      created_at
    ) values (
      gen_random_uuid()::text,
      v_learner,
      v_org,
      v_week,
      v_activity_id,
      v_title,
      v_points,
      null,
      'Issued directly by partner',
      'approved',
      v_caller::text,
      v_partner_name,
      v_now,
      v_now
    );
  end if;

  -- 4) Learner notification (non-fatal relative to marks already saved)
  if not v_already then
    begin
      if v_points > 0 then
        v_notify_title := format('🎉 +%s points awarded', to_char(v_points, 'FM999,999,999'));
        v_notify_body := format(
          'Your partner awarded you for completing "%s" (week %s).',
          v_title,
          v_week
        );
      else
        v_notify_title := 'Activity marked complete';
        v_notify_body := format(
          'Your partner marked "%s" complete (week %s).',
          v_title,
          v_week
        );
      end if;

      insert into public.notifications (
        id, uid, type, notification_type, category, title, message,
        is_read, related_id, data, created_at, updated_at
      ) values (
        gen_random_uuid()::text,
        v_learner,
        'approval',
        'approval',
        'important_updates',
        v_notify_title,
        v_notify_body,
        false,
        v_activity_id,
        jsonb_build_object(
          'priority', 'push',
          'metadata', jsonb_build_object(
            'priority', 'push',
            'activityId', v_activity_id,
            'weekNumber', v_week,
            'points', v_points,
            'partnerId', v_caller::text,
            'source', 'partner_issued'
          ),
          'activityId', v_activity_id,
          'weekNumber', v_week,
          'points', v_points,
          'partnerId', v_caller::text,
          'source', 'partner_issued'
        ),
        v_now,
        v_now
      );
    exception when others then
      raise warning 'partner_issue_activity: notification insert failed: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'awarded', v_awarded,
    'already_awarded', v_already,
    'points', v_points,
    'learner_id', v_learner,
    'activity_id', v_activity_id,
    'week', v_week,
    'checklist_id', v_checklist_id,
    'pending_cleared', v_pending_count
  );
end;
$function$;

revoke all on function public.partner_issue_activity(jsonb) from public;
grant execute on function public.partner_issue_activity(jsonb) to authenticated;
