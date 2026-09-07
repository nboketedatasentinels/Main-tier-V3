-- ============================================================================
-- T4L  ·  Session Prep LIFT date
-- 0095: Include assessment created_at in get_session_prep_lift so Session Prep
--        can show when the learner took LIFT.
-- ============================================================================

create or replace function public.get_session_prep_lift(p_learner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_learner public.profiles%rowtype;
  v_row public.lift_assessments%rowtype;
  v_allowed boolean := false;
  v_me_org text;
  v_learner_org text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_learner_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_learner');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  select * into v_learner from public.profiles where id = p_learner_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'learner_not_found');
  end if;

  if v_uid = p_learner_id then
    v_allowed := true;
  end if;

  if not v_allowed and public.is_partner_or_admin() then
    v_allowed := true;
  end if;

  if not v_allowed and (
    coalesce(nullif(trim(v_learner.mentor_id), ''), '') = v_uid::text
    or coalesce(nullif(trim(v_learner.ambassador_id), ''), '') = v_uid::text
  ) then
    v_allowed := true;
  end if;

  v_me_org := coalesce(nullif(trim(v_me.company_id), ''), nullif(trim(v_me.organization_id), ''));
  v_learner_org := coalesce(nullif(trim(v_learner.company_id), ''), nullif(trim(v_learner.organization_id), ''));

  if not v_allowed
     and lower(trim(coalesce(v_me.role, ''))) in ('mentor', 'ambassador', 'coach')
     and v_me_org is not null
     and v_me_org = v_learner_org
  then
    v_allowed := true;
  end if;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_row from public.lift_assessments where uid = p_learner_id;
  if not found then
    return jsonb_build_object('ok', true, 'lift', null);
  end if;

  return jsonb_build_object(
    'ok', true,
    'lift', jsonb_build_object(
      'uid', v_row.uid,
      'pillars', jsonb_build_object(
        'L', v_row.pillar_l,
        'I', v_row.pillar_i,
        'F', v_row.pillar_f,
        'T', v_row.pillar_t
      ),
      'liftIndex', v_row.lift_index,
      'archetype', v_row.archetype,
      'developmentEdge', v_row.development_edge,
      'assessedAt', v_row.created_at
    )
  );
end;
$$;

revoke all on function public.get_session_prep_lift(uuid) from public;
grant execute on function public.get_session_prep_lift(uuid) to authenticated;

notify pgrst, 'reload schema';
