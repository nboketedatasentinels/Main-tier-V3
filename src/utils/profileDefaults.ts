/**
 * Canonical defaults for new user profiles.
 *
 * Every profile-creating code path (self-signup, partner invite, admin import,
 * super-admin admin creation) must seed these engagement markers so the user
 * is fully visible across the platform from the first moment they exist:
 *   - leaderboard (organizationScope.ts requires `accountStatus` not blocked)
 *   - peer connect / challenge picker (same eligibility check)
 *   - notifications & journey gating (require journeyType / journeyStartDate)
 *   - partner dashboards (read totalPoints / level for progress %)
 *
 * Without these, profiles are "stubs" — they pass org membership checks but
 * are invisible to peers and break partner reporting.
 */

export interface OrgDefaultsContext {
  id?: string | null
  code?: string | null
  name?: string | null
  journeyType?: string | null
  journeyStartDate?: string | null
  programDurationWeeks?: number | null
}

export interface ProfileEngagementDefaults {
  accountStatus: 'active'
  totalPoints: 0
  level: 1
  onboardingComplete: false
  currentWeek: 1
  journeyType?: string
  journeyStartDate?: string
  programDurationWeeks?: number
}

const todayIso = () => new Date().toISOString()

export const buildProfileEngagementDefaults = (
  org?: OrgDefaultsContext | null,
): ProfileEngagementDefaults => {
  const defaults: ProfileEngagementDefaults = {
    accountStatus: 'active',
    totalPoints: 0,
    level: 1,
    onboardingComplete: false,
    currentWeek: 1,
  }

  if (org?.journeyType) defaults.journeyType = org.journeyType
  if (org?.journeyStartDate) {
    defaults.journeyStartDate = org.journeyStartDate
  } else if (org?.journeyType) {
    // Org has a journey but no start date set yet — anchor to today so weekly
    // gating (currentWeek, fortnight windows) has something to compute from.
    defaults.journeyStartDate = todayIso()
  }
  if (typeof org?.programDurationWeeks === 'number' && org.programDurationWeeks > 0) {
    defaults.programDurationWeeks = org.programDurationWeeks
  }

  return defaults
}

/**
 * Compute the subset of engagement defaults that need to be written to a
 * profile because they are currently missing/undefined. Used by self-heal
 * (AuthContext) and backfill scripts so we never overwrite real progress.
 *
 * Returns an empty object if the profile already has every marker set.
 */
export const getMissingEngagementDefaults = (
  profile: Record<string, unknown> | null | undefined,
  org?: OrgDefaultsContext | null,
): Partial<ProfileEngagementDefaults> => {
  const updates: Record<string, unknown> = {}
  const defaults = buildProfileEngagementDefaults(org)

  if (typeof profile?.accountStatus !== 'string' || profile.accountStatus.trim() === '') {
    updates.accountStatus = defaults.accountStatus
  }
  if (typeof profile?.totalPoints !== 'number') {
    updates.totalPoints = defaults.totalPoints
  }
  if (typeof profile?.level !== 'number') {
    updates.level = defaults.level
  }
  if (typeof profile?.onboardingComplete !== 'boolean') {
    updates.onboardingComplete = defaults.onboardingComplete
  }
  if (typeof profile?.currentWeek !== 'number') {
    updates.currentWeek = defaults.currentWeek
  }
  if (defaults.journeyType && (typeof profile?.journeyType !== 'string' || profile.journeyType.trim() === '')) {
    updates.journeyType = defaults.journeyType
  }
  if (defaults.journeyStartDate && (typeof profile?.journeyStartDate !== 'string' || profile.journeyStartDate.trim() === '')) {
    updates.journeyStartDate = defaults.journeyStartDate
  }
  if (typeof defaults.programDurationWeeks === 'number' && typeof profile?.programDurationWeeks !== 'number') {
    updates.programDurationWeeks = defaults.programDurationWeeks
  }

  return updates as Partial<ProfileEngagementDefaults>
}

export const profileNeedsEngagementBackfill = (
  profile: Record<string, unknown> | null | undefined,
  org?: OrgDefaultsContext | null,
): boolean => {
  return Object.keys(getMissingEngagementDefaults(profile, org)).length > 0
}
