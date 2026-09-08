-- ============================================================================
-- T4L  ·  Learner dispute of AI grade (explain-itself / request human)
-- 0098: When no partner has reviewed, learner can disagree and request human review.
-- ============================================================================

alter table public.programme_component_submissions
  add column if not exists learner_disputed_at timestamptz,
  add column if not exists learner_dispute_note text;

comment on column public.programme_component_submissions.learner_disputed_at is
  'When the learner disputed the AI estimate and requested a human review.';
comment on column public.programme_component_submissions.learner_dispute_note is
  'Optional note from the learner explaining why they disagree with the AI.';
