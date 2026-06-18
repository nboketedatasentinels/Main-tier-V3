-- ============================================================================
-- T4L  ·  Org-code enrollment (Supabase)
-- 0016: SECURITY DEFINER function to bind a signing-up user to an organization
-- by its 6-char code, applying the org's journey + paid membership.
--
-- A user who signs up with an organization code BELONGS to that organization
-- and therefore can never be a free_user: they inherit the org's journey (which
-- is a paid programme, not the free 4-week intro) and become a paid org member.
--
-- This must run server-side because:
--   * Client UPDATE on profiles.role is revoked (0012) - only a definer
--     function (or service_role) may write the role column.
--   * It reads the organizations table to resolve the code -> journey.
--
-- The function acts on auth.uid() ONLY: a user can enroll *themselves* and only
-- with a valid, active org code. Org codes are the intended enrollment channel,
-- so self-enrollment with a known code is by design.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0001/0012.
-- ============================================================================

create or replace function public.claim_organization_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text := upper(trim(coalesce(p_code, '')));
  v_org     record;
  v_journey text;
  v_weeks   int;
  v_start   date;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'code_required');
  end if;

  select id, name, code, status, journey_type, program_duration_weeks,
         cohort_start_date, settings
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

  -- Resolve the org's journey: explicit column wins; otherwise derive from the
  -- programme duration (weeks column, else settings.programDurationMonths * 4).
  -- Mirrors journeyTypeFromDurationWeeks() in src/utils/journeyType.ts.
  v_journey := nullif(v_org.journey_type, '');
  if v_journey is null then
    v_weeks := coalesce(
      v_org.program_duration_weeks,
      round((v_org.settings->>'programDurationMonths')::numeric * 4)::int
    );
    v_journey := case
      when v_weeks is null or v_weeks <= 0 then null
      when v_weeks <= 4  then '4W'
      when v_weeks <= 6  then '6W'
      when v_weeks <= 12 then '3M'
      when v_weeks <= 24 then '6M'
      else '9M'
    end;
  end if;
  -- An org with no resolvable journey still enrolls the member; land them on 4W
  -- so they at least have a journey. The org's journey always wins when present.
  v_journey := coalesce(v_journey, '4W');

  v_start := coalesce(v_org.cohort_start_date::date, current_date);

  update public.profiles
     set organization_id     = v_org.id,
         company_id          = v_org.id,
         company_code        = v_org.code,
         company_name        = v_org.name,
         journey_type        = v_journey,
         journey_start_date  = coalesce(journey_start_date, v_start),
         membership_status   = 'paid',
         transformation_tier = 'corporate_member',
         -- Never downgrade a privileged role; everyone else becomes a paid org
         -- member (the whole point: org-code users are not free_user).
         role = case
                  when role in ('super_admin', 'partner', 'mentor', 'ambassador') then role
                  else 'paid_member'
                end,
         -- Consume the pending code stashed at signup so we don't re-apply it.
         data = (coalesce(data, '{}'::jsonb) - 'pendingCompanyCode'),
         updated_at = now()
   where id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'organizationId', v_org.id,
    'organizationName', v_org.name,
    'code', v_org.code,
    'journeyType', v_journey
  );
end;
$$;

revoke all on function public.claim_organization_code(text) from public;
grant execute on function public.claim_organization_code(text) to authenticated;
