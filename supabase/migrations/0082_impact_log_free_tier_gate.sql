-- ============================================================================
-- Free-tier Impact Log gate: lifetime submission counter (survives deletes)
-- ============================================================================
-- Product rule: free users may submit 2 impact logs ever. Deleting a log must
-- NOT reset the counter. Paid members / Impact Log Pro skip the gate.
-- ============================================================================

alter table public.profiles
  add column if not exists impact_log_lifetime_count integer not null default 0
    check (impact_log_lifetime_count >= 0);

alter table public.profiles
  add column if not exists impact_log_pro boolean not null default false;

comment on column public.profiles.impact_log_lifetime_count is
  'Monotonic count of impact_logs inserts for this user. Never decremented on delete.';
comment on column public.profiles.impact_log_pro is
  'True when the user has the Impact Log–only subscription (Stripe $5/mo product).';

create or replace function public.bump_impact_log_lifetime_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.uid is null then
    return new;
  end if;
  update public.profiles
  set impact_log_lifetime_count = coalesce(impact_log_lifetime_count, 0) + 1,
      updated_at = now()
  where id = new.uid;
  return new;
end;
$$;

drop trigger if exists trg_bump_impact_log_lifetime_count on public.impact_logs;
create trigger trg_bump_impact_log_lifetime_count
  after insert on public.impact_logs
  for each row
  execute function public.bump_impact_log_lifetime_count();

-- Backfill from existing rows (one-time; deletes already lost, so this is a floor).
update public.profiles p
set impact_log_lifetime_count = greatest(
  coalesce(p.impact_log_lifetime_count, 0),
  coalesce((
    select count(*)::integer from public.impact_logs il where il.uid = p.id
  ), 0)
);
