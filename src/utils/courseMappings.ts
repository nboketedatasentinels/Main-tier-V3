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
  'Resilience Under Sustained Transformation Pressure': {
    slug: 'courage-to-heal',
    link: 'https://www.t4leader.com/challenge-page/f76c6e85-fe91-4aa7-a552-4976163633b9?programId=f76c6e85-fe91-4aa7-a552-4976163633b9',
    points: 100,
    price: 39.99,
    description: 'Build resilience and foster personal healing.',
  },
  'AI for Transformation Leaders: Judgment Over Features': {
    slug: 'ai-stacking-101',
    link: 'https://www.t4leader.com/challenge-page/4973307e-2f81-4641-a160-ca5fde2db9b6?programId=4973307e-2f81-4641-a160-ca5fde2db9b6',
    points: 100,
    price: 49.99,
    description: 'Leverage AI tools to stack efficiencies in your workflow.',
  },
  'Hire Me Already: The Confidence-Boosting Job Search Blueprint': {
    slug: 'hire-me-already',
    link: 'https://www.t4leader.com/challenge-page/ec61466f-7690-4236-9e07-119b71dc91ae?programId=ec61466f-7690-4236-9e07-119b71dc91ae',
    points: 100,
    price: 79,
    description: 'Polish your personal brand to land your next opportunity.',
  },
  'Stakeholder Influence for Transformation Leaders': {
    slug: 'art-of-connection',
    link: 'https://www.t4leader.com/challenge-page/92edc747-fd90-43d0-b4f6-5a3df43ad7d0?programId=92edc747-fd90-43d0-b4f6-5a3df43ad7d0',
    points: 100,
    price: 49.99,
    description: 'Deepen relationships through intentional communication.',
  },
  'Auto Connection': {
    slug: 'auto-connection',
    link: 'https://t4leader.com/program/auto-connection',
    points: 100,
    price: 49,
    description: 'Automate outreach and follow-up with authenticity.',
  },
  'The Leader Your Transformation Team Actually Needs': {
    slug: 'heart-of-leadership',
    link: 'https://www.t4leader.com/challenge-page/the-heart-of-leadership-developing-emotional-intelligence-for-impact?programId=3a900d9f-413c-4924-88b4-7e5cb8601b8c',
    points: 100,
    price: 49.99,
    description: 'Lead with empathy, courage, and clarity.',
  },
  'Your Digital Presence as a Transformation Leader': {
    slug: 'linkedin-warrior',
    link: 'https://www.t4leader.com/challenge-page/linkedin-warrior-set-up-your-profile?programId=51ebfc25-4d89-4894-b317-9a607bb0d7e2',
    points: 100,
    price: 29.99,
    description: 'Grow your professional influence on LinkedIn.',
  },
  'Career Acceleration for Transformation Practitioners': {
    slug: 'path-to-promotion',
    link: 'https://www.t4leader.com/challenge-page/path-to-promotion?programId=660ce35b-e20f-4fb7-8d4a-d067f4fd9a78',
    points: 100,
    price: 39.99,
    description: 'Map the exact steps to accelerate your advancement.',
  },
  "Digital Bias: The Risk Your Transformation Isn't Measuring": {
    slug: 'understanding-digital-bias',
    link: 'https://www.t4leader.com/challenge-page/the-bias-blueprint?programId=7afdc77b-e8ad-467f-b0b8-f3e9814f59a0',
    points: 100,
    price: 39.99,
    description: 'Recognize and mitigate bias in digital experiences.',
  },
  'Leading Transformation Across Cultures and Borders': {
    slug: 'cultural-intelligence',
    link: 'https://www.t4leader.com/challenge-page/cultural-intelligence:?programId=2252414f-bb08-4e79-9d38-354ffcacaf6f',
    points: 100,
    price: 79.99,
    description: 'Navigate cross-cultural collaboration with ease.',
  },
  'Authority and Presence in High-Stakes Transformation': {
    slug: 'confidence-code',
    link: 'https://www.t4leader.com/challenge-page/the-confidence-code-self-esteem-and-life-balance?programId=757c9c37-f24d-409b-b9be-6eb0bdb14f6e',
    points: 100,
    price: 39.99,
    description: 'Unlock and sustain unshakeable confidence.',
  },
  'Think Like an Owner': {
    slug: 'think-like-an-owner',
    link: 'https://www.t4leader.com/challenge-page/506e4f30-fa26-4a0b-893e-d0f313d6c6d8?programId=506e4f30-fa26-4a0b-893e-d0f313d6c6d8',
    points: 100,
    price: 29.99,
    description: 'Adopt an ownership mindset to drive results.',
  },
  "Leading Under Pressure: The Transformation Leader's Operating System": {
    slug: 'mindset-reset',
    link: 'https://www.t4leader.com/challenge-page/mindset-reset?programId=8902be3e-1566-4014-a122-b5910ba40d21',
    points: 100,
    price: 49.99,
    description: 'Reframe limiting beliefs into empowering narratives.',
  },
  'From Strategy to Execution in Transformation Programmes': {
    slug: 'goal-setting-mastery',
    link: 'https://www.t4leader.com/challenge-page/goal-setting-mastery?programId=2e920778-3f88-4f7c-b5aa-39effc7b27ed',
    points: 100,
    price: 49.99,
    description: 'Set, track, and achieve meaningful goals.',
  },
  'Goal Setting': {
    slug: 'goal-setting',
    link: 'https://t4leader.com/program/goal-setting',
    points: 100,
    price: 40,
    description: 'Quick-start guide to defining achievable goals.',
  },
  'Navigating Organisational Resistance in Transformation': {
    slug: 'thrive-toxic-workplace',
    link: 'https://www.t4leader.com/challenge-page/how-to-thrive-in-a-toxic-workplace?programId=11f435fb-eed2-41a0-adde-9d59da46cafd',
    points: 100,
    price: 49.99,
    description: 'Strategies for navigating and improving tough cultures.',
  },
  'Know Your Leadership Pattern Under Pressure': {
    slug: 'science-of-you',
    link: 'https://www.t4leader.com/challenge-page/the-science-of-you-personality-strengths-for-growth?programId=18da4c45-2f2d-4535-9bf3-fd3672ec8121',
    points: 100,
    price: 39.99,
    description: 'Personalized insights to optimize your strengths.',
  },
  'Transformational Leadership': {
    slug: 'transformational-leadership',
    link: 'https://www.t4leader.com/challenge-page/transformational-leadership?programId=d4e58ca0-f0e6-4f12-b2a8-9dc5fcf6e335',
    points: 100,
    price: 9.99,
    description: 'Guide teams through change with vision and trust.',
  },
  'Digital Transformation with Data Sentinels': {
    slug: 'digital-transformation-data',
    link: 'https://www.t4leader.com/challenge-page/digital-transformation-and-data-with-data-sentinels?programId=5e00df69-7bfb-4b86-ac91-b4d1a6381289',
    points: 100,
    price: 89.99,
    description: 'Lead digital-first initiatives with data fluency.',
  },
  'Leading Through Change and Continuous Improvement': {
    slug: 'leading-through-change',
    link: 'https://www.t4leader.com/challenge-page/leading-through-change-and-continuous-improvement?programId=34091627-1526-45e0-b4d0-e33f322ac71f',
    points: 100,
    price: 59.99,
    description: 'Embed continuous improvement within your team.',
  },
  'Delivering Transformation: Project Leadership That Sticks': {
    slug: 'project-management-for-leaders',
    link: 'https://www.t4leader.com/challenge-page/project-management-for-leaders?programId=3731b2b1-7b15-44f0-ae55-b10f94f575f9',
    points: 100,
    price: 59.99,
    description: 'Deliver complex initiatives with confidence.',
  },
  'Building Teams That Survive Transformation': {
    slug: 'foundations-of-leadership',
    link: 'https://www.t4leader.com/challenge-page/foundations-of-leadership-and-team-dynamics?programId=76de65e3-b744-4c05-832f-0e9a60b2c7d2',
    points: 100,
    price: 59.99,
    description: 'Lead cohesive teams with clarity and trust.',
  },
  'Data-Driven Decisions in Digital Transformation': {
    slug: 'data-fluency-reporting',
    link: 'https://www.t4leader.com/challenge-page/b41deb08-0468-42e4-9a55-f2bf41ad5643?programId=b41deb08-0468-42e4-9a55-f2bf41ad5643',
    points: 100,
    price: 79.99,
    description: 'Build confidence turning data into clear, actionable insights.',
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
  'Resilience Under Sustained Transformation Pressure': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'AI for Transformation Leaders: Judgment Over Features': { estimatedMinutes: 90, difficulty: 'Advanced' },
  'Hire Me Already: The Confidence-Boosting Job Search Blueprint': { estimatedMinutes: 80, difficulty: 'Intermediate' },
  'Stakeholder Influence for Transformation Leaders': { estimatedMinutes: 75, difficulty: 'Beginner' },
  'Auto Connection': { estimatedMinutes: 70, difficulty: 'Beginner' },
  'The Leader Your Transformation Team Actually Needs': { estimatedMinutes: 110, difficulty: 'Intermediate' },
  'Your Digital Presence as a Transformation Leader': { estimatedMinutes: 85, difficulty: 'Intermediate' },
  'Career Acceleration for Transformation Practitioners': { estimatedMinutes: 95, difficulty: 'Advanced' },
  "Digital Bias: The Risk Your Transformation Isn't Measuring": { estimatedMinutes: 100, difficulty: 'Intermediate' },
  'Leading Transformation Across Cultures and Borders': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'Authority and Presence in High-Stakes Transformation': { estimatedMinutes: 60, difficulty: 'Beginner' },
  'Think Like an Owner': { estimatedMinutes: 105, difficulty: 'Advanced' },
  "Leading Under Pressure: The Transformation Leader's Operating System": { estimatedMinutes: 65, difficulty: 'Beginner' },
  'From Strategy to Execution in Transformation Programmes': { estimatedMinutes: 90, difficulty: 'Intermediate' },
  'Goal Setting': { estimatedMinutes: 45, difficulty: 'Beginner' },
  'Navigating Organisational Resistance in Transformation': { estimatedMinutes: 70, difficulty: 'Intermediate' },
  'Know Your Leadership Pattern Under Pressure': { estimatedMinutes: 115, difficulty: 'Advanced' },
  'Transformational Leadership': { estimatedMinutes: 140, difficulty: 'Advanced' },
  'Digital Transformation with Data Sentinels': { estimatedMinutes: 960, difficulty: 'Advanced' },
  'Leading Through Change and Continuous Improvement': { estimatedMinutes: 960, difficulty: 'Advanced' },
  'Delivering Transformation: Project Leadership That Sticks': { estimatedMinutes: 960, difficulty: 'Advanced' },
  'Building Teams That Survive Transformation': { estimatedMinutes: 600, difficulty: 'Intermediate' },
  'Data-Driven Decisions in Digital Transformation': { estimatedMinutes: 600, difficulty: 'Intermediate' },
  'Inner Shift': { estimatedMinutes: 360, difficulty: 'Intermediate' },
  'Digital Rebel': { estimatedMinutes: 360, difficulty: 'Advanced' },
  'Architect': { estimatedMinutes: 480, difficulty: 'Advanced' },
}

