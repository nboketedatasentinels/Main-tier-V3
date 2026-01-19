import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrganizationDetails } from '@/hooks/useOrganizationDetails'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import {
  checkOrganizationAccess,
  fetchAvailableCourses,
  fetchOrganizationByCode,
  fetchOrganizationEngagementStats,
  fetchOrganizationUsers,
  logOrganizationAccessAttempt,
} from '@/services/organizationService'
import { fetchUserProfileById } from '@/services/userProfileService'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/partner/usePartnerAdminSnapshot', () => ({
  usePartnerAdminSnapshot: vi.fn(),
}))

vi.mock('@/services/organizationService', () => ({
  checkOrganizationAccess: vi.fn(),
  fetchAvailableCourses: vi.fn(),
  fetchOrganizationByCode: vi.fn(),
  fetchOrganizationEngagementStats: vi.fn(),
  fetchOrganizationUsers: vi.fn(),
  logOrganizationAccessAttempt: vi.fn(),
}))

vi.mock('@/services/userProfileService', () => ({
  fetchUserProfileById: vi.fn(),
}))

const mockUseAuth = useAuth as unknown as {
  mockReturnValue: (value: {
    user: { uid: string } | null
    isAdmin: boolean
    isSuperAdmin: boolean
  }) => void
}

const mockUsePartnerAdminSnapshot = usePartnerAdminSnapshot as unknown as {
  mockReturnValue: (value: {
    assignedOrganizationIds: string[]
    assignedOrganizationCodes: string[]
  }) => void
}

const TestComponent = () => {
  const { error, loading, organization } = useOrganizationDetails('acme')
  if (loading) {
    return <div data-testid="status">loading</div>
  }
  if (error) {
    return <div data-testid="status">{error}</div>
  }
  return <div data-testid="status">{organization?.code}</div>
}

describe('useOrganizationDetails partner access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { uid: 'partner-1' },
      isAdmin: true,
      isSuperAdmin: false,
    })
    mockUsePartnerAdminSnapshot.mockReturnValue({
      assignedOrganizationIds: [],
      assignedOrganizationCodes: ['acme'],
    })
    ;(fetchOrganizationByCode as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      id: 'org-1',
      code: 'ACME',
      name: 'Acme Org',
      status: 'active',
      courseAssignments: [],
    })
    ;(checkOrganizationAccess as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      authorized: false,
    })
    ;(fetchOrganizationUsers as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([])
    ;(
      fetchOrganizationEngagementStats as unknown as { mockResolvedValue: (value: unknown) => void }
    ).mockResolvedValue({
      totalMembers: 0,
      activeMembers: 0,
      paidMembers: 0,
      newMembersThisWeek: 0,
      averageEngagementRate: 0,
    })
    ;(fetchAvailableCourses as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([])
    ;(fetchUserProfileById as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null)
  })

  it('authorizes partners assigned only by company code', async () => {
    render(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ACME')
    })

    expect(logOrganizationAccessAttempt).not.toHaveBeenCalled()
  })
})
