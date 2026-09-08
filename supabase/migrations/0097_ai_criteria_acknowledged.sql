-- ============================================================================
-- T4L  ·  Partner must acknowledge "What good looks like" before deciding on AI
-- 0097: Anti-automation-bias — prove the human saw the rubric before Accept.
-- ============================================================================

alter table public.programme_component_submissions
  add column if not exists criteria_acknowledged boolean not null default false,
  add column if not exists criteria_acknowledged_at timestamptz;

comment on column public.programme_component_submissions.criteria_acknowledged is
  'Partner confirmed they compared the submission to What good looks like before deciding on the AI grade.';
comment on column public.programme_component_submissions.criteria_acknowledged_at is
  'When the partner acknowledged the rubric (HITL / anti-rubber-stamp evidence).';
