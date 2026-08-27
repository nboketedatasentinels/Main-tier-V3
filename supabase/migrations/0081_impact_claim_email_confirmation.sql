-- ============================================================================
-- T4L  ·  Impact claim email confirmation (measure owner + finance)
-- 0081: Tokenised email confirmations advance claimStatus so Tier 2 / Tier 3
--       value can reflect on the learner dashboard after independent sign-off.
-- ============================================================================

create or replace function public.create_impact_claim_confirmation(
  p_impact_log_id text,
  p_verifier_name text,
  p_verifier_email text,
  p_role text,
  p_activity_title text default null,
  p_impact_summary jsonb default '{}'::jsonb,
  p_learner_name text default null,
  p_learner_email text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_token text;
  v_hash text;
  v_id uuid;
  v_email text;
  v_name text;
  v_role text := lower(trim(coalesce(p_role, '')));
  v_verifier_uid uuid;
  v_summary jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_role not in ('measure_owner', 'finance') then
    raise exception 'invalid_role';
  end if;

  -- Service-role chaining (finance follow-up) may pass p_user_id without JWT.
  if p_user_id is not null and auth.uid() is not null and auth.uid() <> p_user_id
     and not public.is_partner_or_admin() then
    raise exception 'forbidden';
  end if;

  v_name := nullif(trim(coalesce(p_verifier_name, '')), '');
  v_email := lower(trim(coalesce(p_verifier_email, '')));

  if p_impact_log_id is null or length(trim(p_impact_log_id)) = 0 then
    raise exception 'impact_log_id_required';
  end if;
  if v_name is null then
    raise exception 'verifier_name_required';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'verifier_email_invalid';
  end if;

  select id into v_verifier_uid
  from public.profiles
  where lower(trim(email)) = v_email
  limit 1;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := public._hash_impact_token(v_token);
  v_id := gen_random_uuid();
  v_summary := coalesce(p_impact_summary, '{}'::jsonb)
    || jsonb_build_object(
      'kind', 'improvement_claim',
      'role', v_role
    );

  -- Supersede any prior pending confirmation for this role on this claim.
  update public.impact_verifications
  set status = 'rejected',
      rejection_reason = 'superseded_by_new_request',
      resolved_at = now(),
      updated_at = now()
  where impact_log_id = trim(p_impact_log_id)
    and verifier_role = v_role
    and status = 'pending';

  insert into public.impact_verifications (
    id, impact_log_id, user_id, learner_name, learner_email,
    verifier_name, verifier_email, verifier_role, verifier_user_id,
    token_hash, status, week_number, journey_type, activity_title,
    points_to_award, impact_summary
  ) values (
    v_id, trim(p_impact_log_id), v_uid, p_learner_name, p_learner_email,
    v_name, v_email, v_role, v_verifier_uid,
    v_hash, 'pending', 1, null, p_activity_title,
    0, v_summary
  );

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'status', 'pending',
    'verifierEmail', v_email,
    'verifierName', v_name,
    'verifierRole', v_role,
    'verifierUserId', v_verifier_uid,
    'pointsToAward', 0
  );
end;
$$;

revoke all on function public.create_impact_claim_confirmation(
  text, text, text, text, text, jsonb, text, text, uuid
) from public;
grant execute on function public.create_impact_claim_confirmation(
  text, text, text, text, text, jsonb, text, text, uuid
) to authenticated, service_role;

