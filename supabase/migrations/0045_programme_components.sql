-- ============================================================================
-- T4L  ·  Programme components (catalog) + learner submissions
-- 0045: persist Practitioner Capstones A/B/C (and other Starter Kit parts)
--       in Postgres, and ensure submissions can be saved for free (no-org)
--       practitioners as well as org learners.
--
-- WHY: Capstone HTML forms write to `programme_component_submissions` via
-- `/capstones/_capstone-runtime.js`, but there was no migration creating the
-- table or seeding the Starter Kit Combined Capstone parts. Free practitioners
-- (no organization_id) also need RLS that does not require an org.
--
-- Safe to re-run (idempotent).
-- ============================================================================

-- ── Catalog: which deliverables exist per pillar ────────────────────────────
create table if not exists public.programme_components (
  id text primary key,
  pillar text not null,
  component_type text not null check (component_type in ('capstone', 'case_study', 'practical')),
  parent_id text null references public.programme_components(id) on delete cascade,
  part_id text null,
  title text not null,
  description text null,
  href text null,
  sort_order int not null default 0,
  status text not null default 'available'
    check (status in ('available', 'coming_soon', 'locked')),
  journey_label text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programme_components_pillar_idx
  on public.programme_components(pillar, component_type, sort_order);

drop trigger if exists programme_components_set_updated_at on public.programme_components;
create trigger programme_components_set_updated_at
  before update on public.programme_components
  for each row execute function public.set_updated_at();

alter table public.programme_components enable row level security;

drop policy if exists programme_components_select on public.programme_components;
create policy programme_components_select on public.programme_components
  for select to authenticated
  using (true);

drop policy if exists programme_components_write on public.programme_components;
create policy programme_components_write on public.programme_components
  for all to authenticated
  using (public.is_partner_or_admin())
  with check (public.is_partner_or_admin());

grant select on public.programme_components to authenticated;
grant select, insert, update, delete on public.programme_components to authenticated;

-- ── Seed: Digital Transformation Starter Kit (Practitioner pathway) ─────────
-- Parent Combined Capstone + Parts A / B / C (the three Practitioner Capstones).
insert into public.programme_components
  (id, pillar, component_type, parent_id, part_id, title, description, href, sort_order, status, journey_label)
values
  (
    'starter-kit-capstone',
    'starter_kit',
    'capstone',
    null,
    null,
    'Combined Capstone (3 parts)',
    'Three parts marked together: One-Page Proposal, Project Scope Document, and Status Report. All required.',
    null,
    10,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-capstone-part-a',
    'starter_kit',
    'capstone',
    'starter-kit-capstone',
    'starter-kit-capstone-part-a',
    'Part A · One-Page Proposal',
    'First Practitioner Capstone. Closes Think Like an Owner (Week 2). Audience-matched pitch.',
    '/capstones/starter-kit-capstone-part-a.html',
    11,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-capstone-part-b',
    'starter_kit',
    'capstone',
    'starter-kit-capstone',
    'starter-kit-capstone-part-b',
    'Part B · Project Scope Document',
    'Second Practitioner Capstone. Closes Lead Like a Pro (Week 6). Objectives, methodology, risks.',
    '/capstones/starter-kit-capstone-part-b.html',
    12,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-capstone-part-c',
    'starter_kit',
    'capstone',
    'starter-kit-capstone',
    'starter-kit-capstone-part-c',
    'Part C · Status Report',
    'Third Practitioner Capstone. Closes Project Leadership Discipline. Risk-led mid-flight report.',
    '/capstones/starter-kit-capstone-part-c.html',
    13,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-case-study',
    'starter_kit',
    'case_study',
    null,
    null,
    'Combined Case Studies (4 parts)',
    'Four case studies marked together. Case Study 1: Nadella. Case Study 2: Kodak. Case Study 3: Okonjo-Iweala. Case Study 4: SARS. Combined weight 30% of competence pass.',
    null,
    20,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-case-study-1',
    'starter_kit',
    'case_study',
    'starter-kit-case-study',
    'starter-kit-case-study-1',
    'Part 1 · The Pattern That Was Costing the Company',
    'First Practitioner Case Study. Satya Nadella''s first year at Microsoft, 2014. Pattern recognition under pressure.',
    '/capstones/starter-kit-case-study-1.html',
    21,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-case-study-2',
    'starter_kit',
    'case_study',
    'starter-kit-case-study',
    'starter-kit-case-study-2',
    'Part 2 · The Pitch That Did Not Land',
    'Second Practitioner Case Study. Kodak and the digital camera, 1975–1996. Opportunity recognition and audience-matched framing.',
    '/capstones/starter-kit-case-study-2.html',
    22,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-case-study-3',
    'starter_kit',
    'case_study',
    'starter-kit-case-study',
    'starter-kit-case-study-3',
    'Part 3 · Telling My Story Is Risky',
    'Third Practitioner Case Study. Ngozi Okonjo-Iweala and the cost of leading, Nigeria 2012. Shame patterns and strategic vulnerability.',
    '/capstones/starter-kit-case-study-3.html',
    23,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-case-study-4',
    'starter_kit',
    'case_study',
    'starter-kit-case-study',
    'starter-kit-case-study-4',
    'Part 4 · The Modernisation That Was Dismantled',
    'Fourth Practitioner Case Study. South African Revenue Service, 2014–2018. Scope discipline, escalation, and senior reporting under pressure.',
    '/capstones/starter-kit-case-study-4.html',
    24,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-practical',
    'starter_kit',
    'practical',
    null,
    null,
    'Practicals Portfolio (6 parts)',
    'Six weekly practicals across the Journey. All required.',
    null,
    30,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-practical-1',
    'starter_kit',
    'practical',
    'starter-kit-practical',
    'starter-kit-practical-1',
    'Practical 1 · Opportunity Map',
    'Week 1 - three named AI/digital opportunities in your current scope.',
    '/capstones/starter-kit-practical-1.html',
    31,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-practical-2',
    'starter_kit',
    'practical',
    'starter-kit-practical',
    'starter-kit-practical-2',
    'Practical 2 · Stakeholder Position Paper',
    'Week 2 - map and position five key stakeholders.',
    '/capstones/starter-kit-practical-2.html',
    32,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-practical-3',
    'starter_kit',
    'practical',
    'starter-kit-practical',
    'starter-kit-practical-3',
    'Practical 3 · Methodology Justification',
    'Week 3 - defend the delivery approach you would actually run.',
    '/capstones/starter-kit-practical-3.html',
    33,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-practical-4',
    'starter_kit',
    'practical',
    'starter-kit-practical',
    'starter-kit-practical-4',
    'Practical 4 · Risk Register Draft',
    'Week 4 - name the real risks, owners, and mitigations.',
    '/capstones/starter-kit-practical-4.html',
    34,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-practical-5',
    'starter_kit',
    'practical',
    'starter-kit-practical',
    'starter-kit-practical-5',
    'Practical 5 · Stakeholder Briefing Script',
    'Week 5 - the script you would use in the room.',
    '/capstones/starter-kit-practical-5.html',
    35,
    'available',
    'The Transformation Practitioner'
  ),
  (
    'starter-kit-practical-6',
    'starter_kit',
    'practical',
    'starter-kit-practical',
    'starter-kit-practical-6',
    'Practical 6 · Lessons Synthesis',
    'Week 6 - synthesise patterns across Practicals 1–5 and commit to one 90-day growth edge.',
    '/capstones/starter-kit-practical-6.html',
    36,
    'available',
    'The Transformation Practitioner'
  )
on conflict (id) do update set
  pillar = excluded.pillar,
  component_type = excluded.component_type,
  parent_id = excluded.parent_id,
  part_id = excluded.part_id,
  title = excluded.title,
  description = excluded.description,
  href = excluded.href,
  sort_order = excluded.sort_order,
  status = excluded.status,
  journey_label = excluded.journey_label,
  updated_at = now();

-- ── Seed: Leading Self in the Age of AI (Practicals Portfolio) ─────────────
insert into public.programme_components
  (id, pillar, component_type, parent_id, part_id, title, description, href, sort_order, status, journey_label)
values
  (
    'leading-self-practical',
    'leading_self',
    'practical',
    null,
    null,
    'Practicals Portfolio (6 parts)',
    'Six weekly practicals across the Leading Self in the Age of AI Journey. All required; together they form the Practicals Portfolio component.',
    null,
    30,
    'available',
    'Leading Self in the Age of AI'
  ),
  (
    'leading-self-practical-1',
    'leading_self',
    'practical',
    'leading-self-practical',
    'leading-self-practical-1',
    'Practical 1 · Pattern Profile',
    'Week 1 - name how you default under pressure: one pattern, three real moments, the belief underneath.',
    '/capstones/leading-self-practical-1.html',
    31,
    'available',
    'Leading Self in the Age of AI'
  ),
  (
    'leading-self-practical-2',
    'leading_self',
    'practical',
    'leading-self-practical',
    'leading-self-practical-2',
    'Practical 2 · Protocol Card',
    'Week 2 - build the named protocol you deploy when the pattern fires, then practise it for five days.',
    '/capstones/leading-self-practical-2.html',
    32,
    'available',
    'Leading Self in the Age of AI'
  ),
  (
    'leading-self-practical-3',
    'leading_self',
    'practical',
    'leading-self-practical',
    'leading-self-practical-3',
    'Practical 3 · Mindset Action Plan Draft',
    'Week 3 - the working draft that feeds your Capstone: replacement belief, new behaviour, 30-day metric.',
    '/capstones/leading-self-practical-3.html',
    33,
    'available',
    'Leading Self in the Age of AI'
  ),
  (
    'leading-self-practical-4',
    'leading_self',
    'practical',
    'leading-self-practical',
    'leading-self-practical-4',
    'Practical 4 · Carrying Inventory',
    'Week 4 - take stock of the masks you carry into high-stakes rooms, then choose what to put down.',
    '/capstones/leading-self-practical-4.html',
    34,
    'available',
    'Leading Self in the Age of AI'
  ),
  (
    'leading-self-practical-5',
    'leading_self',
    'practical',
    'leading-self-practical',
    'leading-self-practical-5',
    'Practical 5 · Trigger Map',
    'Week 5 - map one trigger in detail: body signal, old action, pause point, deliberate alternative.',
    '/capstones/leading-self-practical-5.html',
    35,
    'available',
    'Leading Self in the Age of AI'
  ),
  (
    'leading-self-practical-6',
    'leading_self',
    'practical',
    'leading-self-practical',
    'leading-self-practical-6',
    'Practical 6 · Accountability Brief',
    'Week 6 - name who holds you to the work, the cadence, the truth-telling territory, and the first ask.',
    '/capstones/leading-self-practical-6.html',
    36,
    'available',
    'Leading Self in the Age of AI'
  )
on conflict (id) do update set
  pillar = excluded.pillar,
  component_type = excluded.component_type,
  parent_id = excluded.parent_id,
  part_id = excluded.part_id,
  title = excluded.title,
  description = excluded.description,
  href = excluded.href,
  sort_order = excluded.sort_order,
  status = excluded.status,
  journey_label = excluded.journey_label,
  updated_at = now();

-- ── Learner submissions ─────────────────────────────────────────────────────
create table if not exists public.programme_component_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id text null,
  component_id text not null,
  component_type text null,
  component_title text null,
  pillar text null,
  part_id text null,
  part_title text null,
  answers jsonb not null default '{}'::jsonb,
  answer_count int not null default 0,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'approved', 'needs_revision')),
  submitted_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  resubmitted_at timestamptz null,
  source_page text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null,
  reviewer_name text null,
  partner_notes text null,
  score numeric null,
  created_at timestamptz not null default now(),
  unique (user_id, component_id)
);

