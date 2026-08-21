-- ============================================================================
-- T4L  ·  Coach can book learners onto their own slots
-- 0072: Allow the slot's coach (ambassador) to book attendees, so "All
--        coachees" invite from the schedule modal can enroll the roster.
-- ============================================================================

create or replace function public.book_ambassador_slot(
  p_slot_id uuid,
  p_learner_id uuid,
  p_learner_name text default null,
  p_company_id text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.ambassador_slots%rowtype;
  v_booking_id text;
  v_existing_status text;
  v_next_count integer;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select * into v_slot
  from public.ambassador_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'This session no longer exists.';
  end if;

  if v_caller <> p_learner_id
     and v_slot.ambassador_id <> v_caller
     and not public.is_partner_or_admin() then
    raise exception 'forbidden';
  end if;

  if v_slot.status in ('cancelled', 'completed') then
    raise exception 'This session is no longer accepting bookings.';
  end if;
  if v_slot.booking_count >= v_slot.capacity then
    raise exception 'This session is already full.';
  end if;

  v_booking_id := p_slot_id::text || '__' || p_learner_id::text;

  select status into v_existing_status
  from public.ambassador_slot_bookings
  where id = v_booking_id;

  if v_existing_status in ('booked', 'attended') then
    raise exception 'You are already booked for this session.';
  end if;

  insert into public.ambassador_slot_bookings (
    id, slot_id, learner_id, learner_name, ambassador_id, company_id,
    status, booked_at, slot_title, slot_scheduled_at, slot_status, updated_at
  ) values (
    v_booking_id, p_slot_id, p_learner_id, p_learner_name, v_slot.ambassador_id,
    coalesce(p_company_id, v_slot.company_id),
    'booked', now(), v_slot.title, v_slot.scheduled_at, v_slot.status, now()
  )
  on conflict (id) do update set
    status = 'booked',
    learner_name = excluded.learner_name,
    booked_at = now(),
    cancelled_at = null,
    cancelled_by = null,
    cancel_reason = null,
    slot_title = excluded.slot_title,
    slot_scheduled_at = excluded.slot_scheduled_at,
    slot_status = excluded.slot_status,
    updated_at = now();

  v_next_count := v_slot.booking_count + 1;
  update public.ambassador_slots
  set
    booking_count = v_next_count,
    status = case when v_next_count >= capacity then 'full' else status end,
    updated_at = now()
  where id = p_slot_id;

  return v_booking_id;
end;
$$;

revoke all on function public.book_ambassador_slot(uuid, uuid, text, text) from public;
grant execute on function public.book_ambassador_slot(uuid, uuid, text, text) to authenticated;
