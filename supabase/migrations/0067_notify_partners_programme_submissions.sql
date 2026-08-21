-- ============================================================================
-- T4L  ·  Notify partners when programme components are submitted
-- 0067: Capstones / case studies / practicals already upsert into
--        programme_component_submissions and show on
--        /partner/programme-submissions. Partners were not notified in the
--        bell inbox. This trigger writes in-app notifications to the org's
--        transformation partner (and any partner who lists the org in
--        assignedOrganizations) whenever a learner submits or resubmits.
-- ============================================================================

create or replace function public.notify_partners_of_programme_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org text;
  v_learner_name text;
  v_type_label text;
  v_title text;
  v_message text;
  v_partner uuid;
  v_should_notify boolean := false;
begin
  -- Only care about work waiting for partner review.
  if new.status is distinct from 'submitted' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_should_notify := true;
  elsif tg_op = 'UPDATE' then
    -- Fresh submit after review, or an explicit resubmit.
    v_should_notify :=
      (old.status is distinct from 'submitted')
      or (new.resubmitted_at is distinct from old.resubmitted_at);
  end if;

  if not v_should_notify then
    return new;
  end if;

  v_org := nullif(trim(coalesce(new.organization_id, '')), '');
  if v_org is null then
    -- Free practitioners (no org) stay assessor-side; no partner to ping.
    return new;
  end if;

  select coalesce(nullif(trim(full_name), ''), nullif(trim(email), ''), 'A learner')
    into v_learner_name
    from public.profiles
   where id = new.user_id;

  v_type_label := case new.component_type
    when 'capstone' then 'Capstone'
    when 'case_study' then 'Case Study'
    when 'practical' then 'Practical'
    else 'Programme component'
  end;

  v_title := coalesce(v_learner_name, 'A learner')
    || case when tg_op = 'UPDATE' and old.status = 'submitted' then ' resubmitted ' else ' submitted ' end
    || lower(v_type_label);

  v_message := coalesce(v_learner_name, 'A learner')
    || ' submitted "'
    || coalesce(nullif(trim(new.component_title), ''), nullif(trim(new.part_title), ''), v_type_label)
    || '". Review it under Programme Submissions.';

  -- Canonical org partner + any partner who mirrors the org in assignedOrganizations.
  for v_partner in
    select distinct p.id
    from public.profiles p
    where lower(trim(coalesce(p.role, ''))) in ('partner', 'super_admin', 'admin', 'company_admin')
      and (
        exists (
          select 1
            from public.organizations o
           where o.id = v_org
             and nullif(trim(coalesce(o.transformation_partner_id, '')), '') = p.id::text
        )
        or exists (
          select 1
            from jsonb_array_elements_text(coalesce(p.data->'assignedOrganizations', '[]'::jsonb)) as org_id
           where org_id = v_org
        )
      )
  loop
    insert into public.notifications (
      id,
      uid,
      type,
      notification_type,
      category,
      title,
      message,
      is_read,
      related_id,
      data,
      created_at,
      updated_at
    ) values (
      gen_random_uuid()::text,
      v_partner,
      'approval',
      'approval',
      'important_updates',
      v_title,
      v_message,
      false,
      new.id::text,
      jsonb_build_object(
        'priority', 'push',
        'kind', 'programme_component_submission',
        'submissionId', new.id,
        'learnerId', new.user_id,
        'organizationId', v_org,
        'componentId', new.component_id,
        'componentType', new.component_type,
        'componentTitle', new.component_title,
        'actionUrl', '/partner/programme-submissions'
      ),
      now(),
      now()
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists pcs_notify_partners on public.programme_component_submissions;
create trigger pcs_notify_partners
  after insert or update of status, resubmitted_at, component_title, organization_id
  on public.programme_component_submissions
  for each row
  execute function public.notify_partners_of_programme_submission();

comment on function public.notify_partners_of_programme_submission() is
  'Bell-notify org partners when a learner submits/resubmits a capstone, case study, or practical.';
