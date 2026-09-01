-- ============================================================================
-- Fix: gen_random_bytes / digest live in schema `extensions` (pgcrypto),
-- but impact RPCs used SET search_path = public only → verifier email failed with
-- "function gen_random_bytes(integer) does not exist".
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Prefer schema-qualified calls so search_path cannot break tokens again.
create or replace function public._hash_impact_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.create_impact_verification(
  p_impact_log_id text,
  p_verifier_name text,
  p_verifier_email text,
  p_week_number integer,
  p_journey_type text default null,
  p_activity_title text default null,
  p_impact_summary jsonb default '{}'::jsonb,
  p_learner_name text default null,
  p_learner_email text default null,
  p_points_to_award integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
  v_email text;
  v_name text;
  v_verifier_uid uuid;
  v_points integer := greatest(0, coalesce(p_points_to_award, 1000));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
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
  if p_week_number is null or p_week_number < 1 then
    raise exception 'week_number_invalid';
  end if;

  select id into v_verifier_uid
  from public.profiles
  where lower(trim(email)) = v_email
  limit 1;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := public._hash_impact_token(v_token);
  v_id := gen_random_uuid();

  insert into public.impact_verifications (
    id, impact_log_id, user_id, learner_name, learner_email,
    verifier_name, verifier_email, verifier_role, verifier_user_id,
    token_hash, status, week_number, journey_type, activity_title,
    points_to_award, impact_summary
  ) values (
    v_id, trim(p_impact_log_id), v_uid, p_learner_name, p_learner_email,
    v_name, v_email, 'verifier', v_verifier_uid,
    v_hash, 'pending', p_week_number, p_journey_type, p_activity_title,
    v_points, coalesce(p_impact_summary, '{}'::jsonb)
  );

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'status', 'pending',
    'verifierEmail', v_email,
    'verifierName', v_name,
    'verifierUserId', v_verifier_uid,
    'pointsToAward', v_points
  );
end;
$$;

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
set search_path = public, extensions
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

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := public._hash_impact_token(v_token);
  v_id := gen_random_uuid();
  v_summary := coalesce(p_impact_summary, '{}'::jsonb)
    || jsonb_build_object(
      'kind', 'improvement_claim',
      'role', v_role
    );

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

revoke all on function public.create_impact_verification(
  text, text, text, integer, text, text, jsonb, text, text, integer
) from public;
grant execute on function public.create_impact_verification(
  text, text, text, integer, text, text, jsonb, text, text, integer
) to authenticated;

revoke all on function public.create_impact_claim_confirmation(
  text, text, text, text, text, jsonb, text, text, uuid
) from public;
grant execute on function public.create_impact_claim_confirmation(
  text, text, text, text, text, jsonb, text, text, uuid
) to authenticated, service_role;
