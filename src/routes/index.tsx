import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { FreeTierGuard } from '@/components/FreeTierGuard'
import RoleRedirect from '@/pages/auth/RoleRedirect'
import { UserRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getLandingPathForRole } from '@/utils/roleRouting'

// Layout imports
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { HomePage } from '@/pages/home/HomePage'

// Page imports
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { ProfileMissingPage } from '@/pages/auth/ProfileMissingPage'
import { ReferralLanding } from '@/pages/auth/ReferralLanding'
import { UpgradePage } from '@/pages/upgrade/UpgradePage'

// Onboarding imports
import { WelcomePage } from '@/pages/onboarding/WelcomePage'

// Dashboard imports
import { SuperAdminDashboard } from '@/pages/dashboards/SuperAdminDashboard'
import { MentorDashboard } from '@/pages/dashboards/MentorDashboard'
import { AmbassadorDashboard } from '@/pages/dashboards/AmbassadorDashboard'
import { PartnerDashboard } from '@/pages/dashboards/PartnerDashboard'

// Feature page imports
import { JourneysPage } from '@/pages/journeys/JourneysPage'
import { ImpactLogPage } from '@/pages/impact/ImpactLogPage'
import { LeadershipBoardPage } from '@/pages/leaderboard/LeadershipBoardPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { WeeklyUpdatesPage } from '@/pages/WeeklyChecklistPage'
import { WeeklyGlancePage } from '@/pages/journeys/WeeklyGlancePage'
import { LearnerDashboardPage } from '@/pages/journeys/LearnerDashboardPage'
import { MyCoursesPage } from '@/pages/courses/MyCoursesPage'
import { PeerConnectPage } from '@/pages/peer/PeerConnectPage'
import { LeadershipCouncilPage } from '@/pages/leadership/LeadershipCouncilPage'
import { AnnouncementsPage } from '@/pages/community/AnnouncementsPage'
import ReferralRewardsPage from '@/pages/community/ReferralRewardsPage'
import { BookClubPage } from '@/pages/community/BookClubPage'
import { ShamelessCirclePage } from '@/pages/community/ShamelessCirclePage';
import { UserProfileManagementPage } from '@/pages/admin/UserProfileManagementPage';
import { OrganizationDetailPage } from '@/pages/admin/OrganizationDetailPage';
import ApprovalQueuePage from '@/pages/admin/ApprovalQueuePage';
import PartnerAssignmentPage from '@/pages/admin/PartnerAssignmentPage';
import BadgeGalleryPage from '@/pages/badges/BadgeGalleryPage';
import { VillageInvitePage } from '@/pages/villages/VillageInvitePage'
import { AcceptVillageInvitePage } from '@/pages/villages/AcceptVillageInvitePage'
import { VillageManagePage } from '@/pages/villages/VillageManagePage'
import { VillageCreatorRoute } from '@/components/VillageCreatorRoute'

// Error pages
import { NotFoundPage } from '@/pages/errors/NotFoundPage'
import { UnauthorizedPage } from '@/pages/errors/UnauthorizedPage'
import { SuspendedPage } from '@/pages/errors/SuspendedPage'

const DashboardRouter = () => {
  const { loading, profileLoading, user, profile } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading || profileLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/auth/profile-missing" replace />
  }

  const landing = getLandingPathForRole(profile, searchParams)

  if (!landing.startsWith('/app/dashboard/')) {
    return <Navigate to={landing} replace />
  }

  const dashboardKey = landing.replace('/app/dashboard/', '')

  switch (dashboardKey) {
    case 'free':
      return <WeeklyGlancePage />
    case 'member':
      return <WeeklyGlancePage />
    case 'partner':
    case 'admin':
    case 'company':
      return <PartnerDashboard />
    default:
      return <Navigate to="/app/weekly-glance" replace />
  }
}

