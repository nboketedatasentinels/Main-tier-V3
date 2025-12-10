import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Center, Spinner } from '@chakra-ui/react'
import { ProtectedRoute, PublicRoute } from '@/components/ProtectedRoute'
import { UserRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardRouteForRole } from '@/utils/auth'

// Layout imports
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { HomePage } from '@/pages/home/HomePage'

// Page imports (we'll create these)
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'

// Dashboard imports
import { FreeDashboard } from '@/pages/dashboards/FreeDashboard'
import { PaidMemberDashboard } from '@/pages/dashboards/PaidMemberDashboard'
import { MentorDashboard } from '@/pages/dashboards/MentorDashboard'
import { AmbassadorDashboard } from '@/pages/dashboards/AmbassadorDashboard'
import { CompanyAdminDashboard } from '@/pages/dashboards/CompanyAdminDashboard'
import { SuperAdminDashboard } from '@/pages/dashboards/SuperAdminDashboard'

// Feature page imports
import { JourneysPage } from '@/pages/journeys/JourneysPage'
import { ImpactLogPage } from '@/pages/impact/ImpactLogPage'
import { LeaderboardPage } from '@/pages/leaderboard/LeaderboardPage'
import { LeadershipBoardPage } from '@/pages/leaderboard/LeadershipBoardPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { WeeklyUpdatesPage } from '@/pages/journeys/WeeklyUpdatesPage'
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
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <Center h="100vh" bg="brand.deepPlum">
        <Spinner size="xl" color="brand.gold" thickness="4px" />
      </Center>
    )
  }

  const defaultPath = getDashboardRouteForRole(profile?.role ?? UserRole.FREE_USER).replace(
    '/dashboard',
    ''
  )

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
      <Route path="company-admin" element={
        <ProtectedRoute requiredRoles={[UserRole.COMPANY_ADMIN]}>
          <CompanyAdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="super-admin" element={
        <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
          <SuperAdminDashboard />
        </ProtectedRoute>
      } />
      <Route index element={<Navigate to="free" replace />} />
    </Routes>
  )
}

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/signup" element={<AuthLayout><SignUpPage /></AuthLayout>} />
        <Route path="/reset-password" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />

        {/* Onboarding */}
        <Route path="/app/onboarding" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />

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
          <Route path="impact" element={<ImpactLogPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="leadership-board" element={<LeadershipBoardPage />} />
          <Route path="weekly-updates" element={<WeeklyUpdatesPage />} />
          <Route path="courses" element={<MyCoursesPage />} />
          <Route path="peer-connect" element={<PeerConnectPage />} />
          <Route path="leadership-council" element={<LeadershipCouncilPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="referral-rewards" element={<ReferralRewardsPage />} />
          <Route path="book-club" element={<BookClubPage />} />
          <Route path="shameless-circle" element={<ShamelessCirclePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Default redirect based on role */}
          <Route index element={<Navigate to="/app/dashboard/free" replace />} />
        </Route>

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
