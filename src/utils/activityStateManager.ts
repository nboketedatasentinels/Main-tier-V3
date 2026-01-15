import type { ActivityDef } from '@/config/pointsConfig'

export type ActivityAvailabilityState = 'available' | 'locked' | 'exhausted'
export type ActivityAvailabilityReason =
  | 'scheduled'
  | 'cooldown'
  | 'max_per_week'
  | 'max_per_window'
  | 'missing_mentor'
  | 'missing_ambassador'

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

export const getActivityFrequencyLimits = (activity: ActivityDef) => ({
  maxPerWeek: activity.maxPerWeek ?? 1,
  maxPerWindow: activity.maxPerMonth,
})

export const classifyActivityBehavior = (activity: ActivityDef): ActivityBehavior => {
  const { maxPerWeek, maxPerWindow } = getActivityFrequencyLimits(activity)

  return {
    schedule: activity.flexibleWeeks ? 'flexible' : 'fixed',
    maxPerWeek,
    maxPerWindow,
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
  const {
    windowWeek,
    weekCount,
    windowCount,
    lastCompletedWeek,
    hasMentor,
    hasAmbassador,
  } = context

  if (behavior.visibility.requiresMentor && !hasMentor) {
    return { state: 'locked', reason: 'missing_mentor', isScheduledForWeek: false }
  }

  if (behavior.visibility.requiresAmbassador && !hasAmbassador) {
    return { state: 'locked', reason: 'missing_ambassador', isScheduledForWeek: false }
  }

  if (behavior.maxPerWeek && weekCount >= behavior.maxPerWeek) {
    return { state: 'exhausted', reason: 'max_per_week', isScheduledForWeek: true }
  }

  if (behavior.maxPerWindow && windowCount >= behavior.maxPerWindow) {
    return { state: 'exhausted', reason: 'max_per_window', isScheduledForWeek: true }
  }

  const isScheduledForWeek = behavior.schedule === 'flexible' || activity.week === windowWeek
  if (!isScheduledForWeek) {
    return { state: 'locked', reason: 'scheduled', isScheduledForWeek }
  }

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
