export type CourseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export interface CourseDetail {
  slug: string
  link: string
  points: number
  price: number
  description: string
}

export interface CourseMetadata {
  estimatedMinutes: number
  difficulty: CourseDifficulty
}

const normalizeCourseMappingKey = (value: string) => value.trim().toLowerCase()

export const COURSE_DETAILS_MAPPING: Record<string, CourseDetail> = {
  'The Courage to Heal: Overcoming Trauma, Fear, and Shame': {
    slug: 'courage-to-heal',
    link: 'https://www.t4leader.com/challenge-page/f76c6e85-fe91-4aa7-a552-4976163633b9?programId=f76c6e85-fe91-4aa7-a552-4976163633b9',
    points: 100,
    price: 55,
    description: 'Build resilience and foster personal healing.',
  },
  'AI Stacking 101: Boost Your Productivity (No Tech Skills Needed)': {
    slug: 'ai-stacking-101',
    link: 'https://www.t4leader.com/challenge-page/4973307e-2f81-4641-a160-ca5fde2db9b6?programId=4973307e-2f81-4641-a160-ca5fde2db9b6',
    points: 100,
    price: 89,
    description: 'Leverage AI tools to stack efficiencies in your workflow.',
  },
  'Hire Me Already: The Confidence-Boosting Job Search Blueprint': {
    slug: 'hire-me-already',
    link: 'https://www.t4leader.com/challenge-page/ec61466f-7690-4236-9e07-119b71dc91ae?programId=ec61466f-7690-4236-9e07-119b71dc91ae',
    points: 100,
    price: 79,
    description: 'Polish your personal brand to land your next opportunity.',
  },
  'The Art of Connection: Sharpening Communication, Feedback, and Presentation Skills': {
    slug: 'art-of-connection',
    link: 'https://www.t4leader.com/challenge-page/92edc747-fd90-43d0-b4f6-5a3df43ad7d0?programId=92edc747-fd90-43d0-b4f6-5a3df43ad7d0',
    points: 100,
    price: 65,
    description: 'Deepen relationships through intentional communication.',
  },
  'Auto Connection': {
    slug: 'auto-connection',
    link: 'https://t4leader.com/program/auto-connection',
    points: 100,
    price: 49,
    description: 'Automate outreach and follow-up with authenticity.',
  },
  'The Heart of Leadership: Developing Emotional Intelligence for Impact': {
    slug: 'heart-of-leadership',
    link: 'https://www.t4leader.com/challenge-page/the-heart-of-leadership-developing-emotional-intelligence-for-impact?programId=3a900d9f-413c-4924-88b4-7e5cb8601b8c',
    points: 100,
    price: 95,
    description: 'Lead with empathy, courage, and clarity.',
  },
  'LinkedIn Warrior: Set Up Your Profile for Success': {
    slug: 'linkedin-warrior',
    link: 'https://www.t4leader.com/challenge-page/linkedin-warrior-set-up-your-profile?programId=51ebfc25-4d89-4894-b317-9a607bb0d7e2',
    points: 100,
    price: 45,
    description: 'Grow your professional influence on LinkedIn.',
  },
  'Path to Promotion: Strategies for Climbing the Career Jungle Gym': {
    slug: 'path-to-promotion',
    link: 'https://www.t4leader.com/challenge-page/path-to-promotion?programId=660ce35b-e20f-4fb7-8d4a-d067f4fd9a78',
    points: 100,
    price: 79,
    description: 'Map the exact steps to accelerate your advancement.',
  },
  'Understanding Digital Bias and its Impacts': {
    slug: 'understanding-digital-bias',
    link: 'https://www.t4leader.com/challenge-page/the-bias-blueprint?programId=7afdc77b-e8ad-467f-b0b8-f3e9814f59a0',
    points: 100,
    price: 82,
    description: 'Recognize and mitigate bias in digital experiences.',
  },
  'Cultural Intelligence': {
    slug: 'cultural-intelligence',
    link: 'https://www.t4leader.com/challenge-page/cultural-intelligence:?programId=2252414f-bb08-4e79-9d38-354ffcacaf6f',
    points: 100,
    price: 72,
    description: 'Navigate cross-cultural collaboration with ease.',
  },
  'The Confidence Code: Unlocking Self-Esteem and Life Balance': {
    slug: 'confidence-code',
    link: 'https://www.t4leader.com/challenge-page/the-confidence-code-self-esteem-and-life-balance?programId=757c9c37-f24d-409b-b9be-6eb0bdb14f6e',
    points: 100,
    price: 60,
    description: 'Unlock and sustain unshakeable confidence.',
  },
  'Think like an Owner': {
    slug: 'think-like-an-owner',
    link: 'https://www.t4leader.com/challenge-page/506e4f30-fa26-4a0b-893e-d0f313d6c6d8?programId=506e4f30-fa26-4a0b-893e-d0f313d6c6d8',
    points: 100,
    price: 90,
    description: 'Adopt an ownership mindset to drive results.',
  },
  'Mindset Reset: Shift Your Thinking, Transform Your Life': {
    slug: 'mindset-reset',
    link: 'https://www.t4leader.com/challenge-page/mindset-reset?programId=8902be3e-1566-4014-a122-b5910ba40d21',
    points: 100,
    price: 68,
    description: 'Reframe limiting beliefs into empowering narratives.',
  },
  'Goal Setting Mastery: Turn Your Vision into Action': {
    slug: 'goal-setting-mastery',
    link: 'https://www.t4leader.com/challenge-page/goal-setting-mastery?programId=2e920778-3f88-4f7c-b5aa-39effc7b27ed',
    points: 100,
    price: 85,
    description: 'Set, track, and achieve meaningful goals.',
  },
  'Goal Setting': {
    slug: 'goal-setting',
    link: 'https://t4leader.com/program/goal-setting',
    points: 100,
    price: 40,
    description: 'Quick-start guide to defining achievable goals.',
  },
  'How to Thrive in a Toxic Workplace': {
    slug: 'thrive-toxic-workplace',
    link: 'https://www.t4leader.com/challenge-page/how-to-thrive-in-a-toxic-workplace?programId=11f435fb-eed2-41a0-adde-9d59da46cafd',
    points: 100,
    price: 77,
    description: 'Strategies for navigating and improving tough cultures.',
  },
  'The Science of You: Understanding Personality Strengths for Growth': {
    slug: 'science-of-you',
    link: 'https://www.t4leader.com/challenge-page/the-science-of-you-personality-strengths-for-growth?programId=18da4c45-2f2d-4535-9bf3-fd3672ec8121',
    points: 100,
    price: 92,
    description: 'Personalized insights to optimize your strengths.',
  },
  'Transformational Leadership': {
    slug: 'transformational-leadership',
    link: 'https://www.t4leader.com/challenge-page/transformational-leadership?programId=d4e58ca0-f0e6-4f12-b2a8-9dc5fcf6e335',
    points: 100,
    price: 110,
    description: 'Guide teams through change with vision and trust.',
  },
  'Digital Transformation with Data Sentinels CPD: 16 Hours': {
    slug: 'digital-transformation-data',
    link: 'https://www.t4leader.com/challenge-page/digital-transformation-and-data-with-data-sentinels?programId=5e00df69-7bfb-4b86-ac91-b4d1a6381289',
    points: 100,
    price: 115,
    description: 'Lead digital-first initiatives with data fluency.',
  },
  'Leading Through Change and Continuous Improvement CPD: 16 Hours': {
    slug: 'leading-through-change',
    link: 'https://www.t4leader.com/challenge-page/leading-through-change-and-continuous-improvement?programId=34091627-1526-45e0-b4d0-e33f322ac71f',
    points: 100,
    price: 105,
    description: 'Embed continuous improvement within your team.',
  },
  'Project Management for Leaders CPD: 16 Hours': {
    slug: 'project-management-for-leaders',
    link: 'https://www.t4leader.com/challenge-page/project-management-for-leaders?programId=3731b2b1-7b15-44f0-ae55-b10f94f575f9',
    points: 100,
    price: 120,
    description: 'Deliver complex initiatives with confidence.',
  },
  'Foundations of Leadership and Team Dynamics CPD: 10 Hours': {
    slug: 'foundations-of-leadership',
    link: 'https://www.t4leader.com/challenge-page/foundations-of-leadership-and-team-dynamics?programId=76de65e3-b744-4c05-832f-0e9a60b2c7d2',
    points: 100,
    price: 96,
    description: 'Lead cohesive teams with clarity and trust.',
  },
  'Inner Shift': {
    slug: 'inner-shift',
    link: 'https://t4leader.com/program/inner-shift',
    points: 100,
    price: 120,
    description: 'Comprehensive personal development transformation.',
  },
  'Digital Rebel': {
    slug: 'digital-rebel',
    link: 'https://t4leader.com/program/digital-rebel',
    points: 100,
    price: 120,
    description: 'Lead digital disruption with creativity.',
  },
  'Architect': {
    slug: 'architect',
    link: 'https://t4leader.com/program/architect',
    points: 100,
    price: 130,
    description: 'Long-form leadership transformation program.',
  },
}

