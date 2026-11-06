-- ============================================================================
-- T4L  ·  Record learner consent to AI-assisted grading (Google Gemini)
-- 0105: Learners now see a notice before submitting work that Gemini
--        pre-grades. They must tick "I agree" on capstone / case study /
--        practical pages; on course podcast assessments the AI step is skipped
--        without consent. The time they agreed is stored here, and the
--        grade-submission Edge Function only calls Gemini when it is set.
-- ============================================================================

alter table public.programme_component_submissions
  add column if not exists ai_consent_at timestamptz;

comment on column public.programme_component_submissions.ai_consent_at is
  'When the learner agreed that their written answers may be sent to Google Gemini for an advisory grade (a partner makes the final decision). Null = no consent; Gemini is not called.';
