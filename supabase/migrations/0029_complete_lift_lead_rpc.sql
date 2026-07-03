-- ============================================================================
-- T4L  ·  LIFT Leads — fix anonymous completion (SECURITY DEFINER RPC)
-- 0029: the public funnel could INSERT a lead (0024) but its later UPDATE to set
--       completed_at (0025) silently affected 0 ROWS for anonymous visitors.
--
-- ROOT CAUSE: PostgreSQL RLS requires a row to be VISIBLE via a SELECT policy
-- before an UPDATE ... WHERE can match it. `lift_leads` SELECT is
-- partner/admin-only (is_partner_or_admin()), so `anon` sees no rows, and the
-- funnel's `completeLiftLead` UPDATE matched nothing, wrote nothing, and threw
-- no error (PostgREST returns 200 / 0 rows). completed_at never got set, so the
-- Zoho sync trigger (0028) never fired. Every real website completion was lost.
--
-- We must NOT open SELECT to anon (that would let anyone enumerate every lead's
-- PII). Instead expose a SECURITY DEFINER function that runs as the owner,
-- bypasses RLS for this one controlled write, and completes a lead BY ID only if
-- it is not already completed. The client calls it via supabase.rpc(). The 0028
-- trigger still fires on the UPDATE this performs.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0028.
-- ============================================================================

create or replace function public.complete_lift_lead(
  p_id                 uuid,
  p_intake             jsonb,
  p_item_scores        jsonb,
  p_pillar_l           int,
  p_pillar_i           int,
  p_pillar_f           int,
  p_pillar_t           int,
  p_lift_index         int,
  p_archetype          text,
  p_development_edge   text,
  p_recommended_offer  text,
  p_lead_tier          text,
  p_coaching_triggered boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Complete the anonymous lead we created up-front. `completed_at is null`
  -- keeps this idempotent and one-shot: a finished lead stays immutable, and a
  -- bad/unknown id simply updates nothing (no error surface for anon).
  update public.lift_leads
     set intake             = p_intake,
         item_scores        = p_item_scores,
         pillar_l           = p_pillar_l,
         pillar_i           = p_pillar_i,
         pillar_f           = p_pillar_f,
         pillar_t           = p_pillar_t,
         lift_index         = p_lift_index,
         archetype          = p_archetype,
         development_edge   = p_development_edge,
         recommended_offer  = p_recommended_offer,
         lead_tier          = p_lead_tier,
         coaching_triggered = p_coaching_triggered,
         completed_at       = now()
   where id = p_id
     and completed_at is null;
end;
$$;

-- The public funnel is anonymous; allow it (and signed-in visitors) to call it.
grant execute on function public.complete_lift_lead(
  uuid, jsonb, jsonb, int, int, int, int, int, text, text, text, text, boolean
) to anon, authenticated;
