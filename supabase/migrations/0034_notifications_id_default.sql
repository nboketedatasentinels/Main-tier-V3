-- notifications.id was NOT NULL with no default, so any insert that omitted id
-- failed with a not-null violation (23502). That broke admin Messaging
-- ("Could not send ... null value in column \"id\" of relation
-- \"notifications\"") and any other notification inserter that didn't supply an
-- id. Give the column a DB default so every insert path is covered.

alter table public.notifications
  alter column id set default gen_random_uuid()::text;
