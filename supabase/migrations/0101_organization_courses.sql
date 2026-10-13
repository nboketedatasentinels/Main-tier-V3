-- ============================================================================
-- T4L  ·  Organisation course library (multi-tenant custom courses)
-- 0101: Lets an organisation bring its own courses instead of (or alongside)
--        the T4L catalogue. Every course follows one template - title,
--        description, link or uploaded file, length, level, free/paid + price -
--        so any of the organisation's courses can be slotted into its journey.
--
-- Tenant isolation:
--   * Rows are readable only by members of that organisation, a partner
--     assigned to it (partner_can_access_organization) or a super admin.
--   * Only the assigned partner or a super admin can add / edit / remove.
--   * Uploaded files live in a PRIVATE bucket under <organization_id>/...,
--     guarded by the same rules. Learners open them through short-lived
--     signed URLs; nothing is public.
--   * Uploaded content stays in this organisation's records. It is never
--     shared with other organisations and is not sent to any AI model or
--     used for training.
-- ============================================================================

create table if not exists public.organization_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null default '',
  link text null,
  file_path text null,
  file_name text null,
  access_type text not null default 'free'
    check (access_type in ('free', 'paid')),
  price numeric(10, 2) null check (price is null or price >= 0),
  currency text not null default 'USD',
  estimated_minutes integer null check (estimated_minutes is null or estimated_minutes > 0),
  difficulty text not null default 'Beginner'
    check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  archived boolean not null default false,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_courses_paid_has_price
    check (access_type = 'free' or (price is not null and price > 0)),
  constraint organization_courses_has_content
    check (link is not null or file_path is not null),
  constraint organization_courses_file_in_org_folder
    check (file_path is null or split_part(file_path, '/', 1) = organization_id)
);

create index if not exists organization_courses_org_idx
  on public.organization_courses (organization_id, archived, created_at desc);

comment on table public.organization_courses is
  'Organisation-owned courses (custom course template). Visible only inside the owning organisation; never shared across tenants or used for AI training.';

drop trigger if exists organization_courses_set_updated_at on public.organization_courses;
create trigger organization_courses_set_updated_at
  before update on public.organization_courses
  for each row execute function public.set_updated_at();

alter table public.organization_courses enable row level security;

drop policy if exists organization_courses_select on public.organization_courses;
create policy organization_courses_select on public.organization_courses
  for select to authenticated
  using (
    public.is_super_admin()
    or public.partner_can_access_organization(organization_id)
    or (archived = false and public.shares_org_with(organization_id))
  );

drop policy if exists organization_courses_insert on public.organization_courses;
create policy organization_courses_insert on public.organization_courses
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.partner_can_access_organization(organization_id)
  );

drop policy if exists organization_courses_update on public.organization_courses;
create policy organization_courses_update on public.organization_courses
  for update to authenticated
  using (
    public.is_super_admin()
    or public.partner_can_access_organization(organization_id)
  )
  with check (
    public.is_super_admin()
    or public.partner_can_access_organization(organization_id)
  );

drop policy if exists organization_courses_delete on public.organization_courses;
create policy organization_courses_delete on public.organization_courses
  for delete to authenticated
  using (
    public.is_super_admin()
    or public.partner_can_access_organization(organization_id)
  );

grant select, insert, update, delete on public.organization_courses to authenticated;

-- ── Private file storage ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-course-files',
  'organization-course-files',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'video/mp4',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organization_course_files_select on storage.objects;
create policy organization_course_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'organization-course-files'
    and (
      public.is_super_admin()
      or public.partner_can_access_organization(split_part(name, '/', 1))
      or public.shares_org_with(split_part(name, '/', 1))
    )
  );

drop policy if exists organization_course_files_insert on storage.objects;
create policy organization_course_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'organization-course-files'
    and (
      public.is_super_admin()
      or public.partner_can_access_organization(split_part(name, '/', 1))
    )
  );

drop policy if exists organization_course_files_delete on storage.objects;
create policy organization_course_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'organization-course-files'
    and (
      public.is_super_admin()
      or public.partner_can_access_organization(split_part(name, '/', 1))
    )
  );