const COURSE_TITLE_ALIASES: Record<string, string> = {
  // Legacy name aliases (old names → new canonical names)
  'The Courage to Heal: Overcoming Trauma, Fear, and Shame': 'Resilience Under Sustained Transformation Pressure',
  'AI Stacking 101: Boost Your Productivity (No Tech Skills Needed)': 'AI for Transformation Leaders: Judgment Over Features',
  'The Art of Connection: Sharpening Communication, Feedback, and Presentation Skills': 'Stakeholder Influence for Transformation Leaders',
  'The Heart of Leadership: Developing Emotional Intelligence for Impact': 'The Leader Your Transformation Team Actually Needs',
  'LinkedIn Warrior: Set Up Your Profile for Success': 'Your Digital Presence as a Transformation Leader',
  'Path to Promotion: Strategies for Climbing the Career Jungle Gym': 'Career Acceleration for Transformation Practitioners',
  "Understanding Digital Bias and it's Impacts": "Digital Bias: The Risk Your Transformation Isn't Measuring",
  'Understanding Digital Bias and its Impacts': "Digital Bias: The Risk Your Transformation Isn't Measuring",
  'Cultural Intelligence': 'Leading Transformation Across Cultures and Borders',
  'The Confidence Code: Unlocking Self-Esteem and Life Balance': 'Authority and Presence in High-Stakes Transformation',
  'Think like an Owner': 'Think Like an Owner',
  'Mindset Reset: Shift Your Thinking, Transform Your Life': "Leading Under Pressure: The Transformation Leader's Operating System",
  'Goal Setting Mastery: Turn Your Vision into Action': 'From Strategy to Execution in Transformation Programmes',
  'How to Thrive in a Toxic Workplace': 'Navigating Organisational Resistance in Transformation',
  'The Science of You: Understanding Personality Strengths for Growth': 'Know Your Leadership Pattern Under Pressure',
  'Project Management for Leaders': 'Delivering Transformation: Project Leadership That Sticks',
  'Foundations of Leadership and Team Dynamics': 'Building Teams That Survive Transformation',
  'Data Fluency & Reporting': 'Data-Driven Decisions in Digital Transformation',
  // CPD and trailing-space variants
  'Digital Transformation with Data Sentinels CPD: 16 Hours': 'Digital Transformation with Data Sentinels',
  'Leading Through Change and Continuous Improvement CPD: 16 Hours': 'Leading Through Change and Continuous Improvement',
  'Leading Through Change and Continuous Improvement ': 'Leading Through Change and Continuous Improvement',
  'Project Management for Leaders CPD: 16 Hours': 'Delivering Transformation: Project Leadership That Sticks',
  'Project Management for Leaders ': 'Delivering Transformation: Project Leadership That Sticks',
  'Foundations of Leadership and Team Dynamics CPD: 10 Hours': 'Building Teams That Survive Transformation',
}

