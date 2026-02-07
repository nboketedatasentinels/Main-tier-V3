import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { UserProfileManagementPage } from './UserProfileManagementPage'

// Mock matchMedia (Chakra + responsive hooks)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ userId: 'user_123' }),
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/services/userProfileService', () => ({
  fetchImpactLogSummary: vi.fn(),
  fetchOrganizationDetails: vi.fn(),
  fetchUserBadges: vi.fn(),
  fetchUserProfileById: vi.fn(),
  logUserProfileAccess: vi.fn(),
  updateUserProfile: vi.fn(),
}))

vi.mock('@/services/userManagementService', () => ({
  deleteUserAccount: vi.fn(),
  fetchOrganizationsList: vi.fn(),
}))

vi.mock('@/hooks/useUserWeeklyProgressSnapshot', () => ({
  useUserWeeklyProgressSnapshot: vi.fn(),
}))

vi.mock('@/hooks/useUserChecklistProgressSnapshot', () => ({
  useUserChecklistProgressSnapshot: vi.fn(),
}))

import { useAuth } from '@/hooks/useAuth'
import {
  fetchImpactLogSummary,
  fetchOrganizationDetails,
  fetchUserBadges,
  fetchUserProfileById,
  logUserProfileAccess,
} from '@/services/userProfileService'
import { useUserWeeklyProgressSnapshot } from '@/hooks/useUserWeeklyProgressSnapshot'
import { useUserChecklistProgressSnapshot } from '@/hooks/useUserChecklistProgressSnapshot'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchUserProfileById = vi.mocked(fetchUserProfileById)
const mockFetchUserBadges = vi.mocked(fetchUserBadges)
const mockFetchImpactLogSummary = vi.mocked(fetchImpactLogSummary)
const mockFetchOrganizationDetails = vi.mocked(fetchOrganizationDetails)
const mockLogUserProfileAccess = vi.mocked(logUserProfileAccess)
const mockUseUserWeeklyProgressSnapshot = vi.mocked(useUserWeeklyProgressSnapshot)
const mockUseUserChecklistProgressSnapshot = vi.mocked(useUserChecklistProgressSnapshot)

describe('UserProfileManagementPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      profile: { id: 'viewer_1', role: 'partner' },
      isMentor: false,
      isAdmin: true,
      isSuperAdmin: false,
      canAccessOrganization: vi.fn().mockResolvedValue(true),
    })

    mockFetchUserProfileById.mockResolvedValue({
      id: 'user_123',
      fullName: 'Test User',
      email: 'test@example.com',
      role: 'paid_member',
      membershipStatus: 'paid',
      accountStatus: 'active',
      companyId: 'org_1',
      companyCode: 'ACME',
      totalPoints: 999,
      level: 3,
      currentWeek: 2,
      goalsCompleted: 0,
      goalsTotal: 0,
      milestonesProgress: 0,
      weeklyActivity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    mockFetchOrganizationDetails.mockResolvedValue({ id: 'org_1', name: 'Acme Inc', code: 'ACME', status: 'active' })
    mockFetchUserBadges.mockResolvedValue([])
    mockFetchImpactLogSummary.mockResolvedValue({ totalEntries: 0, lastActivityAt: null })
    mockLogUserProfileAccess.mockResolvedValue(undefined)

    mockUseUserWeeklyProgressSnapshot.mockReturnValue({
      weeklyProgress: {
        weekNumber: 2,
        pointsEarned: 120,
        engagementCount: 3,
        status: 'on_track',
      },
      pendingApprovals: null,
      loading: false,
      error: null,
    })

    mockUseUserChecklistProgressSnapshot.mockReturnValue({
      checklistProgress: {
        weekNumber: 2,
        totalActivities: 8,
        completedActivities: 5,
        updatedAt: new Date().toISOString(),
      },
      loading: false,
      error: null,
    })
  })

  it('shows live weekly activity from weeklyProgress when not editing', async () => {
    render(
      <ChakraProvider>
        <UserProfileManagementPage viewContext="partner" />
      </ChakraProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Activity & engagement')).toBeInTheDocument()
    })

    const input = screen.getByLabelText(/weekly activity/i) as HTMLInputElement
    expect(input.value).toBe('3')

    expect(screen.getByText(/this week \(week 2\)/i)).toBeInTheDocument()
    expect(screen.getByText('120 points · 3 activities')).toBeInTheDocument()
  })

  it('shows the viewed user role and organization access (not the viewer)', async () => {
    mockUseAuth.mockReturnValue({
      profile: { id: 'viewer_1', role: 'super_admin' },
      isMentor: false,
      isAdmin: true,
      isSuperAdmin: true,
      canAccessOrganization: vi.fn().mockResolvedValue(true),
    })

    render(
      <ChakraProvider>
        <UserProfileManagementPage viewContext="partner" />
      </ChakraProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Access & status')).toBeInTheDocument()
    })

    expect(screen.getByText('User role')).toBeInTheDocument()
    expect(screen.getByText('Paid Member')).toBeInTheDocument()
    expect(screen.queryByText(/viewer role/i)).not.toBeInTheDocument()
    expect(screen.queryByText('All organizations')).not.toBeInTheDocument()
    expect(screen.getByText('Acme Inc (ACME)')).toBeInTheDocument()
  })
})
