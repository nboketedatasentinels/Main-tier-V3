-- ============================================================================
-- T4L  ·  Mentorship goals save reliability (mentor + coach)
-- 0068: Mentors/coaches saving "I'm trying to achieve…" failed when:
--        1) org id fields didn't match exactly (company_id vs organization_id),
--        2) they weren't the row's mentor_id yet (first insert),
--        3) assignment is via profiles.mentor_id / ambassador_id rather than
--           shared org alone.
--        Broaden RLS so assigned + org leadership can always read/write.
-- ============================================================================

create or replace function public.can_manage_mentorship_goals(p_learner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_partner_or_admin()
    or p_learner_id = auth.uid()
    or exists (
      select 1
      from public.profiles learner
      join public.profiles me on me.id = auth.uid()
      where learner.id = p_learner_id
        and (
          -- Explicit assignment
          coalesce(nullif(trim(learner.mentor_id), ''), '') = me.id::text
          or coalesce(nullif(trim(learner.ambassador_id), ''), '') = me.id::text
          -- Org mentor / coach / ambassador peer
          or (
            lower(trim(coalesce(me.role, ''))) in ('mentor', 'ambassador', 'coach')
            and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
              is not null
            and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
              = coalesce(nullif(trim(learner.company_id), ''), nullif(trim(learner.organization_id), ''))
          )
        )
    );
$$;

revoke all on function public.can_manage_mentorship_goals(uuid) from public;
grant execute on function public.can_manage_mentorship_goals(uuid) to authenticated;

drop policy if exists mentorship_goals_select on public.mentorship_goals;
create policy mentorship_goals_select
  on public.mentorship_goals
  for select
  to authenticated
  using (
    public.can_manage_mentorship_goals(learner_id)
    or mentor_id = auth.uid()
  );

drop policy if exists mentorship_goals_insert on public.mentorship_goals;
create policy mentorship_goals_insert
  on public.mentorship_goals
  for insert
  to authenticated
  with check (public.can_manage_mentorship_goals(learner_id));

drop policy if exists mentorship_goals_update on public.mentorship_goals;
create policy mentorship_goals_update
  on public.mentorship_goals
  for update
  to authenticated
  using (public.can_manage_mentorship_goals(learner_id))
  with check (public.can_manage_mentorship_goals(learner_id));
