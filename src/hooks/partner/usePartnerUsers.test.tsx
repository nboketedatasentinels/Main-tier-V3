import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { usePartnerUsers } from '@/hooks/partner/usePartnerUsers'
import { useAuth } from '@/hooks/useAuth'

type FirestoreDocSnapshot = {
  id: string
  data: () => Record<string, unknown>
}

type FirestoreDocChange = {
  type: 'added' | 'modified' | 'removed'
  doc: FirestoreDocSnapshot
}

type FirestoreSnapshot = {
  docs: FirestoreDocSnapshot[]
  docChanges: () => FirestoreDocChange[]
}

const snapshotCallbacks: Array<(snapshot: FirestoreSnapshot) => void> = []

vi.mock('@/services/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ type: 'collection' })),
  onSnapshot: vi.fn((_queryRef: unknown, onNext: (snapshot: FirestoreSnapshot) => void) => {
    snapshotCallbacks.push(onNext)
    return vi.fn()
  }),
  query: vi.fn(() => ({ type: 'query' })),
  where: vi.fn(() => ({ type: 'where' })),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/useRetryLogic', () => ({
  useRetryLogic: vi.fn(() => ({
    setMounted: vi.fn(),
    reset: vi.fn(),
    scheduleRetry: vi.fn(),
    cleanup: vi.fn(),
  })),
}))

vi.mock('@/hooks/partner/useWeeklyPointsFetcher', () => ({
  useWeeklyPointsFetcher: vi.fn(() => ({
    fetchWeeklyPointsByUser: vi.fn(async () => ({
      pointsByUser: {},
      hasPartialFailure: false,
      errors: [],
    })),
  })),
}))

const mockUseAuth = useAuth as unknown as {
  mockReturnValue: (value: {
    isSuperAdmin: boolean
    profileStatus: string
    assignedOrganizations: string[]
  }) => void
}

const baseOptions = {
  selectedOrg: 'all',
  assignedOrgKeys: new Set<string>(),
  organizationLookup: new Map<string, string>(),
  organizationsReady: true,
  enabled: true,
}

const TestComponent = () => {
  const { users } = usePartnerUsers(baseOptions)
  return <div data-testid="user-count">{users.length}</div>
}

describe('usePartnerUsers removals', () => {
  beforeEach(() => {
    snapshotCallbacks.length = 0
    mockUseAuth.mockReturnValue({
      isSuperAdmin: true,
      profileStatus: 'ready',
      assignedOrganizations: [],
    })
  })

  it('removes users when the snapshot reports removals', async () => {
    render(<TestComponent />)

    await waitFor(() => {
      expect(snapshotCallbacks.length).toBe(1)
    })

    const doc: FirestoreDocSnapshot = {
      id: 'user-1',
      data: () => ({
        name: 'User One',
        email: 'user@example.com',
        accountStatus: 'active',
        companyCode: 'acme',
        createdAt: new Date().toISOString(),
        programStartDate: new Date().toISOString(),
      }),
    }

    snapshotCallbacks[0]({
      docs: [doc],
      docChanges: () => [{ type: 'added', doc }],
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-count').textContent).toBe('1')
    })

    snapshotCallbacks[0]({
      docs: [],
      docChanges: () => [{ type: 'removed', doc }],
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-count').textContent).toBe('0')
    })
  })
})
