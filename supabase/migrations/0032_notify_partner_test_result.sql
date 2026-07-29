-- Learner -> partner notification when a learner saves a personality/values
-- test results link on the weekly-glance dashboard.
--
-- notifications RLS (notifications_insert) requires is_partner_or_admin(), so a
-- learner cannot insert a notification directly. This SECURITY DEFINER RPC runs
-- as the table owner (bypassing RLS), resolves the caller's org transformation
-- partner from their own profile, and writes the notification for that partner.
-- It only ever writes a fixed-shape notification derived from auth.uid(), so it
-- can't be used to spam arbitrary users.

create or replace function public.notify_partner_test_result(p_kind text, p_results_url text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_org     text;
  v_name    text;
  v_partner uuid;
  v_label   text;
begin
  if v_uid is null then return; end if;

  select organization_id, coalesce(nullif(full_name, ''), email)
    into v_org, v_name
    from public.profiles where id = v_uid;
  if v_org is null then return; end if;

  select nullif(transformation_partner_id, '')::uuid
    into v_partner
    from public.organizations where id = v_org;
  if v_partner is null then return; end if;

  v_label := case when p_kind = 'personality' then '16Personalities' else 'Personal Values' end;

  insert into public.notifications (
    id, uid, type, notification_type, title, message, is_read, data, created_at, updated_at
  ) values (
    gen_random_uuid()::text, v_partner, 'engagement_alert', 'engagement_alert',
    coalesce(v_name, 'A learner') || ' shared ' || v_label || ' results',
    coalesce(v_name, 'A learner') || ' shared their ' || v_label
      || ' results link. Open it from their profile to verify.',
    false,
    jsonb_build_object('learnerId', v_uid, 'kind', p_kind, 'resultsUrl', p_results_url),
    now(), now()
  );
end;
$function$;

grant execute on function public.notify_partner_test_result(text, text) to authenticated;
