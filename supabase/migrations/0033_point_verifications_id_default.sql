-- point_verifications.id was NOT NULL with no default, so any insert that
-- omitted id failed with a not-null violation (23502) - which surfaced to
-- learners as "Could not submit proof. Please try again." The client now
-- supplies an id, but give the column a DB default too so no other insert path
-- (current or future) can hit the same failure.

alter table public.point_verifications
  alter column id set default gen_random_uuid()::text;
