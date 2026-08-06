#!/usr/bin/env node
/**
 * Wipe dummy / test data from the linked Supabase project.
 * Keeps super_admin (and legacy admin) profiles + their auth.users rows.
 *
 * Usage:
 *   node scripts/wipe-dummy-supabase-data.mjs            # dry-run (default)
 *   node scripts/wipe-dummy-supabase-data.mjs --yes      # actually delete
 *
 * Requires in env (or .env.local):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const args = new Set(process.argv.slice(2))
const EXECUTE = args.has('--yes') || args.has('-y')
const HELP = args.has('--help') || args.has('-h')

if (HELP) {
  console.log(`Wipe dummy Supabase data (keep super_admin accounts)

  node scripts/wipe-dummy-supabase-data.mjs         # dry-run
  node scripts/wipe-dummy-supabase-data.mjs --yes   # delete for real
`)
  process.exit(0)
}

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ADMIN_ROLES = new Set(['super_admin', 'admin'])

/** Tables we never wipe (catalogue / config). */
const PRESERVE_TABLES = new Set([
  'activity_catalog',
  'badges',
  'courses',
  'journey_activities',
  'journey_configs',
  'nudge_templates',
  'platform_config',
  'programme_components',
  'programme_notification_templates',
  'inspiration_quotes',
  'automation_rules',
  'notification_settings',
  'migration_runs',
])

/**
 * User-owned tables + the column that points at profiles.id / auth.users.id.
 * Unknown / missing tables are skipped.
 */
const USER_TABLES = [
  ['points_ledger', 'uid'],
  ['checklists', 'uid'],
  ['weekly_progress', 'uid'],
  ['window_progress', 'uid'],
  ['impact_logs', 'uid'],
  ['podcast_progress', 'uid'],
  ['notifications', 'uid'],
  ['user_courses', 'uid'],
  ['user_badges', 'uid'],
  ['user_engagement', 'uid'],
  ['user_journeys', 'uid'],
  ['lift_assessments', 'uid'],
  ['lift_assessment_history', 'uid'],
  ['lift_progress', 'uid'],
  ['programme_component_submissions', 'user_id'],
  ['point_verifications', 'uid'],
  ['impact_verifications', 'user_id'],
  ['upgrade_requests', 'uid'],
  ['registrations', 'uid'],
  ['referral_codes', 'uid'],
  ['nudges_sent', 'uid'],
  ['nudge_assignments', 'uid'],
  ['nudge_cooldowns', 'uid'],
  ['announcement_states', 'uid'],
  ['tutorial_completions', 'uid'],
  ['book_club_visits', 'uid'],
  ['learner_status', 'uid'],
  ['learner_status_history', 'uid'],
  ['six_week_risk_evaluations', 'uid'],
  ['status_alerts', 'uid'],
  ['weekly_target_alerts', 'uid'],
  ['week_advancement_log', 'uid'],
  ['journeys', 'uid'],
  ['weekly_activities', 'uid'],
  ['weekly_habits', 'uid'],
  ['notification_preferences', 'uid'],
  ['admin_activity_log', 'actor_uid'],
]

/** Tables cleared wholesale (dummy org / community / ops noise). */
const WIPE_ALL_TABLES = [
  'village_invitations',
  'villages',
  'invitations',
  'partner_organizations',
  'organization_activity_visibility',
  'organization_capacity_alerts',
  'organization_capacity_metrics',
  'organization_configuration',
  'pending_org_deletions',
  'transformation_partners',
  'partners',
  'peer_sessions',
  'peer_session_requests',
  'peer_weekly_matches',
  'peer_matching_runs',
  'challenges',
  'interventions',
  'support_assignments',
  'mentor_escalations',
  'mentor_notifications',
  'mentorship_goals',
  'mentorship_sessions',
  'ambassador_slot_bookings',
  'ambassador_slots',
  'admin_notifications',
  'task_notifications',
  'partner_daily_digest_queue',
  'event_participants',
  'events',
  'feedback',
  'approvals',
  'pre_course_survey',
  'phone_registry',
  'profile_access_logs',
  'engagement_metrics',
  'engagement_trends',
  'digest_schedules',
  'journey_history',
  'lift_leads',
  'external_impact_sync_state',
  'impact_events',
  'cron_logs',
  'system_health_alerts',
  'nudge_effectiveness',
  'nudge_status_transitions',
  'nudge_campaigns',
  'referrals',
  'announcements',
]

