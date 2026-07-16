-- Auto-archive organizations whose program end date has passed.
--
-- End date = cohort_start_date + duration, where duration weeks =
-- COALESCE(program_duration_weeks, round(settings.programDurationMonths * 4)).
-- Orgs with no cohort_start_date (or no determinable duration) are left alone.
--
-- Archiving sets settings.archived = true + settings.archivedAt, which the admin
-- UI reads to route the org into the "Organization Archive" section.
--
-- Runs two ways: (1) daily via pg_cron (below), and (2) on-demand from the admin
-- console load (supabaseOrgService.archiveExpiredOrganizations -> this RPC).

create or replace function public.archive_expired_organizations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.organizations o
  set settings = jsonb_set(
                   jsonb_set(coalesce(o.settings, '{}'::jsonb), '{archived}', 'true'::jsonb, true),
                   '{archivedAt}', to_jsonb(now()::text), true),
      updated_at = now()
  where o.cohort_start_date is not null
    and coalesce(o.program_duration_weeks, round((o.settings->>'programDurationMonths')::numeric * 4)) is not null
    and (o.cohort_start_date
         + (coalesce(o.program_duration_weeks, round((o.settings->>'programDurationMonths')::numeric * 4)) * interval '7 days')) < now()
    and coalesce(o.settings->>'archived', 'false') <> 'true';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.archive_expired_organizations() to authenticated;

-- Daily background run at 02:00 UTC (requires the pg_cron extension).
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'archive-expired-organizations';

select cron.schedule(
  'archive-expired-organizations',
  '0 2 * * *',
  'select public.archive_expired_organizations();'
);
