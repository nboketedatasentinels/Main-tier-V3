import {
  Archive,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  ListChecks,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  LockKeyhole,
  ScrollText,
  Settings,
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
      { key: 'messaging', label: 'Messaging', icon: MessageSquare },
      { key: 'approvals', label: 'Approval Center', icon: ClipboardCheck },
      { key: 'feedback', label: 'Feedback Inbox', icon: Inbox },
      { key: 'archived-organizations', label: 'Organization Archive', icon: Archive },
    ],
  },
]

export const buildAmbassadorNavItems = (): NavigationSection[] => [
  {
    title: 'Coach',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'coachees', label: 'My coachees', icon: Users },
      { key: 'schedule', label: 'Meeting schedule', icon: CalendarClock },
      { key: 'assessments', label: 'Post assessments', icon: ClipboardCheck },
      { key: 'notifications', label: 'Notifications', icon: Bell },
      { key: 'guidelines', label: 'Coach guidelines', icon: ScrollText },
    ],
  },
]

export const buildPartnerNavItems = (): NavigationSection[] => [
  {
    title: 'Administration',
    items: [
      { key: 'overview', label: 'Program management', icon: LayoutDashboard },
      { key: 'users', label: 'User Management', icon: Users },
      { key: 'partner-assignment', label: 'Issue Activities', icon: ClipboardCheck },
      { key: 'course-approvals', label: 'Course Approvals', icon: BookOpen },
      { key: 'programme-submissions', label: 'Programme Submissions', icon: ClipboardList },
      { key: 'course-surveys', label: 'Post assessments', icon: ListChecks },
      { key: 'organization-management', label: 'Organizations', icon: Building2 },
      { key: 'notifications', label: 'Notifications', icon: Bell },
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
      { key: 'mentees', label: 'My mentees', icon: Users },
      { key: 'schedule', label: 'Meeting schedule', icon: CalendarClock },
      { key: 'assessments', label: 'Post assessments', icon: ClipboardCheck },
      { key: 'notifications', label: 'Notifications', icon: Bell },
      { key: 'guidelines', label: 'Mentor guidelines', icon: ScrollText },
    ],
  },
]
