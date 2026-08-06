-- ============================================================================
-- T4L  ·  Public org-code lookup for signup
-- 0046: SECURITY DEFINER function so anonymous signup can verify a 6-char
-- company code before account creation.
--
-- Why: signup previously skipped client-side org lookups when unauthenticated
-- (legacy Firestore public-read concern). That left companyCodeValid = null and
-- blocked submit with "Please wait for the company code to be verified."
-- Organizations are on Supabase now; expose a minimal active-code lookup via
-- SECURITY DEFINER so anon can confirm a code without broad table SELECT.
-- ============================================================================

create or replace function public.lookup_organization_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_org  record;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'code_required');
  end if;

  if char_length(v_code) <> 6 then
    return jsonb_build_object('ok', false, 'error', 'code_invalid_length');
  end if;

  select id, name, code, status, journey_type, program_duration_weeks,
         cohort_start_date, settings, member_count, created_at, updated_at
    into v_org
    from public.organizations
   where upper(code) = v_code
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'code_not_found');
  end if;

  if coalesce(v_org.status, 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'org_inactive');
  end if;

  return jsonb_build_object(
    'ok', true,
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'code', v_org.code,
      'status', v_org.status,
      'journey_type', v_org.journey_type,
      'program_duration_weeks', v_org.program_duration_weeks,
      'cohort_start_date', v_org.cohort_start_date,
      'settings', coalesce(v_org.settings, '{}'::jsonb),
      'member_count', coalesce(v_org.member_count, 0),
      'created_at', v_org.created_at,
      'updated_at', v_org.updated_at
    )
  );
end;
$$;

revoke all on function public.lookup_organization_code(text) from public;
grant execute on function public.lookup_organization_code(text) to anon, authenticated;
