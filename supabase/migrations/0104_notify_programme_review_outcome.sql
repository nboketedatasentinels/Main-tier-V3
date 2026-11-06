-- ============================================================================
-- T4L  ·  Notify learner + super admins when a partner marks Pass / Fail
-- 0104: Partners review capstones / case studies / practicals on
--        /partner/programme-submissions. The learner's "Passed" notice was
--        written to Firestore (dead since the Supabase cutover) and a Fail sent
--        nothing, so learners never heard back and admins never knew.
--        This trigger writes bell notifications (public.notifications) to:
--          - the learner, with the partner's feedback, and
--          - every super_admin, so admins see every Pass and Fail.
--        Fires when status becomes approved / needs_revision, and again when a
--        partner re-saves a review (reviewed_at changes).
-- ============================================================================

create or replace function public.notify_programme_review_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passed boolean;
  v_title text;
  v_learner_name text;
  v_reviewer text;
  v_feedback text;
  v_admin uuid;
begin
  if new.status not in ('approved', 'needs_revision') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and old.reviewed_at is not distinct from new.reviewed_at then
    return new;
  end if;

  v_passed := new.status = 'approved';
  v_title := coalesce(
    nullif(trim(new.part_title), ''),
    nullif(trim(new.component_title), ''),
    'your submission'
  );
  v_reviewer := coalesce(nullif(trim(new.reviewer_name), ''), 'Your partner');
  v_feedback := nullif(trim(coalesce(new.partner_notes, '')), '');
  if v_feedback is not null and length(v_feedback) > 280 then
    v_feedback := left(v_feedback, 277) || '...';
  end if;

  select coalesce(nullif(trim(full_name), ''), nullif(trim(email), ''), 'A learner')
    into v_learner_name
    from public.profiles
   where id = new.user_id;

  -- Learner
  insert into public.notifications (
    id, uid, type, notification_type, category, title, message,
    is_read, related_id, data, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    new.user_id,
    'approval',
    'approval',
    'important_updates',
    case when v_passed then 'Passed: ' else 'Not passed yet: ' end || v_title,
    case
      when v_passed then v_reviewer || ' marked "' || v_title || '" as Pass.'
      else v_reviewer || ' marked "' || v_title || '" as Fail. Revise and resubmit.'
    end
      || coalesce(' Feedback: ' || v_feedback, ''),
    false,
    new.id::text,
    jsonb_build_object(
      'priority', 'push',
      'kind', 'programme_review_outcome',
      'outcome', case when v_passed then 'pass' else 'fail' end,
      'submissionId', new.id,
      'componentId', new.component_id,
      'componentType', new.component_type,
      'actionUrl', '/app/courses#programme-components'
    ),
    now(),
    now()
  );

  -- Super admins
  for v_admin in
    select p.id
      from public.profiles p
     where lower(trim(coalesce(p.role, ''))) = 'super_admin'
  loop
    insert into public.notifications (
      id, uid, type, notification_type, category, title, message,
      is_read, related_id, data, created_at, updated_at
    ) values (
      gen_random_uuid()::text,
      v_admin,
      'approval',
      'approval',
      'important_updates',
      coalesce(v_learner_name, 'A learner')
        || case when v_passed then ' passed ' else ' failed ' end
        || v_title,
      v_reviewer || ' marked "' || v_title || '" for '
        || coalesce(v_learner_name, 'a learner')
        || case when v_passed then ' as Pass.' else ' as Fail.' end,
      false,
      new.id::text,
      jsonb_build_object(
        'kind', 'programme_review_outcome',
        'outcome', case when v_passed then 'pass' else 'fail' end,
        'submissionId', new.id,
        'learnerId', new.user_id,
        'organizationId', new.organization_id,
        'componentId', new.component_id,
        'actionUrl', '/admin/programme-submissions'
      ),
      now(),
      now()
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists pcs_notify_review_outcome on public.programme_component_submissions;
create trigger pcs_notify_review_outcome
  after update of status, reviewed_at
  on public.programme_component_submissions
  for each row
  execute function public.notify_programme_review_outcome();

comment on function public.notify_programme_review_outcome() is
  'Bell-notify the learner and all super admins when a partner marks a programme submission Pass (approved) or Fail (needs_revision).';
