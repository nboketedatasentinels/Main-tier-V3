-- ============================================================================
-- T4L  ·  Programme submissions — AI 50 / partner 50 grading schema
-- ============================================================================
-- Adds columns so Gemini can pre-grade Bank A (completeness/structure, max 50)
-- and the partner completes Bank B (judgment/context, max 50).
--
-- ai_grade jsonb shape (written by grade-submission Edge Function):
--   {
--     "status": "completed" | "error" | "pending",
--     "ai_score_50": 0-50,
--     "criteria": [...],
--     "feedback_for_partner": "...",
--     "feedback": "...",          -- legacy advisory field (branch grader)
--     "score": 0-100,             -- legacy advisory field (branch grader)
--     "pass": boolean,            -- legacy; unused once 50/50 prompts ship
--     "model": "gemini-...",
--     "answers_hash": "...",
--     "graded_at": "ISO-8601",
--     "error": "..."              -- when status = error
--   }
--
-- final_score is set by the partner review path as ai_score_50 + partner_score_50
-- (0-100). AI never changes status and never awards points.
-- ============================================================================

alter table public.programme_component_submissions
  add column if not exists ai_grade jsonb,
  add column if not exists partner_score_50 numeric
    check (partner_score_50 is null or (partner_score_50 >= 0 and partner_score_50 <= 50)),
  add column if not exists final_score numeric
    check (final_score is null or (final_score >= 0 and final_score <= 100));

comment on column public.programme_component_submissions.ai_grade is
  'Gemini Bank A grade (max 50). Advisory until partner completes Bank B; never awards points alone.';
comment on column public.programme_component_submissions.partner_score_50 is
  'Partner Bank B score (judgment/context), 0-50.';
comment on column public.programme_component_submissions.final_score is
  'Combined score: AI Bank A (0-50) + partner Bank B (0-50) = 0-100.';

create index if not exists pcs_ai_grade_status_idx
  on public.programme_component_submissions ((ai_grade->>'status'))
  where ai_grade is not null;
