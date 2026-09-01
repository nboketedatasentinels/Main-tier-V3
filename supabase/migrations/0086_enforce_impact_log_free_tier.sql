-- ============================================================================
-- Enforce free Impact Log cap server-side (2 lifetime submits).
-- Client checks can be bypassed or stale; this is the source of truth.
-- ============================================================================

create or replace function public.enforce_impact_log_free_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_membership text;
  v_pro boolean;
  v_count integer;
begin
  if new.uid is null then
    return new;
  end if;

  select
    lower(trim(coalesce(p.role::text, ''))),
    lower(trim(coalesce(p.membership_status::text, ''))),
    coalesce(p.impact_log_pro, false),
    coalesce(p.impact_log_lifetime_count, 0)
  into v_role, v_membership, v_pro, v_count
  from public.profiles p
  where p.id = new.uid;

  if not found then
    return new;
  end if;

  -- Impact Log Pro or paid membership: unlimited.
  if v_pro or v_membership = 'paid' then
    return new;
  end if;

  -- Staff / paid roles: unlimited.
  if v_role in (
    'paid_member',
    'mentor',
    'ambassador',
    'partner',
    'super_admin',
    'admin',
    'company_admin'
  ) then
    return new;
  end if;

  -- Free learners (and blank role treated as free).
  if v_role in ('user', 'free_user', '') or v_membership = 'free' then
    if v_count >= 2 then
      raise exception 'impact_log_free_limit_reached'
        using errcode = 'P0001',
              hint = 'Free accounts get 2 Impact Log entries for life. Upgrade to keep logging.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_impact_log_free_tier on public.impact_logs;
create trigger trg_enforce_impact_log_free_tier
  before insert on public.impact_logs
  for each row
  execute function public.enforce_impact_log_free_tier();

comment on function public.enforce_impact_log_free_tier() is
  'Blocks free users from inserting a 3rd+ impact_logs row. Deleting does not reset lifetime count.';
