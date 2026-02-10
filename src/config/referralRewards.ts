import {
  Gift,
  Medal,
  Layers,
  Award,
  type LucideIcon,
} from 'lucide-react'

export interface RewardTier {
  id: number
  title: string
  required: number
  reward: string
  description: string
  label: string
  icon: LucideIcon
  gradient: string
  accent: string
}

export const REWARD_TIERS: RewardTier[] = [
  {
    id: 1,
    title: 'First Referral',
    required: 1,
    reward: '100 Points',
    description: 'Small dopamine hit. Points can be used for leaderboard bragging rights.',
    label: '100',
    icon: Gift,
    gradient: 'linear-gradient(135deg, var(--chakra-colors-tint-brandPrimary), var(--chakra-colors-surface-default))',
    accent: 'var(--chakra-colors-brand-primary)',
  },
  {
    id: 2,
    title: 'Community Builder Badge',
    required: 5,
    reward: 'Community Builder Badge',
    description:
      'Visible on their profile + bragging rights in the leaderboard. Unlocks access to a bonus micro-learning.',
    label: 'Badge',
    icon: Medal,
    gradient: 'linear-gradient(135deg, var(--chakra-colors-tint-accentWarning), var(--chakra-colors-tint-accentHighlight))',
    accent: 'var(--chakra-colors-brand-gold)',
  },
  {
    id: 3,
    title: "25% Off 'AI Stacking 101' Course",
    required: 15,
    reward: "25% Off 'AI Stacking 101'",
    description: 'Enjoy an exclusive 25% discount on the flagship AI Stacking 101 mastery course.',
    label: 'Course',
    icon: Layers,
    gradient: 'linear-gradient(135deg, var(--chakra-colors-tint-brandPrimary), var(--chakra-colors-tint-accentWarning))',
    accent: 'var(--chakra-colors-brand-warning)',
  },
  {
    id: 4,
    title: 'Featured Recognition',
    required: 20,
    reward: "Featured in 'Referrer of the Month'",
    description: "Featured in a community newsletter section ('Referrer of the Month').",
    label: 'Featured',
    icon: Award,
    gradient: 'linear-gradient(135deg, var(--chakra-colors-surface-subtle), var(--chakra-colors-tint-brandPrimary))',
    accent: 'var(--chakra-colors-brand-dark)',
  },
]
