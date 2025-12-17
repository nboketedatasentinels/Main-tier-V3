import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { FreeTierGuard } from '@/components/FreeTierGuard'
import { useAuth } from '@/hooks/useAuth'
import RoleRedirect from '@/pages/auth/RoleRedirect'
import { getLandingPathForRole } from '@/utils/roleRouting'
import { UserRole } from '@/types'

// Layout imports
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { HomePage } from '@/pages/home/HomePage'

// Page imports
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { ProfileMissingPage } from '@/pages/auth/ProfileMissingPage'
import { EmailVerificationPage } from '@/pages/auth/EmailVerificationPage'
import { UpgradePage } from '@/pages/upgrade/UpgradePage'

// Onboarding imports
import { WelcomePage } from '@/pages/onboarding/WelcomePage'

// Dashboard imports
import { FreeDashboard } from '@/pages/dashboards/FreeDashboard'
import { PaidMemberDashboard } from '@/pages/dashboards/PaidMemberDashboard'
import { MentorDashboard } from '@/pages/dashboards/MentorDashboard'
import { AmbassadorDashboard } from '@/pages/dashboards/AmbassadorDashboard'
import { AdminDashboard } from '@/pages/dashboards/AdminDashboard'
import { SuperAdminDashboard } from '@/pages/dashboards/SuperAdminDashboard'

// Feature page imports
import { JourneysPage } from '@/pages/journeys/JourneysPage'
import { ImpactLogPage } from '@/pages/impact/ImpactLogPage'
import { LeaderboardPage } from '@/pages/leaderboard/LeaderboardPage'
import { LeadershipBoardPage } from '@/pages/leaderboard/LeadershipBoardPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { WeeklyUpdatesPage } from '@/pages/journeys/WeeklyUpdatesPage'
import { WeeklyGlancePage } from '@/pages/journeys/WeeklyGlancePage'
import { MyCoursesPage } from '@/pages/courses/MyCoursesPage'
import { PeerConnectPage } from '@/pages/peer/PeerConnectPage'
import { LeadershipCouncilPage } from '@/pages/leadership/LeadershipCouncilPage'
import { AnnouncementsPage } from '@/pages/community/AnnouncementsPage'
import { ReferralRewardsPage } from '@/pages/community/ReferralRewardsPage'
import { BookClubPage } from '@/pages/community/BookClubPage'
import { ShamelessCirclePage } from '@/pages/community/ShamelessCirclePage'

// Error pages
import { NotFoundPage } from '@/pages/errors/NotFoundPage'
import { UnauthorizedPage } from '@/pages/errors/UnauthorizedPage'
import { SuspendedPage } from '@/pages/errors/SuspendedPage'

// Dashboard router component
const DashboardRouter = () => {
  const { profile, profileLoading } = useAuth()
  const location = useLocation()

  if (profileLoading) {
    return null // Or a loading spinner
  }

  const landingPath = getLandingPathForRole(profile)

  // If the calculated landing path is NOT a nested dashboard route,
  // it means the user should be somewhere else entirely (e.g., /admin/dashboard).
  // The navigate component will handle the absolute path redirect.
  if (!landingPath.startsWith('/app/dashboard/')) {
    return <Navigate to={landingPath} replace />
  }

  // If the user is already at the correct dashboard, render the routes.
  // Otherwise, redirect them to the correct nested dashboard path.
  if (location.pathname === landingPath) {
    return (
      <Routes>
        <Route path="free" element={<FreeDashboard />} />
        <Route path="member" element={<PaidMemberDashboard />} />
        {/* Ambassador dashboard is now a top-level route, but we keep this for legacy URLs */}
        <Route path="ambassador" element={<Navigate to="/ambassador/dashboard" replace />} />
      </Routes>
    )
  }

  return <Navigate to={landingPath} replace />
}

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/upgrade" element={<UpgradePage />} />
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/signup" element={<AuthLayout><SignUpPage /></AuthLayout>} />
        <Route path="/reset-password" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />
        <Route path="/auth/profile-missing" element={<AuthLayout><ProfileMissingPage /></AuthLayout>} />
        <Route path="/auth/verify-email" element={<AuthLayout><EmailVerificationPage /></AuthLayout>} />
        
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

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRoles={[UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* Super Admin routes */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
        </Route>

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

          {/* Dashboard routes */}
          <Route path="dashboard/*" element={<DashboardRouter />} />

          {/* Feature routes */}
          <Route path="journeys" element={<JourneysPage />} />
          <Route path="weekly-glance" element={<WeeklyGlancePage />} />
          
          {/* Learner-specific routes with mentor restriction */}
          <Route 
            path="impact" 
            element={
              <ProtectedRoute restrictMentor>
                <ImpactLogPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="leaderboard" 
            element={
              <ProtectedRoute restrictMentor>
                <LeaderboardPage />
              </ProtectedRoute>
            } 
          />
          <Route path="leadership-board" element={<LeadershipBoardPage />} />
          <Route path="weekly-checklist" element={<WeeklyUpdatesPage />} />
          <Route path="courses" element={<MyCoursesPage />} />
          <Route
            path="peer-connect"
            element={
              <FreeTierGuard
                fallbackPath="/app/dashboard/free"
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
                fallbackPath="/app/dashboard/free"
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
        </Route>

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}