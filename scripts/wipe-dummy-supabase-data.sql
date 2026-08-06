-- =============================================================================
-- T4L · Preview dummy data wipe (keeps super_admin / admin accounts)
-- =============================================================================
-- Prefer the Node helper for the actual wipe (handles auth.users too):
--
--   node scripts/wipe-dummy-supabase-data.mjs            # dry-run
--   node scripts/wipe-dummy-supabase-data.mjs --yes      # execute
--
-- Or preview with:
--   npx supabase db query --linked -f scripts/wipe-dummy-supabase-data.sql
-- =============================================================================

-- Kept
select id, email, role, full_name as name
from public.profiles
where lower(coalesce(role, '')) in ('super_admin', 'admin')
order by email;

-- Would be deleted
select id, email, role, full_name as name
from public.profiles
where lower(coalesce(role, '')) not in ('super_admin', 'admin')
order by email;

-- High-level counts
select 'non_admin_profiles' as bucket, count(*)::bigint as n
from public.profiles
where lower(coalesce(role, '')) not in ('super_admin', 'admin')
union all
select 'organizations', count(*)::bigint from public.organizations
union all
select 'invitations', count(*)::bigint from public.invitations
union all
select 'points_ledger', count(*)::bigint from public.points_ledger
union all
select 'checklists', count(*)::bigint from public.checklists
union all
select 'villages', count(*)::bigint from public.villages;
