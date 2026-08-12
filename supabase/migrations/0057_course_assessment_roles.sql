-- ============================================================================
-- T4L  ·  Course assessment roles + line manager
-- 0057: rater_role, line_manager_id, expand RLS for mentor/coach/LM
-- ============================================================================

-- Line manager assignment on the learner profile (partner-assignable).
alter table public.profiles
  add column if not exists line_manager_id uuid references public.profiles(id) on delete set null;

create index if not exists profiles_line_manager_id_idx
  on public.profiles (line_manager_id)
  where line_manager_id is not null;

comment on column public.profiles.line_manager_id is
  'Assigned line manager (rates learner Pre + Post course assessments).';

-- Who submitted: learner | line_manager | mentor | coach | partner
alter table public.course_assessment_responses
  add column if not exists rater_role text;

alter table public.course_assessment_responses
  drop constraint if exists course_assessment_responses_rater_role_check;

alter table public.course_assessment_responses
  add constraint course_assessment_responses_rater_role_check
  check (
    rater_role is null
    or rater_role in ('learner', 'line_manager', 'mentor', 'coach', 'partner')
  );

-- Backfill self rows
update public.course_assessment_responses
set rater_role = 'learner'
where audience = 'self' and rater_role is null;

create index if not exists course_assessment_responses_rater_role_idx
  on public.course_assessment_responses (subject_user_id, course_key, kind, rater_role);

-- ---------------------------------------------------------------------------
-- RLS: mentors / coaches / line managers can submit & read for their learners
-- ---------------------------------------------------------------------------

drop policy if exists course_assessment_responses_select on public.course_assessment_responses;
create policy course_assessment_responses_select
  on public.course_assessment_responses
  for select
  using (
    respondent_id = auth.uid()
    or subject_user_id = auth.uid()
    or public.is_partner_or_admin()
    or exists (
      select 1 from public.profiles s
      where s.id = course_assessment_responses.subject_user_id
        and (
          s.mentor_id::text = auth.uid()::text
          or s.ambassador_id::text = auth.uid()::text
          or s.line_manager_id = auth.uid()
        )
    )
  );

drop policy if exists course_assessment_responses_insert on public.course_assessment_responses;
create policy course_assessment_responses_insert
  on public.course_assessment_responses
  for insert
  with check (
    respondent_id = auth.uid()
    and (
      (audience = 'self' and subject_user_id = auth.uid() and coalesce(rater_role, 'learner') = 'learner')
      or (
        audience = 'external_rater'
        and subject_user_id <> auth.uid()
        and (
          public.is_partner_or_admin()
          or exists (
            select 1 from public.profiles s
            where s.id = subject_user_id
              and (
                (rater_role = 'mentor' and s.mentor_id::text = auth.uid()::text)
                or (rater_role = 'coach' and s.ambassador_id::text = auth.uid()::text)
                or (rater_role = 'line_manager' and s.line_manager_id = auth.uid())
              )
          )
        )
      )
    )
  );

drop policy if exists course_assessment_responses_update on public.course_assessment_responses;
create policy course_assessment_responses_update
  on public.course_assessment_responses
  for update
  using (respondent_id = auth.uid())
  with check (respondent_id = auth.uid());
