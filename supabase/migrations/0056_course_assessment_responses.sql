-- ============================================================================
-- T4L  ·  Native course Pre/Post assessments
-- 0056: course_assessment_responses table + RLS
--
-- Replaces SurveyMonkey for Pre/Post course assessments. Definitions live in
-- app config (imported from SurveyMonkey); this table stores submitted answers.
--
-- Self assessments: respondent_id = subject_user_id (the learner).
-- External rater: respondent rates subject_user_id (learner).
-- ============================================================================

create table if not exists public.course_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  respondent_id uuid not null references public.profiles(id) on delete cascade,
  subject_user_id uuid not null references public.profiles(id) on delete cascade,
  course_key text not null,
  course_title text,
  kind text not null check (kind in ('pre', 'post')),
  audience text not null check (audience in ('self', 'external_rater')),
  assessment_title text,
  surveymonkey_id text,
  answers jsonb not null default '{}'::jsonb,
  score_sum numeric,
  score_count int,
  score_avg numeric,
  rater_relationship text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One self/rater submission per learner × course × kind × audience.
alter table public.course_assessment_responses
  drop constraint if exists course_assessment_responses_unique;

alter table public.course_assessment_responses
  add constraint course_assessment_responses_unique
  unique (respondent_id, subject_user_id, course_key, kind, audience);

create index if not exists course_assessment_responses_subject_idx
  on public.course_assessment_responses (subject_user_id, kind, submitted_at desc);

create index if not exists course_assessment_responses_respondent_idx
  on public.course_assessment_responses (respondent_id, submitted_at desc);

create index if not exists course_assessment_responses_course_idx
  on public.course_assessment_responses (course_key, kind);

alter table public.course_assessment_responses enable row level security;

drop policy if exists course_assessment_responses_select on public.course_assessment_responses;
create policy course_assessment_responses_select
  on public.course_assessment_responses
  for select
  using (
    respondent_id = auth.uid()
    or subject_user_id = auth.uid()
    or public.is_partner_or_admin()
  );

drop policy if exists course_assessment_responses_insert on public.course_assessment_responses;
create policy course_assessment_responses_insert
  on public.course_assessment_responses
  for insert
  with check (
    respondent_id = auth.uid()
    and (
      -- Self assessment about yourself
      (audience = 'self' and subject_user_id = auth.uid())
      -- External rater about a learner (partner/admin for now; mentor/coach later)
      or (audience = 'external_rater' and public.is_partner_or_admin())
    )
  );

drop policy if exists course_assessment_responses_update on public.course_assessment_responses;
create policy course_assessment_responses_update
  on public.course_assessment_responses
  for update
  using (respondent_id = auth.uid())
  with check (respondent_id = auth.uid());

comment on table public.course_assessment_responses is
  'Native Pre/Post course assessment submissions (self + external rater).';
