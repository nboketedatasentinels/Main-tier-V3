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
  emoji: string
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
    emoji: '💯',
    icon: Gift,
    gradient: 'linear-gradient(135deg, #ffe2f5, #ffd9e8)',
    accent: '#ec4899',
  },
  {
    id: 2,
    title: 'Community Builder Badge',
    required: 5,
    reward: 'Community Builder Badge',
    description:
      'Visible on their profile + bragging rights in the leaderboard. Unlocks access to a bonus micro-learning.',
    emoji: '🏅',
    icon: Medal,
    gradient: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    accent: '#f59e0b',
  },
  {
    id: 3,
    title: "25% Off 'AI Stacking 101' Course",
    required: 15,
    reward: "25% Off 'AI Stacking 101'",
    description: 'Enjoy an exclusive 25% discount on the flagship AI Stacking 101 mastery course.',
    emoji: '🧠',
    icon: Layers,
    gradient: 'linear-gradient(135deg, #dbeafe, #e0e7ff)',
    accent: '#2563eb',
  },
  {
    id: 4,
    title: 'Featured Recognition',
    required: 20,
    reward: "Featured in 'Referrer of the Month'",
    description: "Featured in a community newsletter section ('Referrer of the Month').",
    emoji: '🌟',
    icon: Award,
    gradient: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
    accent: '#16a34a',
  },
]
