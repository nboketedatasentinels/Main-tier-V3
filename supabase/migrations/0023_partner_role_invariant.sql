-- ============================================================================
-- T4L  ·  Partner role invariant (Supabase)
-- 0023: make "the org's Transformation Partner is ALWAYS a partner" a hard,
-- self-healing rule enforced by the database - not something that depends on
-- the client calling an RPC at the right moment.
--
-- Source of truth = the organizations table:
--   * organizations.transformation_partner_id  (the linked partner's auth uid), or
--   * organizations.settings->>'partnerEmail'   (a partner assigned by email,
--                                                 before they have an account).
-- Any auth user whose uid or email matches one of those is, by definition, a
-- partner. This migration guarantees their profiles.role can never be anything
-- but 'partner' (super_admin is the one exception - it is never downgraded).
--
-- It works in BOTH directions and in any order:
--   * assign-then-signup : the profiles trigger promotes them the instant their
--                          row is created.
--   * signup-then-assign : the organizations trigger promotes + links the
--                          existing account the instant the admin assigns them.
-- And it is idempotent + safe to re-run. Run in the Supabase SQL editor AFTER
-- 0013 and 0022.
-- ============================================================================

-- Speed up the per-write lookups the triggers do (small table today, but this
-- keeps the invariant cheap forever).
create index if not exists idx_org_transformation_partner
  on public.organizations (transformation_partner_id);
create index if not exists idx_org_partner_email
  on public.organizations ((lower(settings->>'partnerEmail')));

-- ── is this account a designated transformation partner? ──────────────────────
create or replace function public.t4l_is_designated_partner(p_uid uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.organizations
     where (p_uid is not null and transformation_partner_id = p_uid::text)
        or (coalesce(p_email, '') <> ''
            and lower(coalesce(settings->>'partnerEmail', '')) = lower(p_email))
  );
$$;

-- ── profiles: force role = 'partner' for any designated partner ───────────────
-- BEFORE trigger so it can rewrite NEW.role. Never touches super_admin. This is
-- the core guarantee: a designated partner physically cannot be stored with any
-- other role, no matter which code path writes the row (signup trigger, org-code
-- enrollment, manual edit, a future feature - all of it).
create or replace function public.t4l_enforce_partner_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(NEW.role, '') = 'super_admin' then
    return NEW;
  end if;
  if public.t4l_is_designated_partner(NEW.id, NEW.email) then
    NEW.role := 'partner';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_partner_role_ins on public.profiles;
create trigger trg_enforce_partner_role_ins
  before insert on public.profiles
  for each row execute function public.t4l_enforce_partner_role();

-- On update we only need to re-check when the role or email actually changes -
-- routine writes (points, onboarding flags, etc.) skip the lookup entirely, and
-- any attempt to flip a designated partner's role is immediately corrected.
drop trigger if exists trg_enforce_partner_role_upd on public.profiles;
create trigger trg_enforce_partner_role_upd
  before update on public.profiles
  for each row
  when (OLD.role is distinct from NEW.role or OLD.email is distinct from NEW.email)
  execute function public.t4l_enforce_partner_role();

-- ── organizations: when a partner is assigned, promote + link the account ─────
-- BEFORE trigger so we can stamp NEW.transformation_partner_id (clearing the
-- "Pending: <email>" state) without a recursive UPDATE on organizations. If the
-- partner has no account yet we do nothing here - the profiles trigger above
-- catches them the moment they sign up.
create or replace function public.t4l_sync_org_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(coalesce(NEW.settings->>'partnerEmail', ''));
  v_uid      uuid;
  v_existing text[];
begin
  -- Resolve the partner account: an explicit link wins, else match the pending
  -- email to an existing account.
  if NEW.transformation_partner_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    v_uid := NEW.transformation_partner_id::uuid;
  elsif v_email <> '' then
    select id into v_uid from public.profiles where lower(email) = v_email limit 1;
    if v_uid is not null then
      NEW.transformation_partner_id := v_uid::text;  -- clears "Pending"
    end if;
  end if;

  if v_uid is null then
    return NEW;  -- no account yet; profiles trigger will promote them at signup
  end if;

  select coalesce(array(select jsonb_array_elements_text(data->'assignedOrganizations')), '{}')
    into v_existing
    from public.profiles
   where id = v_uid;

  if v_existing is null then
    return NEW;  -- partner profile not found (race); nothing to write yet
  end if;

  if not (NEW.id = any(v_existing)) then
    v_existing := v_existing || NEW.id;
  end if;

  -- Promote + link. The profiles BEFORE trigger also enforces 'partner', but we
  -- set it here so the change is immediate and self-contained.
  update public.profiles
     set role = case when role = 'super_admin' then role else 'partner' end,
         organization_id = coalesce(organization_id, NEW.id),
         data = jsonb_set(coalesce(data, '{}'::jsonb), '{assignedOrganizations}', to_jsonb(v_existing), true),
         updated_at = now()
   where id = v_uid;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_org_partner on public.organizations;
create trigger trg_sync_org_partner
  before insert or update on public.organizations
  for each row execute function public.t4l_sync_org_partner();

-- ── backfill: reconcile every existing organization right now ─────────────────
-- Touching each row fires trg_sync_org_partner, which links + promotes any
-- assigned partner who already has an account (e.g. abcdtrying@gmail.com,
-- transform@t4leader.com). Pending emails without an account are left as-is and
-- get promoted automatically when they sign up. Idempotent.
update public.organizations set updated_at = now();

revoke all on function public.t4l_is_designated_partner(uuid, text) from public;
