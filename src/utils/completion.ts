import { doc, getDoc } from 'firebase/firestore';
import { JOURNEY_META, JourneyType, type JourneyPointsVariantKey, getActivitiesForJourney } from '@/config/pointsConfig';
import { getActivityFrequencyLimits } from '@/utils/activityStateManager';
import { WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations';
import { fetchUserProfileById } from '@/services/userProfileService';
import { db } from '@/services/firebase';
import { ORG_COLLECTION } from '@/constants/organizations';
import { resolveLeadershipAvailability } from '@/utils/leadershipAvailability';

export interface PassMarkResult {
  baseThreshold: number;
  adjustedThreshold: number;
  totalTarget: number;
  adjustments: {
    mentorPoints: number;
    ambassadorPoints: number;
    mentorPassMarkReduction: number;
    ambassadorPassMarkReduction: number;
    variantKey?: JourneyPointsVariantKey | 'dynamic';
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
    } else if (maxTotal) {
      // Use journey-specific total frequency when available
      activityTotalPossiblePoints = maxTotal * activity.points;
    } else {
      // Fallback: estimate from per-window limits
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

const selectJourneyVariantKey = (
  hasMentor: boolean,
  hasAmbassador: boolean,
): JourneyPointsVariantKey | null => {
  if (!hasMentor && !hasAmbassador) return 'without_mentor_and_ambassador';
  if (!hasMentor || !hasAmbassador) return 'without_mentor_or_ambassador';
  return null;
};

/**
 * Calculates the pass mark for a journey, adjusting for missing mentor/ambassador if necessary.
 * Uses explicit passMarkPoints from JOURNEY_META when available.
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

  const baseTotalTarget = journey.maxPossiblePoints ?? journey.weeks * journey.weeklyTarget;

  // Use explicit pass mark if available, otherwise calculate from threshold
  const baseThreshold = journey.passMarkPoints
    ?? Math.floor((baseTotalTarget * (journey.completionThresholdPct ?? 100)) / 100);

  const { mentorAdjustment, ambassadorAdjustment, lockedMentorPoints, lockedAmbassadorPoints } =
    getMentorAmbassadorAdjustment(journeyType, hasMentor, hasAmbassador);

  const selectedVariantKey = selectJourneyVariantKey(hasMentor, hasAmbassador);
  const selectedVariant = selectedVariantKey
    ? (journey.pointVariants ?? []).find((variant) => variant.key === selectedVariantKey) ?? null
    : null;

  if (selectedVariant) {
    const passmarkReduction = Math.max(0, baseThreshold - selectedVariant.passMarkPoints);
    const mentorPassMarkReduction = !hasMentor && hasAmbassador
      ? passmarkReduction
      : !hasMentor && !hasAmbassador
        ? Math.floor(passmarkReduction / 2)
        : 0;
    const ambassadorPassMarkReduction = !hasAmbassador && hasMentor
      ? passmarkReduction
      : !hasMentor && !hasAmbassador
        ? passmarkReduction - mentorPassMarkReduction
        : 0;

    return {
      baseThreshold,
      adjustedThreshold: selectedVariant.passMarkPoints,
      totalTarget: selectedVariant.maxPossiblePoints,
      adjustments: {
        mentorPoints: lockedMentorPoints,
        ambassadorPoints: lockedAmbassadorPoints,
        mentorPassMarkReduction,
        ambassadorPassMarkReduction,
        variantKey: selectedVariant.key,
      }
    };
  }

  // Fallback path for journeys without explicit variants.
  const adjustedThreshold = Math.max(0, baseThreshold - mentorAdjustment - ambassadorAdjustment);
  const totalTarget = Math.max(0, baseTotalTarget - mentorAdjustment - ambassadorAdjustment);

  return {
    baseThreshold,
    adjustedThreshold,
    totalTarget,
    adjustments: {
      mentorPoints: lockedMentorPoints,
      ambassadorPoints: lockedAmbassadorPoints,
      mentorPassMarkReduction: mentorAdjustment,
      ambassadorPassMarkReduction: ambassadorAdjustment,
      variantKey: mentorAdjustment > 0 || ambassadorAdjustment > 0 ? 'dynamic' : undefined,
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
  const organizationId = profile.companyId || profile.organizationId || null;
  let organizationData: Record<string, unknown> | null = null;
  if (organizationId) {
    const organizationSnapshot = await getDoc(doc(db, ORG_COLLECTION, organizationId));
    if (organizationSnapshot.exists()) {
      organizationData = organizationSnapshot.data() as Record<string, unknown>;
    }
  }

  const { hasMentor, hasAmbassador } = resolveLeadershipAvailability({
    organizationData,
    profile,
  });

  const passMarkResult = calculatePassMark(journeyType, hasMentor, hasAmbassador);
  const isCompleted = totalPoints >= passMarkResult.adjustedThreshold;

  return {
    isCompleted,
    journeyType,
    pointsEarned: totalPoints,
    passMark: passMarkResult.adjustedThreshold,
    totalTarget: passMarkResult.totalTarget,
    status: isCompleted ? 'completed' : 'active',
    completedAt: isCompleted ? new Date() : undefined,
    adjustmentDetails: {
      mentorAdjustment: passMarkResult.adjustments.mentorPassMarkReduction,
      ambassadorAdjustment: passMarkResult.adjustments.ambassadorPassMarkReduction,
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

  // Use explicit pass mark if available
  const requiredPoints = journey.passMarkPoints ?? journey.weeks * journey.weeklyTarget;
  return totalPoints >= requiredPoints;
};
