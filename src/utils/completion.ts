import { JOURNEY_META, JourneyType, getActivitiesForJourney } from '@/config/pointsConfig';
import { getActivityFrequencyLimits } from '@/utils/activityStateManager';
import { WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations';
import { fetchUserProfileById } from '@/services/userProfileService';

export interface PassMarkResult {
  baseThreshold: number;
  adjustedThreshold: number;
  totalTarget: number;
  adjustments: {
    mentorPoints: number;
    ambassadorPoints: number;
  };
}

export interface CompletionResult {
  isCompleted: boolean;
  journeyType: JourneyType;
  pointsEarned: number;
  passMark: number;
  totalTarget: number;
  status: 'active' | 'completed';
  completedAt?: Date;
  adjustmentDetails: {
    mentorAdjustment: number;
    ambassadorAdjustment: number;
  };
}

/**
 * Calculates how many points are locked behind mentor/ambassador requirements.
 */
export const getMentorAmbassadorAdjustment = (
  journeyType: JourneyType,
  hasMentor: boolean,
  hasAmbassador: boolean
) => {
  const activities = getActivitiesForJourney(journeyType);
  const journey = JOURNEY_META[journeyType];
  const journeyWeeks = journey.weeks;
  const numWindows = Math.ceil(journeyWeeks / WINDOW_SIZE_WEEKS);

  let lockedMentorPoints = 0;
  let lockedAmbassadorPoints = 0;

  activities.forEach((activity) => {
    const { maxTotal, maxPerWindow } = getActivityFrequencyLimits(activity);

    let activityTotalPossiblePoints = 0;
    if (activity.activityPolicy?.type === 'one_time') {
      activityTotalPossiblePoints = (maxTotal ?? 1) * activity.points;
    } else {
      // Use maxPerWindow if available, otherwise fallback to maxPerMonth (legacy)
      const perWindow = maxPerWindow ?? activity.maxPerMonth ?? 1;
      activityTotalPossiblePoints = perWindow * numWindows * activity.points;
    }

    if (activity.visibility?.requiresMentor) {
      lockedMentorPoints += activityTotalPossiblePoints;
    }
    if (activity.visibility?.requiresAmbassador) {
      lockedAmbassadorPoints += activityTotalPossiblePoints;
    }
  });

  return {
    mentorAdjustment: hasMentor ? 0 : lockedMentorPoints,
    ambassadorAdjustment: hasAmbassador ? 0 : lockedAmbassadorPoints,
    lockedMentorPoints,
    lockedAmbassadorPoints,
  };
};

/**
 * Calculates the pass mark for a journey, adjusting for missing mentor/ambassador if necessary.
 */
export const calculatePassMark = (
  journeyType: JourneyType,
  hasMentor: boolean = true,
  hasAmbassador: boolean = true
): PassMarkResult => {
  const journey = JOURNEY_META[journeyType];
  if (!journey) {
    throw new Error(`Invalid journey type: ${journeyType}`);
  }
  const totalTarget = journey.weeks * journey.weeklyTarget;
  const thresholdPct = journey.completionThresholdPct ?? 100;

  const baseThreshold = Math.floor((totalTarget * thresholdPct) / 100);

  const { mentorAdjustment, ambassadorAdjustment, lockedMentorPoints, lockedAmbassadorPoints } =
    getMentorAmbassadorAdjustment(journeyType, hasMentor, hasAmbassador);

  // Reduce pass mark by locked points
  const adjustedThreshold = Math.max(0, baseThreshold - mentorAdjustment - ambassadorAdjustment);

  return {
    baseThreshold,
    adjustedThreshold,
    totalTarget,
    adjustments: {
      mentorPoints: lockedMentorPoints,
      ambassadorPoints: lockedAmbassadorPoints,
    }
  };
};

/**
 * Evaluates whether a user has completed their journey.
 */
export const evaluateJourneyCompletion = async (
  userId: string,
  journeyType: JourneyType
): Promise<CompletionResult> => {
  const profile = await fetchUserProfileById(userId);
  if (!profile) {
    throw new Error('User profile not found');
  }

  const totalPoints = profile.totalPoints || 0;
  const hasMentor = !!profile.mentorId;
  const hasAmbassador = !!profile.ambassadorId;

  const passMarkResult = calculatePassMark(journeyType, hasMentor, hasAmbassador);
  const isCompleted = totalPoints >= passMarkResult.adjustedThreshold;

  const { mentorAdjustment, ambassadorAdjustment } = getMentorAmbassadorAdjustment(journeyType, hasMentor, hasAmbassador);

  return {
    isCompleted,
    journeyType,
    pointsEarned: totalPoints,
    passMark: passMarkResult.adjustedThreshold,
    totalTarget: passMarkResult.totalTarget,
    status: isCompleted ? 'completed' : 'active',
    completedAt: isCompleted ? new Date() : undefined,
    adjustmentDetails: {
      mentorAdjustment,
      ambassadorAdjustment,
    }
  };
};

/**
 * Checks if a user has completed their journey based on their total points.
 * @deprecated Use evaluateJourneyCompletion for more accurate results including adjustments.
 * @param totalPoints The user's total points.
 * @param journeyType The user's journey type.
 * @returns True if the user has completed the journey, false otherwise.
 */
export const hasCompletedJourney = (totalPoints: number, journeyType: JourneyType): boolean => {
  const journey = JOURNEY_META[journeyType];
  if (!journey) {
    return false;
  }

  const requiredPoints = journey.weeks * journey.weeklyTarget;
  return totalPoints >= requiredPoints;
};
