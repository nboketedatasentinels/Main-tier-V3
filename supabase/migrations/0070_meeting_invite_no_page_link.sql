-- ============================================================================
-- T4L  ·  Meeting invites: simple push, no page deep-link
-- 0070: Coach slot published notifications no longer point at Leadership
--        Council. Learners get a push popup; email opens via mailto on OK.
-- ============================================================================

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
  v_link text;
  v_body text;
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
  v_link := nullif(trim(coalesce(v_slot.meeting_link, '')), '');
  v_body := v_coach_name || ' published "' || v_slot.title || '" for ' || v_when
    || case when v_link is not null then E'.\nMeeting link: ' || v_link else '.' end;

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
      v_body,
      false,
      p_slot_id::text,
      jsonb_build_object(
        'priority', 'push',
        'kind', 'coach_slot_published',
        'slotId', p_slot_id,
        'ambassadorId', v_slot.ambassador_id,
        'meetingLink', v_link,
        'scheduledAt', v_slot.scheduled_at
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
