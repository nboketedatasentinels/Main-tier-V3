import type { ActivityDef } from '@/config/pointsConfig'

export type ActivityAvailabilityState = 'available' | 'locked' | 'exhausted' | 'next_window' | 'permanently_exhausted'
export type ActivityAvailabilityReason =
  | 'scheduled'
  | 'cooldown'
  | 'weekly_cooldown'
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
    requiresCoach: boolean
  }
}

export type ActivityAvailabilityContext = {
  windowWeek: number
  weekCount: number
  windowCount: number
  totalCompletedAllTime: number
  lastCompletedWeek?: number
  lastCompletedTimestamp?: number
  hasMentor?: boolean
  hasAmbassador?: boolean
}

export type ActivityAvailabilityResult = {
  state: ActivityAvailabilityState
  reason?: ActivityAvailabilityReason
  cooldownRemainingWeeks?: number
  cooldownUntil?: Date
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
      requiresCoach: Boolean(activity.visibility?.requiresCoach),
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

  if (behavior.visibility.requiresCoach && !hasAmbassador) {
    return { state: 'locked', reason: 'missing_ambassador', isScheduledForWeek: false }
  }

  // 2. Policy-driven Availability — maxTotal is the only hard claim cap.
  // Learners can keep completing until journey frequency is reached; per-week /
  // per-window soft targets no longer lock the next occurrence.
  const maxTotal = policy?.maxTotal ?? (policy?.type === 'one_time' ? 1 : null)
  if (maxTotal != null && totalCompletedAllTime >= maxTotal) {
    return {
      state: 'permanently_exhausted',
      reason: policy?.type === 'one_time' ? 'one_time_used' : 'window_cap_reached',
      isScheduledForWeek: true,
    }
  }

  // 3. Legacy per-week / per-window caps only apply when no maxTotal is set
  // (open-ended ongoing activities without a journey frequency).
  if (maxTotal == null) {
    if (behavior.maxPerWeek && weekCount >= behavior.maxPerWeek) {
      return { state: 'exhausted', reason: 'max_per_week', isScheduledForWeek: true }
    }

    if (behavior.maxPerWindow && windowCount >= behavior.maxPerWindow) {
      return { state: 'exhausted', reason: 'max_per_window', isScheduledForWeek: true }
    }
  }

  // 4. Scheduling Checks
  // Per-week scheduling lock removed - all activities are reachable regardless
  // of which week they were originally scheduled for. isScheduledForWeek is
  // kept on the result for downstream consumers (analytics / UI hints) but no
  // longer gates availability.
  const isScheduledForWeek =
    behavior.schedule === 'flexible'
      ? windowWeek >= activity.week
      : activity.week === windowWeek

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
