-- ============================================================================
-- T4L  ·  Leadership → learner (and reverse) in-app notifications
-- 0063: Coach/mentor session events must land in Supabase `notifications`
--        (what the bell reads). Direct inserts are partner/admin-only via RLS,
--        so this SECURITY DEFINER helper authorizes mentor/ambassador fan-out.
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
  v_allowed boolean := false;
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

  select lower(trim(coalesce(role, ''))) into v_caller_role
  from public.profiles
  where id = v_caller;

  if public.is_partner_or_admin() then
    v_allowed := true;
  elsif v_target.mentor_id = v_caller then
    -- Mentor notifying their mentee
    v_allowed := true;
  elsif v_target.ambassador_id = v_caller then
    -- Coach notifying their coachee
    v_allowed := true;
  elsif v_caller_role in ('mentor', 'ambassador', 'coach') and p_uid = v_caller then
    -- Self (rare)
    v_allowed := true;
  elsif exists (
    select 1
    from public.profiles me
    where me.id = v_caller
      and (
        me.mentor_id = p_uid
        or me.ambassador_id = p_uid
      )
  ) then
    -- Learner notifying their assigned mentor/coach (e.g. booked a slot)
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

-- Fan-out: every learner assigned to this coach (profiles.ambassador_id).
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
        p.ambassador_id = v_slot.ambassador_id
        or (
          v_slot.company_id is not null
          and (
            p.company_id = v_slot.company_id
            or p.organization_id = v_slot.company_id
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