-- Apply claim status after email approve/reject. Returns next action hints.
create or replace function public.apply_impact_claim_confirmation(
  p_impact_log_id text,
  p_role text,
  p_decision text,
  p_actor_name text default null,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.impact_logs%rowtype;
  v_data jsonb;
  v_claim jsonb;
  v_role text := lower(trim(coalesce(p_role, '')));
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_net numeric := 0;
  v_needs_finance boolean := false;
  v_next_status text;
  v_usd numeric := 0;
  v_tier int := 1;
  v_audit jsonb;
  v_line text;
begin
  if v_role not in ('measure_owner', 'finance') then
    raise exception 'invalid_role';
  end if;
  if v_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  select * into v_row from public.impact_logs where id = p_impact_log_id for update;
  if not found then
    raise exception 'impact_log_not_found';
  end if;

  v_data := coalesce(v_row.data, '{}'::jsonb);
  v_claim := coalesce(v_data->'claim', '{}'::jsonb);
  v_net := coalesce((v_claim->>'net')::numeric, v_row.usd_value, 0);
  v_needs_finance := coalesce((v_data->>'needsFinance')::boolean, v_net > 1000);
  v_audit := coalesce(v_data->'auditTrail', '[]'::jsonb);
  if jsonb_typeof(v_audit) <> 'array' then
    v_audit := '[]'::jsonb;
  end if;

  if v_decision = 'rejected' then
    v_line := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      || ' · '
      || coalesce(nullif(trim(p_actor_name), ''), v_role)
      || ' returned claim'
      || case when nullif(trim(coalesce(p_rejection_reason, '')), '') is not null
           then ': ' || trim(p_rejection_reason) else '' end;
    v_data := v_data
      || jsonb_build_object(
        'claimStatus', 'Returned for Revision',
        'verificationStatus', 'rejected'
      );
    v_data := jsonb_set(v_data, '{auditTrail}', v_audit || to_jsonb(v_line), true);

    update public.impact_logs
    set verification_status = 'rejected',
        data = v_data,
        updated_at = now()
    where id = p_impact_log_id;

    return jsonb_build_object(
      'ok', true,
      'claimStatus', 'Returned for Revision',
      'needsFinanceFollowUp', false,
      'recognized', false
    );
  end if;

  if v_role = 'measure_owner' then
    if v_needs_finance then
      v_next_status := 'Measure Owner Confirmed';
      v_tier := 2;
      v_usd := round(v_net); -- indicative pipeline value (still pending finance)
    else
      v_next_status := 'Recognized';
      v_tier := 3;
      v_usd := round(v_net);
    end if;
  else
    -- finance
    v_next_status := 'Recognized';
    v_tier := 3;
    v_usd := round(v_net);
  end if;

  v_line := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    || ' · '
    || coalesce(nullif(trim(p_actor_name), ''), v_role)
    || ' confirmed via email → '
    || v_next_status;

  v_claim := v_claim || jsonb_build_object('tier', v_tier);
  v_data := v_data
    || jsonb_build_object(
      'claimStatus', v_next_status,
      'verificationStatus', case when v_next_status = 'Recognized' then 'approved' else 'pending' end,
      'verificationLevel', case
        when v_tier = 3 then 'Tier 3: Verified'
        when v_tier = 2 then 'Tier 2: Partner Verified'
        else 'Tier 1: Self-Reported'
      end,
      'usdValue', v_usd,
      'claim', v_claim
    );
  v_data := jsonb_set(v_data, '{auditTrail}', v_audit || to_jsonb(v_line), true);

  update public.impact_logs
  set
    usd_value = case when v_tier >= 2 then v_usd else coalesce(usd_value, 0) end,
    verification_status = case when v_next_status = 'Recognized' then 'approved' else 'pending' end,
    data = v_data,
    updated_at = now()
  where id = p_impact_log_id;

  return jsonb_build_object(
    'ok', true,
    'claimStatus', v_next_status,
    'tier', v_tier,
    'usdValue', v_usd,
    'needsFinanceFollowUp', (v_role = 'measure_owner' and v_needs_finance and v_next_status = 'Measure Owner Confirmed'),
    'recognized', v_next_status = 'Recognized',
    'financeName', coalesce(v_data->>'financeName', v_claim->>'finance', ''),
    'financeEmail', coalesce(v_data->>'financeEmail', ''),
    'learnerUserId', v_row.uid,
    'title', coalesce(v_row.title, v_claim->>'measure', 'Improvement claim')
  );
end;
$$;

revoke all on function public.apply_impact_claim_confirmation(text, text, text, text, text) from public;
grant execute on function public.apply_impact_claim_confirmation(text, text, text, text, text) to service_role;

-- Ensure resolve payload includes role for claim confirmations.
create or replace function public.resolve_impact_verification(
  p_token text,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row public.impact_verifications%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'invalid_token';
  end if;
  if v_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  v_hash := public._hash_impact_token(trim(p_token));

  select * into v_row
  from public.impact_verifications
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object(
      'id', v_row.id,
      'status', v_row.status,
      'alreadyResolved', true,
      'impactLogId', v_row.impact_log_id,
      'userId', v_row.user_id,
      'weekNumber', v_row.week_number,
      'journeyType', v_row.journey_type,
      'verifierRole', v_row.verifier_role,
      'impactSummary', v_row.impact_summary,
      'verifierName', v_row.verifier_name
    );
  end if;

  update public.impact_verifications
  set
    status = v_decision,
    rejection_reason = case when v_decision = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '') else null end,
    resolved_at = now(),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'alreadyResolved', false,
    'impactLogId', v_row.impact_log_id,
    'userId', v_row.user_id,
    'weekNumber', v_row.week_number,
    'journeyType', v_row.journey_type,
    'activityTitle', v_row.activity_title,
    'pointsToAward', v_row.points_to_award,
    'impactSummary', v_row.impact_summary,
    'verifierName', v_row.verifier_name,
    'verifierEmail', v_row.verifier_email,
    'verifierRole', v_row.verifier_role
  );
end;
$$;

revoke all on function public.resolve_impact_verification(text, text, text) from public;
grant execute on function public.resolve_impact_verification(text, text, text) to service_role;
