-- ============================================================================
-- T4L  ·  Interventions schema notes (live alignment)
-- 0071: Ensure interventions.id has a default so inserts never fail for
--        missing PK. App writes uid / partner_uid (not user_id / partner_id).
-- ============================================================================

alter table public.interventions
  alter column id set default gen_random_uuid()::text;

-- Keep partner/admin manage policies in place (idempotent).
drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions for select
  using (public.is_partner_or_admin());

drop policy if exists interventions_insert on public.interventions;
create policy interventions_insert on public.interventions for insert
  with check (public.is_partner_or_admin());

drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions for update
  using (public.is_partner_or_admin()) with check (public.is_partner_or_admin());
