import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizationDetailPage } from './OrganizationDetailPage'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationDetails } from '@/hooks/useOrganizationDetails'

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

vi.mock('@/hooks/useOrganizationDetails', () => ({
  useOrganizationDetails: vi.fn(),
}))

vi.mock('@/services/superAdminService', () => ({
  logAdminAction: vi.fn(),
}))

vi.mock('@/services/partnerInterventionsService', () => ({
  createIntervention: vi.fn(),
}))

vi.mock('@/services/notificationService', () => ({
  notifySupabaseUser: vi.fn(),
}))

const mockUseAuth = useAuth as unknown as {
  mockReturnValue: (value: {
    user: { uid: string } | null
    isAdmin: boolean
    isSuperAdmin: boolean
    profile?: { role?: string; fullName?: string; email?: string }
  }) => void
}

const mockUseOrganizationDetails = useOrganizationDetails as unknown as {
  mockReturnValue: (value: Record<string, unknown>) => void
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

    mockUseOrganizationDetails.mockReturnValue({
      organization: {
        id: 'org-1',
        code: 'ACME',
        name: 'Acme Org',
        status: 'active',
        teamSize: 10,
        memberCount: 1,
        courseAssignments: [],
      },
      users: [
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
      ],
      invitations: [
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
      ],
      statistics: {
        totalMembers: 1,
        activeMembers: 1,
        paidMembers: 1,
        newMembersThisWeek: 0,
        averageEngagementRate: 0,
      },
      courseTitles: [],
      loading: false,
      error: null,
      reload: vi.fn(),
      totalCount: 1,
    })
  })

  it('shows active members and pending invites in a unified Users list', async () => {
    render(
      <ChakraProvider>
        <OrganizationDetailPage />
      </ChakraProvider>,
    )

    expect(await screen.findByText('Users (3)')).toBeInTheDocument()
    expect(screen.getByText('2 pending invites')).toBeInTheDocument()
    expect(screen.getByText('Existing Member')).toBeInTheDocument()
    expect(screen.getByText('New Invitee')).toBeInTheDocument()
    expect(screen.getByText('Code Invitee')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pending invite' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Active' })).toBeInTheDocument()
    expect(screen.queryByText('Pending invitations')).not.toBeInTheDocument()
  })
})
