-- ============================================================================
-- T4L  ·  Villages (Supabase)
-- 0043: Replace Firestore `villages` / `village_invitations` writes that fail
-- after the auth cutover (no Firebase session → permission-denied on create).
--
-- IMPORTANT: a legacy `public.villages` scaffold may already exist with a
-- different shape (text ids, no creator_id, text[] members). This migration
-- normalizes or recreates the table, then installs RPCs.
--
-- Safe to re-run (idempotent).
-- ============================================================================

-- profiles.village_id: add if missing. Keep existing type (text or uuid).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'village_id'
  ) then
    alter table public.profiles add column village_id text;
  end if;
end;
$$;

-- ── Normalize / recreate villages ────────────────────────────────────────────
do $$
declare
  v_exists boolean;
  v_row_count bigint := 0;
  v_id_udt text;
  v_has_creator boolean := false;
  v_needs_rebuild boolean := false;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'villages'
  ) into v_exists;

  if v_exists then
    execute 'select count(*) from public.villages' into v_row_count;

    select c.udt_name into v_id_udt
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'villages' and c.column_name = 'id';

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'villages' and column_name = 'creator_id'
    ) into v_has_creator;

    -- Rebuild when empty, or when the contract is incompatible (non-uuid id / no creator_id).
    if v_row_count = 0 or coalesce(v_id_udt, '') <> 'uuid' or not v_has_creator then
      v_needs_rebuild := true;
    end if;
  else
    v_needs_rebuild := true;
  end if;

  if v_needs_rebuild then
    drop table if exists public.village_invitations cascade;
    drop table if exists public.villages cascade;

    create table public.villages (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      description text not null default '',
      creator_id uuid not null references public.profiles(id) on delete cascade,
      company_id text,
      member_ids uuid[] not null default '{}'::uuid[],
      member_count integer not null default 0
        check (member_count >= 0 and member_count <= 10),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint villages_name_nonempty check (length(trim(name)) > 0)
    );
  else
    -- Compatible uuid table: ensure optional columns exist.
    alter table public.villages
      add column if not exists name text,
      add column if not exists description text default '',
      add column if not exists company_id text,
      add column if not exists member_ids uuid[] default '{}'::uuid[],
      add column if not exists member_count integer default 0,
      add column if not exists is_active boolean default true,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();

    update public.villages
    set
      name = coalesce(nullif(trim(name), ''), 'Village'),
      description = coalesce(description, ''),
      member_ids = coalesce(member_ids, '{}'::uuid[]),
      member_count = coalesce(member_count, coalesce(cardinality(member_ids), 0)),
      is_active = coalesce(is_active, true),
      created_at = coalesce(created_at, now()),
      updated_at = coalesce(updated_at, now());
  end if;
end;
$$;

create unique index if not exists villages_name_unique_ci
  on public.villages (lower(trim(name)))
  where is_active = true;

create index if not exists villages_creator_idx on public.villages (creator_id);
create index if not exists villages_members_idx on public.villages using gin (member_ids);

-- ── village_invitations ──────────────────────────────────────────────────────
drop table if exists public.village_invitations cascade;

create table public.village_invitations (
  id uuid primary key default gen_random_uuid(),
  invitation_code text not null,
  village_id uuid not null references public.villages(id) on delete cascade,
  village_name text not null default '',
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invited_by_name text,
  email text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists village_invitations_code_unique
  on public.village_invitations (upper(invitation_code));

create index if not exists village_invitations_village_idx
  on public.village_invitations (village_id, status);

alter table public.villages enable row level security;
alter table public.village_invitations enable row level security;

drop policy if exists villages_select_member on public.villages;
drop policy if exists village_invitations_select on public.village_invitations;

-- Compare via text so profiles.village_id can be text or uuid safely.
create policy villages_select_member
  on public.villages for select to authenticated
  using (
    auth.uid() = creator_id
    or auth.uid() = any (coalesce(member_ids, '{}'::uuid[]))
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          nullif(trim(coalesce(p.village_id::text, '')), '') = villages.id::text
          or nullif(trim(coalesce(p.data->>'villageId', '')), '') = villages.id::text
        )
    )
  );

create policy village_invitations_select
  on public.village_invitations for select to authenticated
  using (
    auth.uid() = invited_by
    or exists (
      select 1 from public.villages v
      where v.id = village_invitations.village_id
        and (
          auth.uid() = v.creator_id
          or auth.uid() = any (coalesce(v.member_ids, '{}'::uuid[]))
        )
    )
    or status = 'pending'
  );

revoke insert, update, delete on public.villages from authenticated, anon;
revoke insert, update, delete on public.village_invitations from authenticated, anon;
grant select on public.villages to authenticated;
grant select on public.village_invitations to authenticated;

