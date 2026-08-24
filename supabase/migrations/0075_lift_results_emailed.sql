-- ============================================================================
-- T4L  ·  LIFT results email delivery
-- 0075: stamp when results were emailed + keep employer columns in sync on
--       anonymous lead completion (complete_lift_lead).
--
-- The UI promises email delivery to the learner work email and (when consented)
-- a copy to the employer. Delivery is handled by the send-lift-results-email
-- edge function; these columns support idempotency and admin visibility.
-- ============================================================================

alter table public.lift_leads
  add column if not exists results_emailed_at timestamptz;

alter table public.lift_assessments
  add column if not exists results_emailed_at timestamptz;

comment on column public.lift_leads.results_emailed_at is
  'When the LIFT results email (learner + employer copy if consented) was sent';
comment on column public.lift_assessments.results_emailed_at is
  'When the LIFT results email (learner + employer copy if consented) was sent';

-- Refresh complete_lift_lead so contact / employer columns stay aligned with
-- the final intake payload (not only the up-front createLiftLead insert).
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
declare
  v_share boolean;
  v_employer text;
begin
  v_share := lower(coalesce(p_intake->>'shareWithEmployer', '')) = 'yes';
  v_employer := nullif(lower(trim(coalesce(p_intake->>'employerEmail', ''))), '');

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
         first_name         = coalesce(nullif(trim(p_intake->>'firstName'), ''), first_name),
         last_name          = coalesce(nullif(trim(p_intake->>'lastName'), ''), last_name),
         email              = coalesce(nullif(lower(trim(p_intake->>'email')), ''), email),
         organisation       = coalesce(nullif(trim(p_intake->>'organisation'), ''), organisation),
         country            = coalesce(nullif(trim(p_intake->>'country'), ''), country),
         gender             = coalesce(nullif(trim(p_intake->>'gender'), ''), gender),
         age_range          = coalesce(nullif(trim(p_intake->>'ageRange'), ''), age_range),
         phone              = coalesce(nullif(trim(p_intake->>'phone'), ''), phone),
         share_with_employer = v_share,
         employer_email     = case when v_share then v_employer else null end,
         completed_at       = now()
   where id = p_id
     and completed_at is null;
end;
$$;

grant execute on function public.complete_lift_lead(
  uuid, jsonb, jsonb, int, int, int, int, int, text, text, text, text, boolean
) to anon, authenticated;
