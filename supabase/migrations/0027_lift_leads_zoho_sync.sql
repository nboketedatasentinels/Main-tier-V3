-- ============================================================================
-- T4L  ·  LIFT Leads → Zoho CRM sync (idempotency + audit)
-- 0027: add columns the `zoho-lead-sync` Edge Function writes back after it
--       creates the Zoho Lead, so retries never create a duplicate.
--
-- Flow: a completed lead (completed_at set) fires a Database Webhook -> the
-- Edge Function creates a Zoho Lead -> it writes `zoho_lead_id` back here. The
-- function SKIPS any row that already has `zoho_lead_id`, which also breaks the
-- webhook loop (the write-back UPDATE re-fires the webhook, but it no-ops).
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0025.
-- ============================================================================

alter table public.lift_leads
  add column if not exists zoho_lead_id    text,        -- Zoho Lead record id, set on success
  add column if not exists zoho_synced_at  timestamptz, -- when the push succeeded
  add column if not exists zoho_sync_error text;        -- last error (cleared on success)

-- Fast "needs sync" / "already synced" lookups and dedupe.
create unique index if not exists lift_leads_zoho_lead_id_key
  on public.lift_leads(zoho_lead_id)
  where zoho_lead_id is not null;

create index if not exists lift_leads_needs_zoho_sync_idx
  on public.lift_leads(completed_at)
  where completed_at is not null and zoho_lead_id is null;

-- NOTE: these columns are written ONLY by the Edge Function via the service
-- role (which bypasses RLS). The client-facing UPDATE policy from 0025 still
-- only allows updates while `completed_at is null`, so the public funnel can
-- never touch these audit columns. No policy changes needed.
