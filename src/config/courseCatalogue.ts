/**
 * Canonical T4L course catalogue for month-based journeys (3M / 6M / 9M).
 *
 * Admins pick one course per month from this list. Selection is NOT pillar-driven
 * (unlike the 6-week Power Journey). Pillar tags are reference metadata only.
 */
import type { CourseOption } from '@/types/admin'

export type CataloguePillarCode = 'L' | 'I' | 'F' | 'T' | 'G'

export interface CatalogueCourse {
  /** Course slug used as assignment id in monthlyCourseAssignments. */
  id: string
  title: string
  pillar: CataloguePillarCode
  pillarLabel: string
  programId: string
  link: string
  description?: string
}

export const MONTHLY_JOURNEY_COURSE_CATALOGUE: CatalogueCourse[] = [
  {
    id: 'think-like-an-owner',
    title: 'Think Like an Owner',
    pillar: 'T',
    pillarLabel: 'Transforming Business',
    programId: '506e4f30-fa26-4a0b-893e-d0f313d6c6d8',
    link: 'https://www.t4leader.com/challenge-page/think-like-an-owner?programId=506e4f30-fa26-4a0b-893e-d0f313d6c6d8',
    description: 'Adopt an ownership mindset to drive results.',
  },
  {
    id: 'mindset-reset',
    title: "Leading Under Pressure: The Transformation Leader's Operating System",
    pillar: 'L',
    pillarLabel: 'Leading Self',
    programId: '8902be3e-1566-4014-a122-b5910ba40d21',
    link: 'https://www.t4leader.com/challenge-page/mindset-reset-leading-under-pressure?programId=8902be3e-1566-4014-a122-b5910ba40d21',
    description: 'Reframe limiting beliefs into empowering narratives.',
  },
  {
    id: 'confidence-code',
    title: 'Authority and Presence in High-Stakes Transformation',
    pillar: 'L',
    pillarLabel: 'Leading Self',
    programId: '757c9c37-f24d-409b-b9be-6eb0bdb14f6e',
    link: 'https://www.t4leader.com/challenge-page/authority-and-presence-in-high-stakes-transformation?programId=757c9c37-f24d-409b-b9be-6eb0bdb14f6e',
    description: 'Unlock and sustain unshakeable confidence.',
  },
  {
    id: 'science-of-you',
    title: 'Know Your Leadership Pattern Under Pressure',
    pillar: 'L',
    pillarLabel: 'Leading Self',
    programId: '18da4c45-2f2d-4535-9bf3-fd3672ec8121',
    link: 'https://www.t4leader.com/challenge-page/know-your-leadership-pattern-under-pressure?programId=18da4c45-2f2d-4535-9bf3-fd3672ec8121',
    description: 'Personalized insights to optimize your strengths.',
  },
  {
    id: 'courage-to-heal',
    title: 'Resilience Under Sustained Transformation Pressure',
    pillar: 'L',
    pillarLabel: 'Leading Self',
    programId: 'f76c6e85-fe91-4aa7-a552-4976163633b9',
    link: 'https://www.t4leader.com/challenge-page/resilience-under-sustained-transformation-pressure?programId=f76c6e85-fe91-4aa7-a552-4976163633b9',
    description: 'Build resilience and foster personal healing.',
  },
  {
    id: 'heart-of-leadership',
    title: 'The Leader Your Transformation Team Actually Needs',
    pillar: 'F',
    pillarLabel: 'Fostering Teams',
    programId: '3a900d9f-413c-4924-88b4-7e5cb8601b8c',
    link: 'https://www.t4leader.com/challenge-page/the-leader-your-transformation-team-actually-needs?programId=3a900d9f-413c-4924-88b4-7e5cb8601b8c',
    description: 'Lead with empathy, courage, and clarity.',
  },
  {
    id: 'art-of-connection',
    title: 'Stakeholder Influence for Transformation Leader',
    pillar: 'T',
    pillarLabel: 'Transforming Business',
    programId: '92edc747-fd90-43d0-b4f6-5a3df43ad7d0',
    link: 'https://www.t4leader.com/challenge-page/stakeholder-influence-for-transformation-leaders?programId=92edc747-fd90-43d0-b4f6-5a3df43ad7d0',
    description: 'Deepen relationships through intentional communication.',
  },
  {
    id: 'cultural-intelligence',
    title: 'Leading Transformation Across Cultures and Borders',
    pillar: 'F',
    pillarLabel: 'Fostering Teams',
    programId: '2252414f-bb08-4e79-9d38-354ffcacaf6f',
    link: 'https://www.t4leader.com/challenge-page/cultural-intelligence-leading-transformation?programId=2252414f-bb08-4e79-9d38-354ffcacaf6f',
    description: 'Navigate cross-cultural collaboration with ease.',
  },
  {
    id: 'foundations-of-leadership',
    title: 'Building Teams That Survive Transformation',
    pillar: 'F',
    pillarLabel: 'Fostering Teams',
    programId: '76de65e3-b744-4c05-832f-0e9a60b2c7d2',
    link: 'https://www.t4leader.com/challenge-page/foundations-of-leadership?programId=76de65e3-b744-4c05-832f-0e9a60b2c7d2',
    description: 'Lead cohesive teams with clarity and trust.',
  },
  {
    id: 'ai-stacking-101',
    title: 'AI for Transformation Leader: Judgment Over Features',
    pillar: 'I',
    pillarLabel: 'Innovation & Technology',
    programId: '4973307e-2f81-4641-a160-ca5fde2db9b6',
    link: 'https://www.t4leader.com/challenge-page/ai-for-transformation-leaders-judgment-over-features?programId=4973307e-2f81-4641-a160-ca5fde2db9b6',
    description: 'Leverage AI tools to stack efficiencies in your workflow.',
  },
  {
    id: 'data-fluency-reporting',
    title: 'Data-Driven Decisions in Digital Transformation',
    pillar: 'I',
    pillarLabel: 'Innovation & Technology',
    programId: 'b41deb08-0468-42e4-9a55-f2bf41ad5643',
    link: 'https://www.t4leader.com/challenge-page/data-driven-decisions-transformation?programId=b41deb08-0468-42e4-9a55-f2bf41ad5643',
    description: 'Build confidence turning data into clear, actionable insights.',
  },
  {
    id: 'understanding-digital-bias',
    title: "Digital Bias: The Risk Your Transformation Isn't Measuring",
    pillar: 'I',
    pillarLabel: 'Innovation & Technology',
    programId: '7afdc77b-e8ad-467f-b0b8-f3e9814f59a0',
    link: 'https://www.t4leader.com/challenge-page/digital-bias-blueprint-for-transformation?programId=7afdc77b-e8ad-467f-b0b8-f3e9814f59a0',
    description: 'Recognize and mitigate bias in digital experiences.',
  },
  {
    id: 'digital-transformation-data',
    title: 'Digital Transformation with Data Sentinels',
    pillar: 'I',
    pillarLabel: 'Innovation & Technology',
    programId: '5e00df69-7bfb-4b86-ac91-b4d1a6381289',
    link: 'https://www.t4leader.com/challenge-page/digital-transformation-with-data-sentinels?programId=5e00df69-7bfb-4b86-ac91-b4d1a6381289',
    description: 'Lead digital-first initiatives with data fluency.',
  },
  {
    id: 'goal-setting-mastery',
    title: 'From Strategy to Execution in Transformation Programmes',
    pillar: 'T',
    pillarLabel: 'Transforming Business',
    programId: '2e920778-3f88-4f7c-b5aa-39effc7b27ed',
    link: 'https://www.t4leader.com/challenge-page/goal-setting-strategy-transformation?programId=2e920778-3f88-4f7c-b5aa-39effc7b27ed',
    description: 'Set, track, and achieve meaningful goals.',
  },
  {
    id: 'leading-through-change',
    title: 'Leading Through Change and Continuous Improvement',
    pillar: 'T',
    pillarLabel: 'Transforming Business',
    programId: '34091627-1526-45e0-b4d0-e33f322ac71f',
    link: 'https://www.t4leader.com/challenge-page/leading-through-change-and-continuous-improvement?programId=34091627-1526-45e0-b4d0-e33f322ac71f',
    description: 'Embed continuous improvement within your team.',
  },
  {
    id: 'project-management-for-leaders',
    title: 'Delivering Transformation: Project Leadership That Sticks',
    pillar: 'T',
    pillarLabel: 'Transforming Business',
    programId: '3731b2b1-7b15-44f0-ae55-b10f94f575f9',
    link: 'https://www.t4leader.com/challenge-page/project-management-for-leaders?programId=3731b2b1-7b15-44f0-ae55-b10f94f575f9',
    description: 'Deliver complex initiatives with confidence.',
  },
  {
    id: 'thrive-toxic-workplace',
    title: 'Navigating Organisational Resistance in Transformation',
    pillar: 'T',
    pillarLabel: 'Transforming Business',
    programId: '11f435fb-eed2-41a0-adde-9d59da46cafd',
    link: 'https://www.t4leader.com/challenge-page/thrive-toxic-workplace-transformation?programId=11f435fb-eed2-41a0-adde-9d59da46cafd',
    description: 'Strategies for navigating and improving tough cultures.',
  },
  {
    id: 'transformational-leadership',
    title: 'Transformational Leadership',
    pillar: 'G',
    pillarLabel: 'Gateway (no pillar)',
    programId: 'd4e58ca0-f0e6-4f12-b2a8-9dc5fcf6e335',
    link: 'https://www.t4leader.com/challenge-page/transformational-leadership?programId=d4e58ca0-f0e6-4f12-b2a8-9dc5fcf6e335',
    description: 'Guide teams through change with vision and trust.',
  },
  {
    id: 'linkedin-warrior',
    title: 'Your Digital Presence as a Transformation Leader',
    pillar: 'F',
    pillarLabel: 'Fostering Teams',
    programId: '51ebfc25-4d89-4894-b317-9a607bb0d7e2',
    link: 'https://www.t4leader.com/challenge-page/linkedin-profile-transformation-leader?programId=51ebfc25-4d89-4894-b317-9a607bb0d7e2',
    description: 'Grow your professional influence on LinkedIn.',
  },
  {
    id: 'path-to-promotion',
    title: 'Career Acceleration for Transformation Practitioners',
    pillar: 'L',
    pillarLabel: 'Leading Self',
    programId: '660ce35b-e20f-4fb7-8d4a-d067f4fd9a78',
    link: 'https://www.t4leader.com/challenge-page/promotion-career-acceleration-transformation?programId=660ce35b-e20f-4fb7-8d4a-d067f4fd9a78',
    description: 'Map the exact steps to accelerate your advancement.',
  },
]

export const MONTHLY_JOURNEY_COURSE_IDS = new Set(
  MONTHLY_JOURNEY_COURSE_CATALOGUE.map((course) => course.id),
)

/** True when program duration is month-based (3 / 6 / 9 months), not 6-week. */
export const isMonthlyJourneyDuration = (programDuration?: number | null): boolean =>
  typeof programDuration === 'number' && programDuration >= 3

export const getMonthlyJourneyCourseOptions = (): CourseOption[] =>
  MONTHLY_JOURNEY_COURSE_CATALOGUE.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
  })).sort((a, b) => a.title.localeCompare(b.title))