-- Helper: write profiles.village_id whether the column is text or uuid.
create or replace function public._set_profile_village_id(p_user_id uuid, p_village_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_udt text;
begin
  select c.udt_name into v_udt
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'village_id';

  if p_village_id is null then
    if v_udt = 'uuid' then
      update public.profiles
      set
        village_id = null,
        data = coalesce(data, '{}'::jsonb) - 'villageId',
        updated_at = now()
      where id = p_user_id;
    else
      update public.profiles
      set
        village_id = null,
        data = coalesce(data, '{}'::jsonb) - 'villageId',
        updated_at = now()
      where id = p_user_id;
    end if;
    return;
  end if;

  if v_udt = 'uuid' then
    update public.profiles
    set
      village_id = p_village_id,
      data = coalesce(data, '{}'::jsonb) || jsonb_build_object('villageId', p_village_id::text),
      updated_at = now()
    where id = p_user_id;
  else
    update public.profiles
    set
      village_id = p_village_id::text,
      data = coalesce(data, '{}'::jsonb) || jsonb_build_object('villageId', p_village_id::text),
      updated_at = now()
    where id = p_user_id;
  end if;
end;
$$;

-- ── create village + attach creator ──────────────────────────────────────────
create or replace function public.create_my_village(
  p_name text,
  p_description text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_description text := trim(coalesce(p_description, ''));
  v_existing_village text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_name = '' then
    raise exception 'village_name_required';
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_not_found';
  end if;

  v_existing_village := coalesce(
    nullif(trim(coalesce(v_me.village_id::text, '')), ''),
    nullif(trim(coalesce(v_me.data->>'villageId', '')), '')
  );
  if v_existing_village is not null then
    raise exception 'already_in_village';
  end if;

  if exists (
    select 1 from public.villages
    where is_active = true and lower(trim(name)) = lower(v_name)
  ) then
    raise exception 'village_name_taken';
  end if;

  insert into public.villages (
    name,
    description,
    creator_id,
    member_ids,
    member_count,
    is_active
  )
  values (
    v_name,
    v_description,
    v_uid,
    array[v_uid]::uuid[],
    1,
    true
  )
  returning id into v_id;

  perform public._set_profile_village_id(v_uid, v_id);

  return jsonb_build_object(
    'id', v_id,
    'name', v_name,
    'description', v_description,
    'creatorId', v_uid,
    'memberCount', 1,
    'isActive', true
  );
end;
$$;

revoke all on function public.create_my_village(text, text) from public;
grant execute on function public.create_my_village(text, text) to authenticated;

create or replace function public.is_village_name_taken(p_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.villages
    where is_active = true
      and lower(trim(name)) = lower(trim(coalesce(p_name, '')))
  );
$$;

revoke all on function public.is_village_name_taken(text) from public;
grant execute on function public.is_village_name_taken(text) to authenticated;

create or replace function public.set_my_village_id(p_village_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_village public.villages%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_village_id is null then
    update public.villages
    set
      member_ids = array_remove(coalesce(member_ids, '{}'::uuid[]), v_uid),
      member_count = greatest(0, coalesce(member_count, 0) - 1),
      updated_at = now()
    where v_uid = any (coalesce(member_ids, '{}'::uuid[]));

    perform public._set_profile_village_id(v_uid, null);
    return;
  end if;

  select * into v_village
  from public.villages
  where id = p_village_id and is_active = true;
  if not found then
    raise exception 'village_not_found';
  end if;

  if coalesce(v_village.member_count, 0) >= 10
     and not (v_uid = any (coalesce(v_village.member_ids, '{}'::uuid[]))) then
    raise exception 'village_full';
  end if;

  if not (v_uid = any (coalesce(v_village.member_ids, '{}'::uuid[]))) then
    update public.villages
    set
      member_ids = array_append(coalesce(member_ids, '{}'::uuid[]), v_uid),
      member_count = coalesce(member_count, 0) + 1,
      updated_at = now()
    where id = p_village_id;
  end if;

  perform public._set_profile_village_id(v_uid, p_village_id);
end;
$$;

revoke all on function public.set_my_village_id(uuid) from public;
grant execute on function public.set_my_village_id(uuid) to authenticated;

create or replace function public.create_village_invitation(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_village_id uuid := nullif(trim(coalesce(p->>'villageId', '')), '')::uuid;
  v_village public.villages%rowtype;
  v_code text := upper(trim(coalesce(p->>'invitationCode', '')));
  v_email text := nullif(lower(trim(coalesce(p->>'email', ''))), '');
  v_id uuid;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_village_id is null then
    raise exception 'village_id_required';
  end if;

  select * into v_village
  from public.villages
  where id = v_village_id and is_active = true;
  if not found then
    raise exception 'village_not_found';
  end if;

  if v_uid is distinct from v_village.creator_id
     and not (v_uid = any (coalesce(v_village.member_ids, '{}'::uuid[]))) then
    raise exception 'forbidden';
  end if;

  if v_code = '' then
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
  end if;

  insert into public.village_invitations (
    invitation_code,
    village_id,
    village_name,
    invited_by,
    invited_by_name,
    email,
    status
  )
  values (
    v_code,
    v_village_id,
    coalesce(nullif(trim(coalesce(p->>'villageName', '')), ''), v_village.name),
    v_uid,
    nullif(trim(coalesce(p->>'invitedByName', '')), ''),
    v_email,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'invitationCode', v_code);
end;
$$;

revoke all on function public.create_village_invitation(jsonb) from public;
grant execute on function public.create_village_invitation(jsonb) to authenticated;
