-- ============================================================================
-- T4L  ·  Course assessment report email send log
-- 0058: partners email combined Pre/Post (+ rater) reports; keep a send log
-- ============================================================================

create table if not exists public.course_assessment_report_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  organization_name text,
  sent_by uuid not null references public.profiles(id) on delete cascade,
  recipients jsonb not null default '[]'::jsonb,
  recipient_roles text[] not null default '{}',
  subject text not null,
  body_preview text,
  report_snapshot jsonb not null default '{}'::jsonb,
  learner_count int not null default 0,
  status text not null check (status in ('sent', 'partial', 'failed')),
  error_message text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists course_assessment_report_sends_org_idx
  on public.course_assessment_report_sends (organization_id, sent_at desc);

create index if not exists course_assessment_report_sends_sender_idx
  on public.course_assessment_report_sends (sent_by, sent_at desc);

alter table public.course_assessment_report_sends enable row level security;

drop policy if exists course_assessment_report_sends_select on public.course_assessment_report_sends;
create policy course_assessment_report_sends_select
  on public.course_assessment_report_sends
  for select
  using (public.is_partner_or_admin());

drop policy if exists course_assessment_report_sends_insert on public.course_assessment_report_sends;
create policy course_assessment_report_sends_insert
  on public.course_assessment_report_sends
  for insert
  with check (
    public.is_partner_or_admin()
    and sent_by = auth.uid()
  );

comment on table public.course_assessment_report_sends is
  'Log of partner-emailed course assessment org reports (sponsor/HR/senior mgmt/line manager).';
