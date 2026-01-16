import { JOURNEY_META, JourneyType } from '@/config/pointsConfig';

/**
 * Checks if a user has completed their journey based on their total points.
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
