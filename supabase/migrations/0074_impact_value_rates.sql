-- ============================================================================
-- T4L  ·  Impact value rates (admin)
-- 0074: Organisation / benchmark rates used by the Impact Log valuation engine.
-- ============================================================================

create table if not exists public.impact_value_rates (
  id uuid primary key default gen_random_uuid(),
  company_id text,
  status text not null default 'Published'
    check (status in ('Draft', 'Published')),
  scope text not null default 'Organisation'
    check (scope in ('Organisation', 'Global benchmark')),
  country text not null default 'Botswana',
  grade text not null,
  currency text not null default 'USD',
  annual_cost numeric not null default 0,
  paid_hours numeric not null default 1880,
  hourly numeric not null default 0,
  margin_per_unit numeric not null default 0,
  cost_per_defect numeric not null default 0,
  effective_from date,
  source text,
  approved_by text,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists impact_value_rates_company_idx
  on public.impact_value_rates (company_id, status);

alter table public.impact_value_rates enable row level security;

drop policy if exists impact_value_rates_select on public.impact_value_rates;
create policy impact_value_rates_select
  on public.impact_value_rates for select to authenticated
  using (
    public.is_partner_or_admin()
    or scope = 'Global benchmark'
    or company_id is null
    or company_id = (
      select nullif(trim(coalesce(p.company_id, p.organization_id::text, '')), '')
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    )
  );

drop policy if exists impact_value_rates_write on public.impact_value_rates;
create policy impact_value_rates_write
  on public.impact_value_rates for all to authenticated
  using (public.is_partner_or_admin())
  with check (public.is_partner_or_admin());

grant select, insert, update, delete on public.impact_value_rates to authenticated;

-- Seed global benchmarks once (idempotent by grade+country+scope).
insert into public.impact_value_rates (
  id, company_id, status, scope, country, grade, currency,
  annual_cost, paid_hours, hourly, margin_per_unit, cost_per_defect,
  effective_from, source, approved_by
)
select
  gen_random_uuid(), null, 'Published', 'Global benchmark', v.country, v.grade, 'USD',
  v.annual_cost, 1880, v.hourly, v.margin, v.defect,
  '2026-01-01'::date, 'T4L benchmark set', 'Indicative only'
from (values
  ('Sub-Saharan Africa', 'Any (blended)', 33840::numeric, 18::numeric, 100::numeric, 65::numeric),
  ('United States', 'Any (blended)', 97760::numeric, 52::numeric, 210::numeric, 140::numeric)
) as v(country, grade, annual_cost, hourly, margin, defect)
where not exists (
  select 1 from public.impact_value_rates r
  where r.scope = 'Global benchmark' and r.country = v.country and r.grade = v.grade
);
