import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartnerLayout } from '@/layouts/PartnerLayout'
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout'
import { MentorDashboardLayout } from '@/layouts/MentorDashboardLayout'
import { AmbassadorLayout } from '@/layouts/AmbassadorLayout'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import { useAuth } from '@/hooks/useAuth'
import { resolveMentorNavDestination } from '@/utils/mentorNavigation'
import { NotificationsPage } from './NotificationsPage'

/**
 * Each role renders its own shell (pages self-wrap in their layout in this
 * codebase), so the notifications page keeps the sidebar the user came from.
 * Learner routes live under /app, where MainLayout is supplied by the route -
 * they render NotificationsPage directly.
 */

export const PartnerNotificationsPage = () => {
  const navigate = useNavigate()
  const { organizations } = usePartnerOrganizations()
  const { selectedOrg, setSelectedOrg } = usePartnerSelectedOrg()

  const layoutOrgs = useMemo(
    () =>
      organizations
        .filter((org) => Boolean(org.id))
        .map((org) => ({ id: org.id!, code: org.code, name: org.name })),
    [organizations],
  )

  // Mirrors CourseApprovalsPage: dedicated routes navigate directly, everything
  // else is a state-based dashboard page reached via ?page=.
  const handleNavigate = useCallback(
    (key: string) => {
      if (key === 'partner-assignment' || key === 'learner-assignments' || key === 'course-approvals') {
        navigate(`/partner/${key}`)
        return
      }
      if (key === 'overview') {
        navigate('/partner/dashboard')
        return
      }
      navigate(`/partner/dashboard?page=${encodeURIComponent(key)}`)
    },
    [navigate],
  )

  return (
    <PartnerLayout
      activeItem="notifications"
      organizations={layoutOrgs}
      selectedOrg={selectedOrg || 'all'}
      onSelectOrg={(orgValue) => setSelectedOrg(orgValue === 'all' ? '' : orgValue)}
      onNavigate={handleNavigate}
    >
      <NotificationsPage subtitle="Messages and updates sent to you and your organizations." />
    </PartnerLayout>
  )
}

export const AdminNotificationsPage = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const adminName = `${profile?.firstName || 'Super'} ${profile?.lastName || 'Admin'}`.trim()

  // The admin dashboard is one page with ?tab= driving its section.
  const handleNavigate = useCallback(
    (key: string) => {
      navigate(key === 'overview' ? '/admin/dashboard' : `/admin/dashboard?tab=${encodeURIComponent(key)}`)
    },
    [navigate],
  )

  return (
    <SuperAdminLayout
      activeItem="notifications"
      adminName={adminName}
      avatarUrl={profile?.avatarUrl}
      onNavigate={handleNavigate}
    >
      <NotificationsPage subtitle="Platform messages and updates sent to you." />
    </SuperAdminLayout>
  )
}

export const MentorNotificationsPage = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  return (
    <MentorDashboardLayout
      activeItem="notifications"
      mentorName={`${profile?.firstName || 'Mentor'} ${profile?.lastName || ''}`.trim()}
      onNavigate={(key) => {
        const dest = resolveMentorNavDestination(key)
        if (dest.kind === 'route') {
          navigate(dest.path)
          return
        }
        navigate('/mentor/dashboard', { state: { mentorSection: dest.section } })
      }}
    >
      <NotificationsPage subtitle="Messages and updates about you and your mentees." />
    </MentorDashboardLayout>
  )
}

export const AmbassadorNotificationsPage = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  return (
    <AmbassadorLayout
      activeItem="notifications"
      ambassadorName={`${profile?.firstName || 'Coach'} ${profile?.lastName || ''}`.trim()}
      onNavigate={() => navigate('/ambassador/dashboard')}
    >
      <NotificationsPage subtitle="Messages and updates sent to you." />
    </AmbassadorLayout>
  )
}
