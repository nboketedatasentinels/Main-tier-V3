-- ============================================================================
-- T4L  ·  LIFT leads: age_range contact field
-- 0054: add age_range column (parity with gender)
--
-- Captured on the public LIFT contact step and stored in intake jsonb as
-- `ageRange`. Mirror it to a dedicated column so partner/admin can list/filter
-- without digging into jsonb (same pattern as gender).
-- ============================================================================

alter table public.lift_leads
  add column if not exists age_range text;

comment on column public.lift_leads.age_range is
  'Demographic band from contact step: under_25 | 25_34 | 35_44 | 45_54 | 55_64 | 65_plus | prefer_not';
