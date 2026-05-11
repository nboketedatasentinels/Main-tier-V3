import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn((_: unknown, collectionName: string, docId: string) => ({
    path: `${collectionName}/${docId}`,
  })),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  arrayRemove: vi.fn((value: string) => ({ __op: 'arrayRemove', value })),
  arrayUnion: vi.fn((value: string) => ({ __op: 'arrayUnion', value })),
  serverTimestamp: vi.fn(() => 'server-ts'),
}))

vi.mock('./firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  arrayRemove: firestoreMocks.arrayRemove,
  arrayUnion: firestoreMocks.arrayUnion,
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  serverTimestamp: firestoreMocks.serverTimestamp,
  setDoc: firestoreMocks.setDoc,
}))

import { bulkSyncPartnerOrganizations } from './partnerAssignmentSyncService'

describe('partnerAssignmentSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firestoreMocks.setDoc.mockResolvedValue(undefined)
  })

  it('removes org access from previous partner when org is reassigned', async () => {
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ transformationPartnerId: 'partner_old' }),
    })

    await bulkSyncPartnerOrganizations('partner_new', ['org_1'], [])

    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { path: 'profiles/partner_old' },
      expect.objectContaining({
        assignedOrganizations: { __op: 'arrayRemove', value: 'org_1' },
      }),
      { merge: true },
    )
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { path: 'users/partner_old' },
      expect.objectContaining({
        assignedOrganizations: { __op: 'arrayRemove', value: 'org_1' },
      }),
      { merge: true },
    )
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { path: 'organizations/org_1' },
      expect.objectContaining({
        transformationPartnerId: 'partner_new',
      }),
      { merge: true },
    )
  })

  it('does not detach assignments when existing org partner already matches', async () => {
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ transformationPartnerId: 'partner_new' }),
    })

    await bulkSyncPartnerOrganizations('partner_new', ['org_1'], [])

    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1)
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { path: 'organizations/org_1' },
      expect.objectContaining({
        transformationPartnerId: 'partner_new',
      }),
      { merge: true },
    )
  })
})