create index if not exists pcs_org_updated_idx
  on public.programme_component_submissions(organization_id, last_updated_at desc);

create index if not exists pcs_user_idx
  on public.programme_component_submissions(user_id, last_updated_at desc);

create index if not exists pcs_pillar_component_idx
  on public.programme_component_submissions(pillar, component_id);

create index if not exists pcs_null_org_practitioner_idx
  on public.programme_component_submissions(last_updated_at desc)
  where organization_id is null;

drop trigger if exists pcs_set_updated_at on public.programme_component_submissions;
create trigger pcs_set_updated_at
  before update on public.programme_component_submissions
  for each row execute function public.set_updated_at();

-- Map last_updated_at via set_updated_at only if the helper updates `updated_at`.
-- Our column is last_updated_at — keep a dedicated trigger.
drop trigger if exists pcs_set_updated_at on public.programme_component_submissions;

create or replace function public.pcs_touch_last_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

drop trigger if exists pcs_touch_last_updated on public.programme_component_submissions;
create trigger pcs_touch_last_updated
  before update on public.programme_component_submissions
  for each row execute function public.pcs_touch_last_updated_at();

alter table public.programme_component_submissions enable row level security;

-- Learners read/write their own rows (including free practitioners with null org).
drop policy if exists pcs_select on public.programme_component_submissions;
create policy pcs_select on public.programme_component_submissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_partner_or_admin()
    or public.is_super_admin()
  );

drop policy if exists pcs_insert on public.programme_component_submissions;
create policy pcs_insert on public.programme_component_submissions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists pcs_update on public.programme_component_submissions;
create policy pcs_update on public.programme_component_submissions
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_partner_or_admin()
    or public.is_super_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_partner_or_admin()
    or public.is_super_admin()
  );

grant select, insert, update on public.programme_component_submissions to authenticated;

-- Realtime for partner review dashboards
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'programme_component_submissions'
     )
  then
    alter publication supabase_realtime add table public.programme_component_submissions;
  end if;
end $$;
