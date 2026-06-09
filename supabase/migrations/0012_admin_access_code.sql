-- ============================================================================
-- T4L  ·  Admin self-signup via shared access code
-- 0012: server-side admin elevation + role self-escalation lockdown
--
-- Lets anyone who knows the shared access code become a super_admin by signing
-- up (or, if already signed in, by entering the code). The code is validated
-- IN THE DATABASE - it is never shipped to the browser - and the role write
-- happens in a SECURITY DEFINER function, not via a client-updatable column.
--
-- Also closes a real hole: previously the profiles UPDATE policy let any user
-- set their own `role` to 'super_admin'. We revoke client UPDATE on the role
-- column so only this function (and service_role) can change roles.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0001/0010.
-- ============================================================================

-- ── lock down direct role writes from the browser (anon + authenticated) ──────
-- The trigger that provisions profiles INSERTs role (unaffected); this only
-- blocks UPDATEs to the role column by client roles. Other profile columns stay
-- user-updatable. service_role and the table owner keep full access.
revoke update (role) on public.profiles from anon, authenticated;

-- ── admin elevation, validated server-side ────────────────────────────────────
create or replace function public.claim_admin_access(access_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;

  -- Shared admin access code. To rotate it, change this string and re-run.
  if access_code is distinct from 't4l.ds.Admin.2024#' then
    return 'invalid_code';
  end if;

  -- Upsert, not a bare UPDATE: a fresh signup may call this before the
  -- on_auth_user_created trigger has materialised the profile row. A plain
  -- UPDATE would then match 0 rows, leave role = 'free_user', and STILL return
  -- 'ok' - exactly the bug that let "admins" land on the learner dashboard.
  insert into public.profiles (id, email, role)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'super_admin'
  )
  on conflict (id) do update
     set role = 'super_admin',
         updated_at = now();

  return 'ok';
end;
$$;

-- Only signed-in users may call it; the function itself checks the code.
revoke all on function public.claim_admin_access(text) from public;
grant execute on function public.claim_admin_access(text) to authenticated;
