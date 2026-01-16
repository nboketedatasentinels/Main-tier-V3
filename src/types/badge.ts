import { JourneyType } from '@/config/pointsConfig';

export type Badge = {
  id: string;
  name: string;
  description: string;
  image: string;
  earnedAt?: Date;
  journeyType?: JourneyType;
};
