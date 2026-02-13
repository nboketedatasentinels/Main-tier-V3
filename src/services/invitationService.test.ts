import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((target: { path?: string }, docId: string) => ({ path: `${target.path || ''}/${docId}` })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  query: vi.fn((...parts: unknown[]) => ({ parts })),
  serverTimestamp: vi.fn(() => 'server-ts'),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}))

vi.mock('./firebase', () => ({
  db: {},
}))

vi.mock('./capacityService', () => ({
  checkCapacityThresholds: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  addDoc: firestoreMocks.addDoc,
  collection: firestoreMocks.collection,
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  getDocs: firestoreMocks.getDocs,
  limit: firestoreMocks.limit,
  query: firestoreMocks.query,
  serverTimestamp: firestoreMocks.serverTimestamp,
  setDoc: firestoreMocks.setDoc,
  updateDoc: firestoreMocks.updateDoc,
  where: firestoreMocks.where,
}))

import { resolvePendingInvitationOrganization } from './invitationService'

describe('invitationService.resolvePendingInvitationOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no invitations exist for the email', async () => {
    firestoreMocks.getDocs.mockResolvedValue({ empty: true, docs: [] })

    const result = await resolvePendingInvitationOrganization('new.user@example.com')

    expect(result).toBeNull()
  })

  it('returns the latest active pending email invitation organization', async () => {
    firestoreMocks.getDocs.mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'inv-old',
          data: () => ({
            status: 'pending',
            method: 'email',
            organizationId: 'org_old',
            createdAt: { seconds: 100 },
          }),
        },
        {
          id: 'inv-new',
          data: () => ({
            status: 'pending',
            method: 'email',
            organizationId: 'org_new',
            createdAt: { seconds: 200 },
          }),
        },
      ],
    })

    firestoreMocks.getDoc.mockImplementation(async (ref: { path: string }) => {
      if (ref.path === 'organizations/org_new') {
        return {
          exists: () => true,
          data: () => ({
            code: 'NEW123',
            name: 'New Organization',
            status: 'active',
            programDuration: 3,
          }),
        }
      }
      if (ref.path === 'organizations/org_old') {
        return {
          exists: () => true,
          data: () => ({
            code: 'OLD123',
            name: 'Old Organization',
            status: 'active',
            programDurationWeeks: 6,
          }),
        }
      }
      return { exists: () => false }
    })

    const result = await resolvePendingInvitationOrganization('invitee@example.com')

    expect(result).toEqual({
      organizationId: 'org_new',
      organizationCode: 'NEW123',
      organizationName: 'New Organization',
      journeyType: '3M',
      programDurationWeeks: 12,
      cohortStartDate: null,
    })
  })

  it('skips invitations for inactive organizations and returns null when no active org remains', async () => {
    firestoreMocks.getDocs.mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'inv-1',
          data: () => ({
            status: 'pending',
            method: 'email',
            organizationId: 'org_inactive',
            createdAt: { seconds: 300 },
          }),
        },
        {
          id: 'inv-2',
          data: () => ({
            status: 'accepted',
            method: 'email',
            organizationId: 'org_active',
            createdAt: { seconds: 400 },
          }),
        },
      ],
    })

    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        code: 'INACT1',
        name: 'Inactive Org',
        status: 'inactive',
      }),
    })

    const result = await resolvePendingInvitationOrganization('invitee@example.com')

    expect(result).toBeNull()
  })
})