export const AppRoutes = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/upgrade" element={<UpgradePage />} />
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/signup" element={<AuthLayout><SignUpPage /></AuthLayout>} />
        <Route path="/join" element={<AuthLayout><ReferralLanding /></AuthLayout>} />
        <Route path="/reset-password" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />
        <Route path="/auth/profile-missing" element={<AuthLayout><ProfileMissingPage /></AuthLayout>} />
        
        {/* Account status pages */}
        <Route path="/suspended" element={<SuspendedPage />} />

        {/* Onboarding routes */}
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <WelcomePage />
            </ProtectedRoute>
          }
        />

        {/* Mentor routes */}
        <Route
          path="/mentor"
          element={
            <ProtectedRoute requiredRoles={[UserRole.MENTOR]}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<MentorDashboard />} />
          <Route path="user/:userId" element={<UserProfileManagementPage viewContext="mentor" />} />
          <Route index element={<Navigate to="/mentor/dashboard" replace />} />
        </Route>

        {/* Ambassador routes */}
        <Route
          path="/ambassador"
          element={
            <ProtectedRoute requiredRoles={[UserRole.AMBASSADOR]}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AmbassadorDashboard />} />
          <Route index element={<Navigate to="/ambassador/dashboard" replace />} />
        </Route>

        {/* Partner routes */}
        <Route
          path="/partner"
          element={
            <ProtectedRoute requiredRoles={[UserRole.PARTNER]}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<PartnerDashboard />} />
          <Route path="organization/:organizationId" element={<OrganizationDetailPage />} />
          <Route path="user/:userId" element={<UserProfileManagementPage viewContext="partner" />} />
          <Route path="partner-assignment" element={<PartnerAssignmentPage />} />
          <Route index element={<Navigate to="/partner/dashboard" replace />} />
        </Route>

        {/* Admin routes (Super Admin) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireSuperAdmin>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="organization/:organizationId" element={<OrganizationDetailPage />} />
          <Route path="user/:userId" element={<UserProfileManagementPage viewContext="partner" />} />
          <Route path="approvals" element={<ApprovalQueuePage />} />
          <Route path="partner-assignment" element={<PartnerAssignmentPage />} />
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* Legacy Super Admin redirect */}
        <Route path="/super-admin/*" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Protected main app routes */}
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Role-based redirect entrypoint */}
          <Route index element={<RoleRedirect />} />

          {/* Feature routes */}
          <Route path="journeys" element={<JourneysPage />} />
          <Route path="weekly-glance" element={<WeeklyGlancePage />} />
          <Route path="learner-dashboard" element={<LearnerDashboardPage />} />
          
          {/* Learner-specific routes with mentor restriction */}
          <Route 
            path="impact" 
            element={
              <ProtectedRoute restrictMentor>
                <ImpactLogPage />
              </ProtectedRoute>
            } 
          />
          <Route path="leaderboard" element={<Navigate to="/app/leadership-board" replace />} />
          <Route path="leadership-board" element={<LeadershipBoardPage />} />
          <Route path="weekly-checklist" element={<WeeklyUpdatesPage />} />
          <Route path="courses" element={<MyCoursesPage />} />
          <Route
            path="peer-connect"
            element={
              <FreeTierGuard
                fallbackPath="/app/weekly-glance"
                description="Peer Connect is available on paid plans."
                title="Upgrade to connect"
              >
                <PeerConnectPage />
              </FreeTierGuard>
            }
          />
          <Route
            path="leadership-council"
            element={
              <FreeTierGuard
                fallbackPath="/app/weekly-glance"
                description="Leadership Council is available on paid plans."
                title="Upgrade to access"
              >
                <LeadershipCouncilPage />
              </FreeTierGuard>
            }
          />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="referral-rewards" element={<ReferralRewardsPage />} />
          <Route path="book-club" element={<BookClubPage />} />
          <Route path="shameless-circle" element={<ShamelessCirclePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="badge-gallery" element={<BadgeGalleryPage />} />
          <Route path="villages/join/:invitationCode" element={<AcceptVillageInvitePage />} />
          <Route
            path="villages/:villageId/invite"
            element={
              <VillageCreatorRoute>
                <VillageInvitePage />
              </VillageCreatorRoute>
            }
          />
          <Route
            path="villages/:villageId/manage"
            element={
              <VillageCreatorRoute>
                <VillageManagePage />
              </VillageCreatorRoute>
            }
          />
          <Route
            path="villages/:villageId/members"
            element={
              <VillageCreatorRoute>
                <VillageManagePage />
              </VillageCreatorRoute>
            }
          />
          <Route path="dashboard/*" element={<DashboardRouter />} />
        </Route>

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
