# Database Schema

This directory contains the complete database schema for the T4L platform.

## Setup Instructions

1. Create a new Supabase project at https://supabase.com
2. Navigate to the SQL Editor in your Supabase dashboard
3. Run the `schema.sql` file to create all tables, indexes, and policies
4. Copy your Supabase URL and anon key to `.env`

## Database Structure

### Core Tables
- **profiles** - User profiles and settings
- **journeys** - Available transformation journeys
- **user_journeys** - User enrollment in journeys
- **activities** - Available activities with points
- **weekly_activities** - User activity completion tracking
- **courses** - Available courses
- **course_modules** - Course content modules
- **impact_logs** - User impact tracking
- **badges** - Achievement badges
- **user_badges** - Badges earned by users
- **villages** - Community groups
- **clusters** - Sub-groups within organizations
- **companies** - Organization profiles
- **events** - Platform events
- **notifications** - User notifications
- **subscriptions** - Payment subscriptions

### Security

All tables have Row Level Security (RLS) enabled with appropriate policies:
- Users can only access their own data
- Admins have elevated permissions
- Reference tables (journeys, activities, etc.) are publicly readable

## Migrations

For production deployments, use Supabase migrations:

```bash
# Create a new migration
supabase migration new migration_name

# Apply migrations
supabase db push
```

See the full schema.sql file for complete table definitions, indexes, and policies.
