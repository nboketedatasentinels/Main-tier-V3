import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrganizationDetails } from '@/hooks/useOrganizationDetails'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchAvailableCourses,
  fetchOrganizationByCode,
  fetchOrganizationEngagementStats,
  fetchOrganizationInvitations,
  fetchOrganizationUsers,
  logOrganizationAccessAttempt,
} from '@/services/organizationService'
import { canAccessOrganization } from '@/services/organizationAccessService'
import { fetchUserProfileById } from '@/services/userProfileService'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/services/organizationService', () => ({
  fetchAvailableCourses: vi.fn(),
  fetchOrganizationByCode: vi.fn(),
  fetchOrganizationEngagementStats: vi.fn(),
  fetchOrganizationInvitations: vi.fn(),
  fetchOrganizationUsers: vi.fn(),
  logOrganizationAccessAttempt: vi.fn(),
}))

vi.mock('@/services/organizationAccessService', () => ({
  canAccessOrganization: vi.fn(),
}))

vi.mock('@/services/userProfileService', () => ({
  fetchUserProfileById: vi.fn(),
}))

const mockUseAuth = useAuth as unknown as {
  mockReturnValue: (value: {
    user: { uid: string } | null
    isAdmin: boolean
    isSuperAdmin: boolean
    profile?: { role?: string }
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
      profile: { role: 'partner' },
    })
    ;(fetchOrganizationByCode as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      id: 'org-1',
      code: 'ACME',
      name: 'Acme Org',
      status: 'active',
      courseAssignments: [],
    })
    ;(canAccessOrganization as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(true)
    ;(fetchOrganizationUsers as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([])
    ;(fetchOrganizationInvitations as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([])
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

  it('authorizes partners via centralized access resolver', async () => {
    render(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ACME')
    })

    expect(logOrganizationAccessAttempt).not.toHaveBeenCalled()
  })
})