const COURSE_TITLE_TO_SLUG = new Map<string, string>()
const COURSE_TITLE_NORMALIZED_TO_TITLE = new Map<string, string>()
const COURSE_SLUG_NORMALIZED_TO_SLUG = new Map<string, string>()
const COURSE_SLUG_NORMALIZED_TO_TITLE = new Map<string, string>()

Object.entries(COURSE_DETAILS_MAPPING).forEach(([title, details]) => {
  const normalizedTitle = normalizeCourseMappingKey(title)
  const normalizedSlug = normalizeCourseMappingKey(details.slug)

  COURSE_TITLE_TO_SLUG.set(normalizedTitle, details.slug)
  COURSE_TITLE_NORMALIZED_TO_TITLE.set(normalizedTitle, title)
  COURSE_SLUG_NORMALIZED_TO_SLUG.set(normalizedSlug, details.slug)
  COURSE_SLUG_NORMALIZED_TO_TITLE.set(normalizedSlug, title)
})

Object.entries(COURSE_TITLE_ALIASES).forEach(([alias, canonicalTitle]) => {
  const details = COURSE_DETAILS_MAPPING[canonicalTitle]
  if (!details) return

  const normalizedAlias = normalizeCourseMappingKey(alias)
  COURSE_TITLE_TO_SLUG.set(normalizedAlias, details.slug)
  COURSE_TITLE_NORMALIZED_TO_TITLE.set(normalizedAlias, canonicalTitle)
})

export const resolveCourseTitleFromMapping = (value?: string | null): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  const normalized = normalizeCourseMappingKey(trimmed)
  const slugTitleMatch = COURSE_SLUG_NORMALIZED_TO_TITLE.get(normalized)
  if (slugTitleMatch) return slugTitleMatch

  const titleMatch = COURSE_TITLE_NORMALIZED_TO_TITLE.get(normalized)
  if (titleMatch) return titleMatch

  return trimmed
}

export const getCourseDetailsFromMapping = (value?: string | null): CourseDetail | undefined => {
  const title = resolveCourseTitleFromMapping(value)
  if (!title) return undefined
  return COURSE_DETAILS_MAPPING[title]
}

export const getCourseMetadataFromMapping = (value?: string | null): CourseMetadata | undefined => {
  const title = resolveCourseTitleFromMapping(value)
  if (!title) return undefined
  return COURSE_METADATA_MAPPING[title]
}

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
