-- ============================================================================
-- T4L  ·  LIFT Leads → Zoho sync webhook (LOOP-SAFE trigger)
-- 0028: replaces the dashboard Database Webhook with a trigger that has a WHEN
--       condition, so the function's OWN write-backs never re-fire it.
--
-- The dashboard webhook fired on EVERY insert/update. Because the function
-- writes zoho_lead_id / zoho_sync_error back to the row (an UPDATE), it
-- retriggered itself — an infinite loop that hammered Zoho's token endpoint.
--
-- The WHEN clause below fires ONLY for a lead that is completed, not yet synced,
-- and has no recorded error:
--   * success write-back sets zoho_lead_id  -> WHEN false -> no re-fire
--   * error   write-back sets zoho_sync_error -> WHEN false -> no re-fire
--   * a brand-new completed lead             -> WHEN true  -> fires once
-- A lead that errored won't auto-retry (its zoho_sync_error is set); to retry,
-- clear that column and it becomes eligible again.
--
-- PREREQUISITE: delete the dashboard "zoho-lead-sync-webhook" first, so this is
-- the only trigger (otherwise both fire). Run in the Supabase SQL editor.
-- ============================================================================

drop trigger if exists zoho_lead_sync_trigger on public.lift_leads;

create trigger zoho_lead_sync_trigger
  after insert or update on public.lift_leads
  for each row
  when (
    new.completed_at is not null
    and new.zoho_lead_id is null
    and new.zoho_sync_error is null
  )
  execute function supabase_functions.http_request(
    'https://ivcrnrsrgbloefcgyxim.supabase.co/functions/v1/zoho-lead-sync',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer 239fa7f35ebc88dc114010a0431605da3ae2a199e9c63136"}',
    '{}',
    '5000'
  );
