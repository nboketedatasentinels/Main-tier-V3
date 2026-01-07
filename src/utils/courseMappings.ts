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

export const COURSE_DETAILS_MAPPING: Record<string, CourseDetail> = {
  'The Courage to Heal': {
    slug: 'courage-to-heal',
    link: 'https://t4leader.com/program/courage-to-heal',
    points: 100,
    price: 55,
    description: 'Build resilience and foster personal healing.',
  },
  'AI Stacking 101': {
    slug: 'ai-stacking-101',
    link: 'https://t4leader.com/program/ai-stacking-101',
    points: 100,
    price: 89,
    description: 'Leverage AI tools to stack efficiencies in your workflow.',
  },
  'Hire Me Already': {
    slug: 'hire-me-already',
    link: 'https://t4leader.com/program/hire-me-already',
    points: 100,
    price: 79,
    description: 'Polish your personal brand to land your next opportunity.',
  },
  'The Art of Connection': {
    slug: 'art-of-connection',
    link: 'https://t4leader.com/program/art-of-connection',
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
  'The Heart of Leadership': {
    slug: 'heart-of-leadership',
    link: 'https://t4leader.com/program/heart-of-leadership',
    points: 100,
    price: 95,
    description: 'Lead with empathy, courage, and clarity.',
  },
  'LinkedIn Warrior': {
    slug: 'linkedin-warrior',
    link: 'https://t4leader.com/program/linkedin-warrior',
    points: 100,
    price: 45,
    description: 'Grow your professional influence on LinkedIn.',
  },
  'Path to Promotion': {
    slug: 'path-to-promotion',
    link: 'https://t4leader.com/program/path-to-promotion',
    points: 100,
    price: 79,
    description: 'Map the exact steps to accelerate your advancement.',
  },
  'Understanding Digital Bias': {
    slug: 'understanding-digital-bias',
    link: 'https://t4leader.com/program/understanding-digital-bias',
    points: 100,
    price: 82,
    description: 'Recognize and mitigate bias in digital experiences.',
  },
  'Cultural Intelligence': {
    slug: 'cultural-intelligence',
    link: 'https://t4leader.com/program/cultural-intelligence',
    points: 100,
    price: 72,
    description: 'Navigate cross-cultural collaboration with ease.',
  },
  'The Confidence Code': {
    slug: 'confidence-code',
    link: 'https://t4leader.com/program/confidence-code',
    points: 100,
    price: 60,
    description: 'Unlock and sustain unshakeable confidence.',
  },
  'Think Like an Owner': {
    slug: 'think-like-an-owner',
    link: 'https://t4leader.com/program/think-like-an-owner',
    points: 100,
    price: 90,
    description: 'Adopt an ownership mindset to drive results.',
  },
  'Mindset Reset': {
    slug: 'mindset-reset',
    link: 'https://t4leader.com/program/mindset-reset',
    points: 100,
    price: 68,
    description: 'Reframe limiting beliefs into empowering narratives.',
  },
  'Goal Setting Mastery': {
    slug: 'goal-setting-mastery',
    link: 'https://t4leader.com/program/goal-setting-mastery',
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
    link: 'https://t4leader.com/program/thrive-toxic-workplace',
    points: 100,
    price: 77,
    description: 'Strategies for navigating and improving tough cultures.',
  },
  'The Science of You': {
    slug: 'science-of-you',
    link: 'https://t4leader.com/program/science-of-you',
    points: 100,
    price: 92,
    description: 'Personalized insights to optimize your strengths.',
  },
  'Transformational Leadership': {
    slug: 'transformational-leadership',
    link: 'https://t4leader.com/program/transformational-leadership',
    points: 100,
    price: 110,
    description: 'Guide teams through change with vision and trust.',
  },
  'Digital Transformation and Data': {
    slug: 'digital-transformation-data',
    link: 'https://t4leader.com/program/digital-transformation-data',
    points: 100,
    price: 115,
    description: 'Lead digital-first initiatives with data fluency.',
  },
  'Leading Through Change and Continuous Improvement': {
    slug: 'leading-through-change',
    link: 'https://t4leader.com/program/leading-through-change',
    points: 100,
    price: 105,
    description: 'Embed continuous improvement within your team.',
  },
  'Project Management for Leaders': {
    slug: 'project-management-for-leaders',
    link: 'https://t4leader.com/program/project-management-for-leaders',
    points: 100,
    price: 120,
    description: 'Deliver complex initiatives with confidence.',
  },
  'Foundations of Leadership and Team Dynamics': {
    slug: 'foundations-of-leadership',
    link: 'https://t4leader.com/program/foundations-of-leadership',
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
    description: '12-month leadership transformation program.',
  },
}

export const COURSE_METADATA_MAPPING: Record<string, CourseMetadata> = {
  'The Courage to Heal': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'AI Stacking 101': { estimatedMinutes: 90, difficulty: 'Advanced' },
  'Hire Me Already': { estimatedMinutes: 80, difficulty: 'Intermediate' },
  'The Art of Connection': { estimatedMinutes: 75, difficulty: 'Beginner' },
  'Auto Connection': { estimatedMinutes: 70, difficulty: 'Beginner' },
  'The Heart of Leadership': { estimatedMinutes: 110, difficulty: 'Intermediate' },
  'LinkedIn Warrior': { estimatedMinutes: 85, difficulty: 'Intermediate' },
  'Path to Promotion': { estimatedMinutes: 95, difficulty: 'Advanced' },
  'Understanding Digital Bias': { estimatedMinutes: 100, difficulty: 'Intermediate' },
  'Cultural Intelligence': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'The Confidence Code': { estimatedMinutes: 60, difficulty: 'Beginner' },
  'Think Like an Owner': { estimatedMinutes: 105, difficulty: 'Advanced' },
  'Mindset Reset': { estimatedMinutes: 65, difficulty: 'Beginner' },
  'Goal Setting Mastery': { estimatedMinutes: 90, difficulty: 'Intermediate' },
  'Goal Setting': { estimatedMinutes: 45, difficulty: 'Beginner' },
  'How to Thrive in a Toxic Workplace': { estimatedMinutes: 70, difficulty: 'Intermediate' },
  'The Science of You': { estimatedMinutes: 115, difficulty: 'Advanced' },
  'Transformational Leadership': { estimatedMinutes: 140, difficulty: 'Advanced' },
  'Digital Transformation and Data': { estimatedMinutes: 150, difficulty: 'Advanced' },
  'Leading Through Change and Continuous Improvement': { estimatedMinutes: 130, difficulty: 'Advanced' },
  'Project Management for Leaders': { estimatedMinutes: 160, difficulty: 'Advanced' },
  'Foundations of Leadership and Team Dynamics': { estimatedMinutes: 100, difficulty: 'Intermediate' },
  'Inner Shift': { estimatedMinutes: 360, difficulty: 'Intermediate' },
  'Digital Rebel': { estimatedMinutes: 360, difficulty: 'Advanced' },
  'Architect': { estimatedMinutes: 480, difficulty: 'Advanced' },
}
