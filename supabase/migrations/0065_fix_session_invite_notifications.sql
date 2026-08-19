-- ============================================================================
-- T4L  ·  Fix session invite → bell notifications
-- 0065: notify_as_leadership / notify_coach_slot_published were effectively
--        dead for real coach/mentor flows:
--        1) profiles.mentor_id / ambassador_id are often NULL (org peers are
--           still shown on dashboards via list_org_peers).
--        2) profiles.*_id columns are text while auth.uid() / slot FKs are
--           uuid — equality raised "operator does not exist" and aborted
--           the coach fan-out entirely (caught client-side as a warn).
-- ============================================================================

create or replace function public.notify_as_leadership(
  p_uid uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_id text default null,
  p_category text default 'important_updates',
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_target public.profiles%rowtype;
  v_caller_row public.profiles%rowtype;
  v_allowed boolean := false;
  v_caller_org text;
  v_target_org text;
  v_target_role text;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;
  if p_uid is null then
    raise exception 'target required';
  end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'title required';
  end if;
  if nullif(trim(coalesce(p_message, '')), '') is null then
    raise exception 'message required';
  end if;

  select * into v_target from public.profiles where id = p_uid;
  if not found then
    raise exception 'target not found';
  end if;

  select * into v_caller_row from public.profiles where id = v_caller;
  if not found then
    raise exception 'caller not found';
  end if;

  v_caller_role := lower(trim(coalesce(v_caller_row.role, '')));
  v_target_role := lower(trim(coalesce(v_target.role, '')));
  v_caller_org := nullif(trim(coalesce(v_caller_row.company_id, v_caller_row.organization_id, '')), '');
  v_target_org := nullif(trim(coalesce(v_target.company_id, v_target.organization_id, '')), '');

  if public.is_partner_or_admin() then
    v_allowed := true;
  elsif coalesce(v_target.mentor_id::text, '') = v_caller::text then
    -- Explicit mentee assignment
    v_allowed := true;
  elsif coalesce(v_target.ambassador_id::text, '') = v_caller::text then
    -- Explicit coachee assignment
    v_allowed := true;
  elsif v_caller_role in ('mentor', 'ambassador', 'coach')
    and v_target_role in ('free_user', 'paid_member', 'user')
    and v_caller_org is not null
    and v_caller_org = v_target_org
  then
    -- Org mentor/coach notifying an org learner (matches dashboard roster)
    v_allowed := true;
  elsif exists (
    select 1
    from public.mentorship_sessions ms
    where (
      (ms.mentor_id = v_caller and ms.learner_id = p_uid)
      or (ms.learner_id = v_caller and ms.mentor_id = p_uid)
    )
  ) then
    -- Already in a mentorship session together
    v_allowed := true;
  elsif coalesce(v_caller_row.mentor_id::text, '') = p_uid::text
    or coalesce(v_caller_row.ambassador_id::text, '') = p_uid::text
  then
    -- Learner notifying their assigned mentor/coach
    v_allowed := true;
  elsif v_target_role in ('mentor', 'ambassador', 'coach')
    and v_caller_role in ('free_user', 'paid_member', 'user')
    and v_caller_org is not null
    and v_caller_org = v_target_org
  then
    -- Learner notifying org mentor/coach
    v_allowed := true;
  elsif p_uid = v_caller then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'forbidden';
  end if;

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
    p_uid,
    coalesce(nullif(trim(p_type), ''), 'session_request'),
    coalesce(nullif(trim(p_type), ''), 'session_request'),
    p_category,
    trim(p_title),
    trim(p_message),
    false,
    p_related_id,
    coalesce(p_data, '{}'::jsonb),
    now(),
    now()
  );
end;
$$;

