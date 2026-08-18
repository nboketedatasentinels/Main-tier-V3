-- ============================================================================
-- T4L  ·  Coach (ambassador) session slots + bookings
-- 0062: Move ambassador_slots / ambassador_slot_bookings off Firestore so
--        Supabase-authenticated coaches can schedule sessions.
--
-- NOTE: Some environments already have a legacy empty schema with
-- `ambassador_uid` + jsonb `data` (no `ambassador_id`). CREATE TABLE IF NOT
-- EXISTS left that schema in place and later steps failed with
-- "column ambassador_id does not exist". Drop + recreate when legacy.
-- organizations.id is text in this project; company_id must match.
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ambassador_slots'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ambassador_slots'
      and column_name = 'ambassador_id'
  ) then
    drop table if exists public.ambassador_slot_bookings cascade;
    drop table if exists public.ambassador_slots cascade;
  end if;
end $$;

create table if not exists public.ambassador_slots (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.profiles (id) on delete cascade,
  ambassador_name text,
  company_id text not null references public.organizations (id) on delete cascade,
  company_code text,
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes >= 15),
  capacity integer not null default 1 check (capacity >= 1),
  meeting_link text,
  location text,
  status text not null default 'open'
    check (status in ('open', 'full', 'cancelled', 'completed')),
  booking_count integer not null default 0 check (booking_count >= 0),
  cancellation_reason text,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ambassador_slots_ambassador_id_idx
  on public.ambassador_slots (ambassador_id, scheduled_at);

create index if not exists ambassador_slots_company_id_idx
  on public.ambassador_slots (company_id, scheduled_at);

create index if not exists ambassador_slots_status_idx
  on public.ambassador_slots (status);

create table if not exists public.ambassador_slot_bookings (
  id text primary key,
  slot_id uuid not null references public.ambassador_slots (id) on delete cascade,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  learner_name text,
  ambassador_id uuid not null references public.profiles (id) on delete cascade,
  company_id text references public.organizations (id) on delete set null,
  status text not null default 'booked'
    check (status in ('booked', 'attended', 'no_show', 'cancelled')),
  booked_at timestamptz not null default now(),
  attended_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text,
  points_awarded boolean not null default false,
  points_awarded_at timestamptz,
  marked_by uuid references public.profiles (id) on delete set null,
  slot_title text,
  slot_scheduled_at timestamptz,
  slot_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, learner_id)
);

create index if not exists ambassador_slot_bookings_slot_id_idx
  on public.ambassador_slot_bookings (slot_id);

create index if not exists ambassador_slot_bookings_learner_id_idx
  on public.ambassador_slot_bookings (learner_id, booked_at desc);

create index if not exists ambassador_slot_bookings_ambassador_id_idx
  on public.ambassador_slot_bookings (ambassador_id);

-- Caller shares an organization with the given company id (text org id).
create or replace function public.shares_org_with(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p_company_id is not null
      and (
        p.organization_id = p_company_id
        or p.company_id = p_company_id
      )
  );
$$;

revoke all on function public.shares_org_with(text) from public;
grant execute on function public.shares_org_with(text) to authenticated;

-- Drop older uuid overload if a previous attempt created it.
drop function if exists public.shares_org_with(uuid);

create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_partner_or_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) in ('ambassador', 'coach', 'super_admin', 'partner')
    );
$$;

revoke all on function public.is_coach_or_admin() from public;
grant execute on function public.is_coach_or_admin() to authenticated;

alter table public.ambassador_slots enable row level security;
alter table public.ambassador_slot_bookings enable row level security;

drop policy if exists ambassador_slots_select on public.ambassador_slots;
create policy ambassador_slots_select
  on public.ambassador_slots
  for select
  to authenticated
  using (
    public.is_partner_or_admin()
    or ambassador_id = auth.uid()
    or public.shares_org_with(company_id)
  );

drop policy if exists ambassador_slots_insert on public.ambassador_slots;
create policy ambassador_slots_insert
  on public.ambassador_slots
  for insert
  to authenticated
  with check (
    public.is_partner_or_admin()
    or (
      ambassador_id = auth.uid()
      and created_by = auth.uid()
      and status = 'open'
      and booking_count = 0
      and public.is_coach_or_admin()
    )
  );

drop policy if exists ambassador_slots_update on public.ambassador_slots;
create policy ambassador_slots_update
  on public.ambassador_slots
  for update
  to authenticated
  using (
    public.is_partner_or_admin()
    or ambassador_id = auth.uid()
    or public.shares_org_with(company_id)
  )
  with check (
    public.is_partner_or_admin()
    or ambassador_id = auth.uid()
    or public.shares_org_with(company_id)
  );

drop policy if exists ambassador_slot_bookings_select on public.ambassador_slot_bookings;
create policy ambassador_slot_bookings_select
  on public.ambassador_slot_bookings
  for select
  to authenticated
  using (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or ambassador_id = auth.uid()
  );

drop policy if exists ambassador_slot_bookings_insert on public.ambassador_slot_bookings;
create policy ambassador_slot_bookings_insert
  on public.ambassador_slot_bookings
  for insert
  to authenticated
  with check (
    public.is_partner_or_admin()
    or (learner_id = auth.uid() and status = 'booked')
  );

drop policy if exists ambassador_slot_bookings_update on public.ambassador_slot_bookings;
create policy ambassador_slot_bookings_update
  on public.ambassador_slot_bookings
  for update
  to authenticated
  using (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or ambassador_id = auth.uid()
  )
  with check (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or ambassador_id = auth.uid()
  );

grant select, insert, update on public.ambassador_slots to authenticated;
grant select, insert, update on public.ambassador_slot_bookings to authenticated;

-- Atomic book helper (capacity + unique booking).
drop function if exists public.book_ambassador_slot(uuid, uuid, text, uuid);

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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if auth.uid() <> p_learner_id and not public.is_partner_or_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_slot
  from public.ambassador_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'This session no longer exists.';
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