export const COURSE_METADATA_MAPPING: Record<string, CourseMetadata> = {
  'The Courage to Heal: Overcoming Trauma, Fear, and Shame': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'AI Stacking 101: Boost Your Productivity (No Tech Skills Needed)': { estimatedMinutes: 90, difficulty: 'Advanced' },
  'Hire Me Already: The Confidence-Boosting Job Search Blueprint': { estimatedMinutes: 80, difficulty: 'Intermediate' },
  'The Art of Connection: Sharpening Communication, Feedback, and Presentation Skills': { estimatedMinutes: 75, difficulty: 'Beginner' },
  'Auto Connection': { estimatedMinutes: 70, difficulty: 'Beginner' },
  'The Heart of Leadership: Developing Emotional Intelligence for Impact': { estimatedMinutes: 110, difficulty: 'Intermediate' },
  'LinkedIn Warrior: Set Up Your Profile for Success': { estimatedMinutes: 85, difficulty: 'Intermediate' },
  'Path to Promotion: Strategies for Climbing the Career Jungle Gym': { estimatedMinutes: 95, difficulty: 'Advanced' },
  'Understanding Digital Bias and its Impacts': { estimatedMinutes: 100, difficulty: 'Intermediate' },
  'Cultural Intelligence': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'The Confidence Code: Unlocking Self-Esteem and Life Balance': { estimatedMinutes: 60, difficulty: 'Beginner' },
  'Think like an Owner': { estimatedMinutes: 105, difficulty: 'Advanced' },
  'Mindset Reset: Shift Your Thinking, Transform Your Life': { estimatedMinutes: 65, difficulty: 'Beginner' },
  'Goal Setting Mastery: Turn Your Vision into Action': { estimatedMinutes: 90, difficulty: 'Intermediate' },
  'Goal Setting': { estimatedMinutes: 45, difficulty: 'Beginner' },
  'How to Thrive in a Toxic Workplace': { estimatedMinutes: 70, difficulty: 'Intermediate' },
  'The Science of You: Understanding Personality Strengths for Growth': { estimatedMinutes: 115, difficulty: 'Advanced' },
  'Transformational Leadership': { estimatedMinutes: 140, difficulty: 'Advanced' },
  'Digital Transformation with Data Sentinels CPD: 16 Hours': { estimatedMinutes: 960, difficulty: 'Advanced' },
  'Leading Through Change and Continuous Improvement CPD: 16 Hours': { estimatedMinutes: 960, difficulty: 'Advanced' },
  'Project Management for Leaders CPD: 16 Hours': { estimatedMinutes: 960, difficulty: 'Advanced' },
  'Foundations of Leadership and Team Dynamics CPD: 10 Hours': { estimatedMinutes: 600, difficulty: 'Intermediate' },
  'Inner Shift': { estimatedMinutes: 360, difficulty: 'Intermediate' },
  'Digital Rebel': { estimatedMinutes: 360, difficulty: 'Advanced' },
  'Architect': { estimatedMinutes: 480, difficulty: 'Advanced' },
}

const COURSE_TITLE_TO_SLUG = new Map<string, string>(
  Object.entries(COURSE_DETAILS_MAPPING).map(([title, details]) => [normalizeCourseMappingKey(title), details.slug])
)

const COURSE_SLUG_NORMALIZED_TO_SLUG = new Map<string, string>(
  Object.values(COURSE_DETAILS_MAPPING).map(details => [normalizeCourseMappingKey(details.slug), details.slug])
)

export const resolveCourseIdFromMapping = (value?: string | null): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  const normalized = normalizeCourseMappingKey(trimmed)
  const slugMatch = COURSE_SLUG_NORMALIZED_TO_SLUG.get(normalized)
  if (slugMatch) return slugMatch

  const titleMatch = COURSE_TITLE_TO_SLUG.get(normalized)
  if (titleMatch) return titleMatch

  return trimmed
}