revoke all on function public.notify_as_leadership(uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.notify_as_leadership(uuid, text, text, text, text, text, jsonb) to authenticated;

create or replace function public.notify_coach_slot_published(p_slot_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_slot public.ambassador_slots%rowtype;
  v_learner record;
  v_count integer := 0;
  v_when text;
  v_coach_name text;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select * into v_slot
  from public.ambassador_slots
  where id = p_slot_id;

  if not found then
    raise exception 'slot not found';
  end if;

  if v_slot.ambassador_id <> v_caller and not public.is_partner_or_admin() then
    raise exception 'forbidden';
  end if;

  v_coach_name := coalesce(nullif(trim(v_slot.ambassador_name), ''), 'Your coach');
  v_when := to_char(v_slot.scheduled_at at time zone 'UTC', 'Dy DD Mon YYYY, HH24:MI') || ' UTC';

  for v_learner in
    select distinct p.id
    from public.profiles p
    where p.id <> v_slot.ambassador_id
      and lower(trim(coalesce(p.role, ''))) in ('free_user', 'paid_member', 'user')
      and (
        coalesce(p.ambassador_id::text, '') = v_slot.ambassador_id::text
        or (
          v_slot.company_id is not null
          and nullif(trim(v_slot.company_id), '') is not null
          and (
            coalesce(p.company_id, '') = v_slot.company_id
            or coalesce(p.organization_id, '') = v_slot.company_id
          )
        )
      )
  loop
    insert into public.notifications (
      id, uid, type, notification_type, category, title, message, is_read, related_id, data, created_at, updated_at
    ) values (
      gen_random_uuid()::text,
      v_learner.id,
      'session_request',
      'session_request',
      'action_required',
      'New coaching session available',
      v_coach_name || ' published "' || v_slot.title || '" for ' || v_when
        || '. Open Leadership Council to book your seat.',
      false,
      p_slot_id::text,
      jsonb_build_object(
        'priority', 'push',
        'kind', 'coach_slot_published',
        'slotId', p_slot_id,
        'ambassadorId', v_slot.ambassador_id,
        'href', '/app/leadership-council'
      ),
      now(),
      now()
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.notify_coach_slot_published(uuid) from public;
grant execute on function public.notify_coach_slot_published(uuid) to authenticated;

-- Backfill: learner who already has a mentor meeting but never got a bell ping.
insert into public.notifications (
  id, uid, type, notification_type, category, title, message, is_read, related_id, data, created_at, updated_at
)
select
  gen_random_uuid()::text,
  ms.learner_id,
  'session_request',
  'session_request',
  'action_required',
  'New mentorship meeting scheduled',
  coalesce(nullif(trim(ms.mentor_name), ''), 'Your mentor')
    || ' scheduled "'
    || coalesce(nullif(trim(ms.topic), ''), 'Mentorship session')
    || '" for '
    || to_char(coalesce(ms.scheduled_at, ms.proposed_at, ms.created_at) at time zone 'UTC', 'Dy DD Mon YYYY, HH24:MI')
    || ' UTC.',
  false,
  ms.id::text,
  jsonb_build_object(
    'priority', 'push',
    'kind', 'mentorship_scheduled_by_mentor',
    'sessionId', ms.id,
    'mentorId', ms.mentor_id,
    'backfill', true
  ),
  now(),
  now()
from public.mentorship_sessions ms
where ms.status = 'scheduled'
  and ms.created_at > now() - interval '14 days'
  and not exists (
    select 1
    from public.notifications n
    where n.uid = ms.learner_id
      and (
        n.related_id = ms.id::text
        or (n.data ->> 'sessionId') = ms.id::text
      )
  );

-- Backfill: open coach slots that never notified org learners.
insert into public.notifications (
  id, uid, type, notification_type, category, title, message, is_read, related_id, data, created_at, updated_at
)
select
  gen_random_uuid()::text,
  p.id,
  'session_request',
  'session_request',
  'action_required',
  'New coaching session available',
  coalesce(nullif(trim(s.ambassador_name), ''), 'Your coach')
    || ' published "'
    || s.title
    || '" for '
    || to_char(s.scheduled_at at time zone 'UTC', 'Dy DD Mon YYYY, HH24:MI')
    || ' UTC. Open Leadership Council to book your seat.',
  false,
  s.id::text,
  jsonb_build_object(
    'priority', 'push',
    'kind', 'coach_slot_published',
    'slotId', s.id,
    'ambassadorId', s.ambassador_id,
    'href', '/app/leadership-council',
    'backfill', true
  ),
  now(),
  now()
from public.ambassador_slots s
join public.profiles p
  on p.id <> s.ambassador_id
 and lower(trim(coalesce(p.role, ''))) in ('free_user', 'paid_member', 'user')
 and (
   coalesce(p.ambassador_id::text, '') = s.ambassador_id::text
   or (
     s.company_id is not null
     and (
       coalesce(p.company_id, '') = s.company_id
       or coalesce(p.organization_id, '') = s.company_id
     )
   )
 )
where s.status = 'open'
  and s.scheduled_at >= now() - interval '1 day'
  and not exists (
    select 1
    from public.notifications n
    where n.uid = p.id
      and (
        n.related_id = s.id::text
        or (n.data ->> 'slotId') = s.id::text
      )
  );
