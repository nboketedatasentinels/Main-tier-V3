-- ============================================================================
-- T4L  ·  Podcast progress (per-user, per-podcast)
-- 0021: podcast_progress table + RLS
--
-- Replaces the Firestore podcastProgress/{uid} document (one doc with a
-- `podcasts` map). Here it is one row per (uid, podcast_id): whether the
-- learner watched the episode, their quiz pass state / best score / attempts,
-- and when points were awarded (so points are granted at most once).
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0001.
-- ============================================================================

create table if not exists public.podcast_progress (
  uid                uuid        not null references public.profiles(id) on delete cascade,
  podcast_id         text        not null,
  watched            boolean     not null default false,
  watched_at         timestamptz,
  passed             boolean     not null default false,
  best_score         int         not null default 0,
  attempts           int         not null default 0,
  points_awarded_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (uid, podcast_id)
);

create index if not exists podcast_progress_uid_idx on public.podcast_progress(uid);

drop trigger if exists podcast_progress_set_updated_at on public.podcast_progress;
create trigger podcast_progress_set_updated_at before update on public.podcast_progress
  for each row execute function public.set_updated_at();

-- ── RLS: owner reads/writes their own rows; partner/admin read all ──
alter table public.podcast_progress enable row level security;

drop policy if exists podcast_progress_select on public.podcast_progress;
create policy podcast_progress_select on public.podcast_progress for select
  using (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists podcast_progress_insert on public.podcast_progress;
create policy podcast_progress_insert on public.podcast_progress for insert
  with check (uid = auth.uid());

drop policy if exists podcast_progress_update on public.podcast_progress;
create policy podcast_progress_update on public.podcast_progress for update
  using (uid = auth.uid()) with check (uid = auth.uid());
