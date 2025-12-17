import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  Gift,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  ShieldAlert,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  UserSquare2,
  Workflow,
} from 'lucide-react'

export type NavigationItem = {
  key: string
  label: string
  icon?: React.ElementType
}

export type NavigationSection = {
  title?: string
  items: NavigationItem[]
}

export const buildCommonAccountItems = (): NavigationItem[] => [
  { key: 'profile', label: 'Profile', icon: UserSquare2 },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'logout', label: 'Logout', icon: LockKeyhole },
]

export const buildSuperAdminNavItems = (): NavigationSection[] => [
  {
    title: 'Platform',
    items: [
      { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
      { key: 'organizations', label: 'Organization Management', icon: Workflow },
      { key: 'users', label: 'User Management', icon: Users },
      { key: 'admin-oversight', label: 'Admin Oversight', icon: ShieldCheck },
      { key: 'settings', label: 'System Settings', icon: Settings },
      { key: 'security', label: 'Security & Audit', icon: ShieldAlert },
      { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      { key: 'configuration', label: 'Platform Configuration', icon: Target },
    ],
  },
]

export const buildAmbassadorNavItems = (): NavigationSection[] => [
  {
    title: 'Ambassador',
    items: [
      { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
      { key: 'referrals', label: 'My Referrals', icon: Sparkles },
      { key: 'engagement', label: 'Community Engagement', icon: Users },
      { key: 'rewards', label: 'Rewards & Recognition', icon: Gift },
      { key: 'resources', label: 'Ambassador Resources', icon: BookOpen },
      { key: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
    ],
  },
]

export const buildCompanyAdminNavItems = (): NavigationSection[] => [
  {
    title: 'Administration',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'users', label: 'User Management', icon: Users },
      { key: 'organizations', label: 'Organizations', icon: Building2 },
      { key: 'reports', label: 'Reports', icon: BarChart3 },
      { key: 'settings', label: 'Settings', icon: Settings },
      { key: 'support', label: 'Support', icon: Headphones },
    ],
  },
]

/**
 * Navigation items for the mentor dashboard experience.
 *
 * Groups mentorship-focused tools into a single section for consistent rendering
 * with other dashboard layouts.
 */
export const buildMentorNavItems = (): NavigationSection[] => [
  {
    title: 'Mentorship',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'mentees', label: 'My Mentees', icon: Users },
      { key: 'sessions', label: 'Mentorship Sessions', icon: CalendarCheck },
      { key: 'progress', label: 'Progress Tracking', icon: TrendingUp },
      { key: 'resources', label: 'Resources Library', icon: BookOpen },
      { key: 'analytics', label: 'Analytics Reports', icon: BarChart3 },
    ],
  },
]
