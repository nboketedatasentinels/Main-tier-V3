import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { FreeTierGuard } from '@/components/FreeTierGuard'
import { UserRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'

// Layout imports
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { HomePage } from '@/pages/home/HomePage'

// Page imports (we'll create these)
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { UpgradePage } from '@/pages/upgrade/UpgradePage'

// Dashboard imports
import { FreeDashboard } from '@/pages/dashboards/FreeDashboard'
import { PaidMemberDashboard } from '@/pages/dashboards/PaidMemberDashboard'
import { MentorDashboard } from '@/pages/dashboards/MentorDashboard'
import { AmbassadorDashboard } from '@/pages/dashboards/AmbassadorDashboard'
import { AdminDashboard } from '@/pages/dashboards/AdminDashboard'
import { CompanyDashboard } from '@/components/dashboard/CompanyDashboard'

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

// Dashboard router component
const DashboardRouter = () => {
  const { loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="free" element={
        <ProtectedRoute requiredRoles={[UserRole.FREE_USER]}>
          <FreeDashboard />
        </ProtectedRoute>
      } />
      <Route path="member" element={
        <ProtectedRoute requiredRoles={[UserRole.PAID_MEMBER]}>
          <PaidMemberDashboard />
        </ProtectedRoute>
      } />
      <Route path="mentor" element={
        <ProtectedRoute requiredRoles={[UserRole.MENTOR]}>
          <MentorDashboard />
        </ProtectedRoute>
      } />
      <Route path="ambassador" element={
        <ProtectedRoute requiredRoles={[UserRole.AMBASSADOR]}>
          <AmbassadorDashboard />
        </ProtectedRoute>
      } />
      <Route path="company" element={
        <ProtectedRoute>
          <CompanyDashboard />
        </ProtectedRoute>
      } />
      <Route index element={<Navigate to="company" replace />} />
    </Routes>
  )
}

const PostLoginRedirect = () => {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (loading) return

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    const dashboardPath = getDashboardPathForRole(profile?.role)

    if (!dashboardPath) return

    navigate(dashboardPath, { replace: true })
  }, [user, profile, loading, navigate])

  return null
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

        <Route
          path="/mentor/dashboard"
          element={
            <ProtectedRoute requiredRoles={[UserRole.MENTOR]}>
              <MentorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

      {/* Protected main app routes */}
      <Route path="/app" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
          {/* Dashboard routes */}
          <Route path="dashboard/*" element={<DashboardRouter />} />
          
          {/* Feature routes */}
          <Route path="journeys" element={<JourneysPage />} />
          <Route path="weekly-glance" element={<WeeklyGlancePage />} />
          <Route path="impact" element={<ImpactLogPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="leadership-board" element={<LeadershipBoardPage />} />
          <Route path="weekly-checklist" element={<WeeklyUpdatesPage />} />
          <Route path="courses" element={<MyCoursesPage />} />
          <Route
            path="peer-connect"
            element={
              <FreeTierGuard fallbackPath="/app/dashboard/free" description="Peer Connect is available on paid plans." title="Upgrade to connect">
                <PeerConnectPage />
              </FreeTierGuard>
            }
          />
          <Route
            path="leadership-council"
            element={
              <FreeTierGuard fallbackPath="/app/dashboard/free" description="Leadership Council is available on paid plans." title="Upgrade to access">
                <LeadershipCouncilPage />
              </FreeTierGuard>
            }
          />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="referral-rewards" element={<ReferralRewardsPage />} />
          <Route path="book-club" element={<BookClubPage />} />
          <Route path="shameless-circle" element={<ShamelessCirclePage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* Default redirect based on role */}
        <Route index element={<PostLoginRedirect />} />
      </Route>

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
