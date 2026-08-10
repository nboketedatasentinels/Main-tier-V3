-- ============================================================================
-- T4L  ·  LIFT leads: employer share consent
-- 0055: share_with_employer + employer_email
--
-- Public funnel contact step lets a learner opt in to sharing their LIFT
-- results with an employer contact. Mirror into dedicated columns for
-- partner/admin filtering (full payload still lives in intake jsonb).
-- ============================================================================

alter table public.lift_leads
  add column if not exists share_with_employer boolean not null default false,
  add column if not exists employer_email text;

comment on column public.lift_leads.share_with_employer is
  'Learner consented to share LIFT results with their employer';
comment on column public.lift_leads.employer_email is
  'Employer contact email when share_with_employer is true';

create index if not exists lift_leads_employer_email_idx
  on public.lift_leads(employer_email)
  where employer_email is not null;
