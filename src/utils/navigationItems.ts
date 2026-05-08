import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Gift,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  UserSquare2,
  Workflow,
} from 'lucide-react'

export type NavigationItem = {
  key: string
  label: string
  icon?: React.ElementType
  description?: string
  badgeCount?: number
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
      { key: 'approvals', label: 'Approval Center', icon: ClipboardCheck },
      { key: 'admin-oversight', label: 'Admin Oversight', icon: ShieldCheck },
      { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    ],
  },
]

export const buildAmbassadorNavItems = (): NavigationSection[] => [
  {
    title: 'Ambassador',
    items: [
      { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
      { key: 'referrals', label: 'My Referrals', icon: Sparkles },
      { key: 'engagement', label: 'Ecosystem Engagement', icon: Users },
      { key: 'rewards', label: 'Rewards & Recognition', icon: Gift },
      { key: 'resources', label: 'Ambassador Resources', icon: BookOpen },
      { key: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
    ],
  },
]

export const buildPartnerNavItems = (): NavigationSection[] => [
  {
    title: 'Administration',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'users', label: 'User Management', icon: Users },
      { key: 'partner-assignment', label: 'Issue Activities', icon: ClipboardCheck },
      { key: 'organization-management', label: 'Organizations', icon: Building2 },
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
      { key: 'schedule', label: 'Schedule & alerts', icon: CalendarClock },
      { key: 'progress', label: 'Performance insights', icon: TrendingUp },
      { key: 'mentees', label: 'Mentees & directory', icon: Users },
    ],
  },
]
