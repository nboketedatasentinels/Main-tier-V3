import type { ActivityDef } from '@/config/pointsConfig'

export type ActivityAvailabilityState = 'available' | 'locked' | 'exhausted' | 'next_window' | 'permanently_exhausted'
export type ActivityAvailabilityReason =
  | 'scheduled'
  | 'cooldown'
  | 'max_per_week'
  | 'max_per_window'
  | 'missing_mentor'
  | 'missing_ambassador'
  | 'one_time_used'
  | 'window_cap_reached'

export type ActivityScheduleMode = 'fixed' | 'flexible'

export type ActivityBehavior = {
  schedule: ActivityScheduleMode
  maxPerWeek: number | null
  maxPerWindow: number
  cooldownWeeks: number
  requiresApproval: boolean
  visibility: {
    requiresMentor: boolean
    requiresAmbassador: boolean
  }
}

export type ActivityAvailabilityContext = {
  windowWeek: number
  weekCount: number
  windowCount: number
  totalCompletedAllTime: number
  lastCompletedWeek?: number
  hasMentor?: boolean
  hasAmbassador?: boolean
}

export type ActivityAvailabilityResult = {
  state: ActivityAvailabilityState
  reason?: ActivityAvailabilityReason
  cooldownRemainingWeeks?: number
  isScheduledForWeek: boolean
}

export const getActivityFrequencyLimits = (activity: ActivityDef) => {
  if (activity.activityPolicy) {
    return {
      maxPerWeek: activity.activityPolicy.maxPerWeek ?? null,
      maxPerWindow: activity.activityPolicy.maxPerWindow ?? null,
      maxTotal: activity.activityPolicy.maxTotal ?? null,
    }
  }
  return {
    maxPerWeek: activity.maxPerWeek ?? null,
    maxPerWindow: activity.maxPerMonth,
    maxTotal: null,
  }
}

export const classifyActivityBehavior = (activity: ActivityDef): ActivityBehavior => {
  const { maxPerWeek, maxPerWindow } = getActivityFrequencyLimits(activity)

  return {
    schedule: activity.flexibleWeeks ? 'flexible' : 'fixed',
    maxPerWeek,
    maxPerWindow: maxPerWindow ?? 999,
    cooldownWeeks: activity.cooldownWeeks ?? 0,
    requiresApproval: Boolean(activity.requiresApproval),
    visibility: {
      requiresMentor: Boolean(activity.visibility?.requiresMentor),
      requiresAmbassador: Boolean(activity.visibility?.requiresAmbassador),
    },
  }
}

export const calculateActivityAvailability = (
  activity: ActivityDef,
  context: ActivityAvailabilityContext,
): ActivityAvailabilityResult => {
  const behavior = classifyActivityBehavior(activity)
  const policy = activity.activityPolicy
  const {
    windowWeek,
    weekCount,
    windowCount,
    totalCompletedAllTime,
    lastCompletedWeek,
    hasMentor,
    hasAmbassador,
  } = context

  // 1. Visibility Checks
  if (behavior.visibility.requiresMentor && !hasMentor) {
    return { state: 'locked', reason: 'missing_mentor', isScheduledForWeek: false }
  }

  if (behavior.visibility.requiresAmbassador && !hasAmbassador) {
    return { state: 'locked', reason: 'missing_ambassador', isScheduledForWeek: false }
  }

  // 2. Policy-driven Availability
  if (policy?.type === 'one_time') {
    const maxTotal = policy.maxTotal ?? 1
    if (totalCompletedAllTime >= maxTotal) {
      return { state: 'permanently_exhausted', reason: 'one_time_used', isScheduledForWeek: true }
    }
  }

  if (policy?.type === 'window_limited') {
    const maxPerWindow = policy.maxPerWindow ?? 1
    if (windowCount >= maxPerWindow) {
      return { state: 'next_window', reason: 'window_cap_reached', isScheduledForWeek: true }
    }
  }

  // 3. Frequency Limits (legacy and ongoing)
  if (behavior.maxPerWeek && weekCount >= behavior.maxPerWeek) {
    return { state: 'exhausted', reason: 'max_per_week', isScheduledForWeek: true }
  }

  if (behavior.maxPerWindow && windowCount >= behavior.maxPerWindow) {
    return { state: 'exhausted', reason: 'max_per_window', isScheduledForWeek: true }
  }

  // 4. Scheduling Checks
  // Flexible activities unlock on their configured week and stay available afterward.
  const isScheduledForWeek =
    behavior.schedule === 'flexible'
      ? windowWeek >= activity.week
      : activity.week === windowWeek
  if (!isScheduledForWeek) {
    return { state: 'locked', reason: 'scheduled', isScheduledForWeek }
  }

  // 5. Cooldown Checks
  if (behavior.cooldownWeeks > 0 && typeof lastCompletedWeek === 'number') {
    const weeksSince = windowWeek - lastCompletedWeek
    if (weeksSince <= behavior.cooldownWeeks) {
      return {
        state: 'locked',
        reason: 'cooldown',
        cooldownRemainingWeeks: Math.max(0, behavior.cooldownWeeks - weeksSince + 1),
        isScheduledForWeek,
      }
    }
  }

  return { state: 'available', isScheduledForWeek }
}

/**
 * Filter activities based on policy type and availability state.
 */
export const getVisibleActivities = <T extends { availability: { state: ActivityAvailabilityState; reason?: ActivityAvailabilityReason } }>(
  activities: T[],
): T[] => {
  const stateOrder: Record<ActivityAvailabilityState, number> = {
    available: 0,
    next_window: 1,
    permanently_exhausted: 2,
    locked: 3,
    exhausted: 4,
  }

  const filtered = activities.filter((activity) => {
    const reason = activity.availability.reason
    return reason !== 'missing_mentor' && reason !== 'missing_ambassador'
  })

  return [...filtered].sort((a, b) => {
    // Sort by availability state
    return stateOrder[a.availability.state as ActivityAvailabilityState] - stateOrder[b.availability.state as ActivityAvailabilityState]
  })
}

/**
 * Get message for when an activity will be available again.
 */
export const getNextWindowAvailabilityMessage = (
  activity: ActivityDef,
  currentWindow: number,
): string => {
  if (activity.activityPolicy?.type === 'window_limited') {
    return `Nice work this window. Available again in Window ${currentWindow + 1}.`
  }
  if (activity.activityPolicy?.type === 'ongoing') {
    return 'Available again next window.'
  }
  return 'This activity unlocks next window.'
}
