-- ============================================================================
-- T4L  ·  Mentorship multi-attendee meetings
-- 0073: Link sessions that share one meeting (e.g. "All mentees") via meeting_group_id
-- ============================================================================

alter table public.mentorship_sessions
  add column if not exists meeting_group_id uuid;

create index if not exists mentorship_sessions_meeting_group_id_idx
  on public.mentorship_sessions (meeting_group_id)
  where meeting_group_id is not null;