const countTable = async (table) => {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return { table, count: null, error: error.message }
  return { table, count: count ?? 0, error: null }
}

const main = async () => {
  console.log(EXECUTE ? 'MODE: EXECUTE (deleting)' : 'MODE: DRY-RUN (no deletes)')
  console.log('')

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, full_name')
  if (profileError) throw new Error(profileError.message)

  const admins = (profiles ?? []).filter((p) => ADMIN_ROLES.has(String(p.role || '').toLowerCase()))
  const nonAdmins = (profiles ?? []).filter((p) => !ADMIN_ROLES.has(String(p.role || '').toLowerCase()))
  const adminIds = new Set(admins.map((p) => p.id))

  console.log('Keeping admins:')
  if (!admins.length) {
    console.error('No super_admin/admin profiles found — aborting.')
    process.exit(1)
  }
  for (const admin of admins) {
    console.log(`  - ${admin.email || admin.id} (${admin.role})`)
  }
  console.log('')
  console.log(`Non-admin profiles to remove: ${nonAdmins.length}`)
  for (const user of nonAdmins.slice(0, 30)) {
    console.log(`  - ${user.email || user.id} (${user.role || 'unknown'})`)
  }
  if (nonAdmins.length > 30) console.log(`  … and ${nonAdmins.length - 30} more`)
  console.log('')

  const orgCount = await countTable('organizations')
  console.log(`Organizations to remove: ${orgCount.count ?? orgCount.error}`)
  console.log('')

  if (!EXECUTE) {
    console.log('Dry-run complete. Re-run with --yes to delete.')
    console.log('Preserved config tables:', [...PRESERVE_TABLES].sort().join(', '))
    return
  }

  // 1) Wipe org / shared dummy tables
  for (const table of WIPE_ALL_TABLES) {
    if (PRESERVE_TABLES.has(table)) continue
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    // Some tables use text ids / no id — fall back to a broad filter
    if (error) {
      const retry = await supabase.from(table).delete().gte('created_at', '1970-01-01')
      if (retry.error) {
        console.warn(`  skip ${table}: ${retry.error.message}`)
        continue
      }
    }
    console.log(`  cleared ${table}`)
  }

  // Organizations last among org group (after dependents)
  {
    const { error } = await supabase.from('organizations').delete().neq('id', '')
    if (error) console.warn(`  organizations: ${error.message}`)
    else console.log('  cleared organizations')
  }

  // 2) User-owned rows for non-admins
  const nonAdminIds = nonAdmins.map((p) => p.id)
  for (const [table, column] of USER_TABLES) {
    if (!nonAdminIds.length) break
    // Delete in chunks to avoid URL limits
    for (let i = 0; i < nonAdminIds.length; i += 100) {
      const chunk = nonAdminIds.slice(i, i + 100)
      const { error } = await supabase.from(table).delete().in(column, chunk)
      if (error) {
        console.warn(`  skip ${table}.${column}: ${error.message}`)
        break
      }
    }
    console.log(`  cleared non-admin rows in ${table}`)
  }

  // 3) Non-admin profiles
  for (let i = 0; i < nonAdminIds.length; i += 100) {
    const chunk = nonAdminIds.slice(i, i + 100)
    const { error } = await supabase.from('profiles').delete().in('id', chunk)
    if (error) throw new Error(`profiles delete failed: ${error.message}`)
  }
  console.log(`  deleted ${nonAdminIds.length} non-admin profiles`)

  // 4) Matching auth.users (Admin API)
  let authDeleted = 0
  for (const id of nonAdminIds) {
    if (adminIds.has(id)) continue
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      console.warn(`  auth.users ${id}: ${error.message}`)
      continue
    }
    authDeleted += 1
  }
  console.log(`  deleted ${authDeleted} auth.users`)

  console.log('')
  console.log('Done. Admins preserved:')
  for (const admin of admins) {
    console.log(`  - ${admin.email || admin.id}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
