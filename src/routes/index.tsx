import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Center, Spinner } from '@chakra-ui/react'
import { ProtectedRoute, PublicRoute } from '@/components/ProtectedRoute'
import { UserRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardRouteForRole } from '@/utils/auth'

// Layout imports
import { MainLayout } from '@/layouts/MainLayout'

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
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

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
      <Route index element={<Navigate to={defaultPath} replace />} />
    </Routes>
  )
}

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignUpPage />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />
        
        {/* Onboarding */}
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />

        {/* Protected main app routes */}
        <Route path="/" element={
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
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Default redirect based on role */}
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
