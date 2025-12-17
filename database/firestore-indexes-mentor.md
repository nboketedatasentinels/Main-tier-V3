# Mentor dashboard Firestore indexes

Composite indexes required for mentor dashboard queries. Create these in the Firebase console (Firestore Database → Indexes → Composite) or import via the Firebase CLI.

## mentorship_sessions: mentor_id + scheduled_at
- **Collection**: `mentorship_sessions`
- **Fields**:
  - `mentor_id` **Ascending**
  - `scheduled_at` **Descending**
- **Query support**: mentor calendar views filtered by mentor and sorted by time.

## mentor_notifications: mentor_id + read + created_at
- **Collection**: `mentor_notifications`
- **Fields**:
  - `mentor_id` **Ascending**
  - `read` **Ascending**
  - `created_at` **Descending**
- **Query support**: unread badge counts and notification list ordering per mentor.

## users: mentorId + last_active
- **Collection**: `users`
- **Fields**:
  - `mentorId` **Ascending**
  - `last_active` **Descending**
- **Query support**: mentee directories filtered by assigned mentor and sorted by last activity.

## users: assignedMentorId + last_active
- **Collection**: `users`
- **Fields**:
  - `assignedMentorId` **Ascending**
  - `last_active` **Descending**
- **Query support**: alternative mentor assignment field used by the mentee directory and risk checks.
