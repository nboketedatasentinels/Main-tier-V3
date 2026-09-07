-- ============================================================================
-- T4L  ·  Partner AI review decision + HITL audit
-- 0096: Persist whether the partner accepted / edited / rejected the AI grade,
--        and how long the review drawer was open (human-in-the-loop evidence).
-- ============================================================================

alter table public.programme_component_submissions
  add column if not exists ai_decision text
    check (ai_decision is null or ai_decision in ('accept', 'edit', 'reject')),
  add column if not exists ai_decision_at timestamptz,
  add column if not exists review_opened_at timestamptz,
  add column if not exists review_duration_ms integer
    check (review_duration_ms is null or review_duration_ms >= 0);

comment on column public.programme_component_submissions.ai_decision is
  'Partner choice on AI advisory grade: accept | edit | reject. Required for HITL proof.';
comment on column public.programme_component_submissions.ai_decision_at is
  'When the partner recorded their AI accept/edit/reject decision.';
comment on column public.programme_component_submissions.review_opened_at is
  'When the partner opened the review drawer for this save.';
comment on column public.programme_component_submissions.review_duration_ms is
  'Milliseconds the review drawer was open before save (HITL dwell time).';

create index if not exists pcs_ai_decision_idx
  on public.programme_component_submissions (ai_decision)
  where ai_decision is not null;
