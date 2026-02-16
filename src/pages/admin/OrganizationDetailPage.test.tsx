import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizationDetailPage } from './OrganizationDetailPage'
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

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ organizationId: 'acme' }),
    useNavigate: () => mockNavigate,
  }
})

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

vi.mock('@/services/superAdminService', () => ({
  logAdminAction: vi.fn(),
}))

const mockUseAuth = useAuth as unknown as {
  mockReturnValue: (value: {
    user: { uid: string } | null
    isAdmin: boolean
    isSuperAdmin: boolean
    profile?: { role?: string; fullName?: string; email?: string }
  }) => void
}

describe('OrganizationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { uid: 'partner-1' },
      isAdmin: true,
      isSuperAdmin: false,
      profile: { role: 'partner', fullName: 'Partner Admin', email: 'partner@example.com' },
    })

    ;(fetchOrganizationByCode as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      id: 'org-1',
      code: 'ACME',
      name: 'Acme Org',
      status: 'active',
      courseAssignments: [],
    })
    ;(canAccessOrganization as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(true)
    ;(fetchOrganizationUsers as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
      {
        id: 'user-1',
        name: 'Existing Member',
        email: 'existing.member@example.com',
        role: 'user',
        membershipStatus: 'paid',
        accountStatus: 'active',
        lastActive: new Date('2026-02-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])
    ;(fetchOrganizationInvitations as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
      {
        id: 'inv-existing',
        name: 'Invited Existing',
        email: 'Existing.Member@Example.com',
        role: 'user',
        method: 'email',
        status: 'pending',
        createdAt: new Date('2026-01-20T00:00:00.000Z'),
      },
      {
        id: 'inv-new',
        name: 'New Invitee',
        email: 'new.user@example.com',
        role: 'user',
        method: 'email',
        status: 'pending',
        createdAt: new Date('2026-01-21T00:00:00.000Z'),
      },
      {
        id: 'inv-code',
        name: 'Code Invitee',
        role: 'user',
        method: 'one_time_code',
        status: 'pending',
        code: 'ABCD1234',
        createdAt: new Date('2026-01-22T00:00:00.000Z'),
      },
    ])
    ;(
      fetchOrganizationEngagementStats as unknown as { mockResolvedValue: (value: unknown) => void }
    ).mockResolvedValue({
      totalMembers: 1,
      activeMembers: 1,
      paidMembers: 1,
      newMembersThisWeek: 0,
      averageEngagementRate: 80,
    })
    ;(fetchAvailableCourses as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([])
    ;(fetchUserProfileById as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(null)
  })

  it('shows only unresolved pending invites and keeps existing members in Users', async () => {
    render(
      <ChakraProvider>
        <OrganizationDetailPage />
      </ChakraProvider>,
    )

    expect(await screen.findByText('Pending invitations (2)', {}, { timeout: 15000 })).toBeInTheDocument()

    expect(screen.getByText('2 action needed')).toBeInTheDocument()
    expect(screen.queryByText('Invited Existing')).not.toBeInTheDocument()
    expect(screen.getByText('New Invitee')).toBeInTheDocument()
    expect(screen.getByText('Code Invitee')).toBeInTheDocument()

    expect(screen.getByText('Users (1 of 1)')).toBeInTheDocument()
    expect(screen.getByText('Existing Member')).toBeInTheDocument()
    expect(logOrganizationAccessAttempt).not.toHaveBeenCalled()
  }, 20000)
})
