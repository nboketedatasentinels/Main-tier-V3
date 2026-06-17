-- ============================================================================
-- T4L  ·  0015: admin write access on profiles (Firestore -> Supabase cutover)
--
-- The admin User Management screen changes other users' role / membership /
-- access and deletes accounts. Under Supabase auth those writes hit
-- public.profiles, whose only write policy was the "own row" rule
-- (id = auth.uid()). So a super_admin editing ANOTHER user's row was denied -
-- which is the "permission denied / admin role missing" the admin console hit
-- once user mutations moved off Firestore.
--
-- This adds super_admin UPDATE + DELETE policies on profiles, gated by the
-- existing is_super_admin() helper (migration 0001). is_super_admin() is true
-- only when the CALLER is already super_admin, so a normal user cannot use these
-- to escalate themselves - it does not open a self-escalation path. The existing
-- "own row" policies are left intact.
--
-- Idempotent. Run in the Supabase SQL editor AFTER 0001.
-- ============================================================================

-- super_admin may update any profile (role, membership, access, status)
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- super_admin may delete a profile row (account removal). Note: deleting the
-- auth.users record itself still requires a server-side service-role call;
-- this only removes the public.profiles row.
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete
  using (public.is_super_admin());
