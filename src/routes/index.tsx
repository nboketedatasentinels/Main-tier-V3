import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { FreeTierGuard } from '@/components/FreeTierGuard'
import { UserRole } from '@/types'
import RoleRedirect from '@/pages/auth/RoleRedirect'

// Layout imports
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { HomePage } from '@/pages/home/HomePage'

// Page imports (we'll create these)
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { ProfileMissingPage } from '@/pages/auth/ProfileMissingPage'
import { UpgradePage } from '@/pages/upgrade/UpgradePage'

// Dashboard imports
import { AdminDashboard } from '@/pages/dashboards/AdminDashboard'
import { SuperAdminDashboard } from '@/pages/dashboards/SuperAdminDashboard'
import { MentorDashboard } from '@/pages/dashboards/MentorDashboard'

// Feature page imports
import { JourneysPage } from '@/pages/journeys/JourneysPage'
import { ImpactLogPage } from '@/pages/impact/ImpactLogPage'
import { LeaderboardPage } from '@/pages/leaderboard/LeaderboardPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
<<<<<<< HEAD
import { SettingsPage } from '@/pages/settings/SettingsPage'
=======
import { WeeklyUpdatesPage } from '@/pages/journeys/WeeklyUpdatesPage'
import { WeeklyGlancePage } from '@/pages/journeys/WeeklyGlancePage'
import { MyCoursesPage } from '@/pages/courses/MyCoursesPage'
import { PeerConnectPage } from '@/pages/peer/PeerConnectPage'
import { LeadershipCouncilPage } from '@/pages/leadership/LeadershipCouncilPage'
import { AnnouncementsPage } from '@/pages/community/AnnouncementsPage'
import { ReferralRewardsPage } from '@/pages/community/ReferralRewardsPage'
import { BookClubPage } from '@/pages/community/BookClubPage'
import { ShamelessCirclePage } from '@/pages/community/ShamelessCirclePage'
>>>>>>> origin/Sign-In/Up

// Error pages
import { NotFoundPage } from '@/pages/errors/NotFoundPage'
import { UnauthorizedPage } from '@/pages/errors/UnauthorizedPage'

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
            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.COMPANY_ADMIN]}>
              <MainLayout />
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
              <MainLayout />
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

          {/* Feature routes */}
          <Route path="journeys" element={<JourneysPage />} />
          <Route path="weekly-glance" element={<WeeklyGlancePage />} />
          <Route path="impact" element={<ImpactLogPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
<<<<<<< HEAD
=======
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
>>>>>>> origin/Sign-In/Up
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
