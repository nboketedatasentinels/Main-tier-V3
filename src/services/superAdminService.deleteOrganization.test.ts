import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDoc,
  arrayRemove,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { deleteOrganization } from './superAdminService'

describe('superAdminService.deleteOrganization', () => {
  const batchUpdateMock = vi.fn()
  const batchDeleteMock = vi.fn()
  const batchCommitMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    batchUpdateMock.mockReset()
    batchDeleteMock.mockReset()
    batchCommitMock.mockReset()
    batchCommitMock.mockResolvedValue(undefined)
    vi.mocked(doc).mockImplementation((_: unknown, collectionName: string, docId: string) => ({
      path: `${collectionName}/${docId}`,
    }) as never)
    vi.mocked(arrayRemove).mockImplementation((value: string) => ({ __op: 'arrayRemove', value }) as never)
    vi.mocked(serverTimestamp).mockImplementation(() => 'server-ts' as never)
    vi.mocked(addDoc).mockResolvedValue({ id: 'recovery_marker_1' } as never)
    vi.mocked(writeBatch).mockImplementation(() => ({
      update: batchUpdateMock,
      delete: batchDeleteMock,
      commit: batchCommitMock,
    }) as never)
  })

  it('detaches org references from users/profiles before deleting org', async () => {
    const profileRef = { path: 'profiles/user_1' }
    const userRefA = { path: 'users/user_1' }
    const userRefB = { path: 'users/user_2' }

    vi.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [{ ref: profileRef }],
      } as never)
      .mockResolvedValueOnce({
        docs: [{ ref: userRefA }, { ref: userRefB }],
      } as never)

    await deleteOrganization('org_1')

    expect(getDocs).toHaveBeenCalledTimes(2)
    expect(batchUpdateMock).toHaveBeenCalledWith(
      profileRef,
      expect.objectContaining({
        assignedOrganizations: { __op: 'arrayRemove', value: 'org_1' },
        assignedOrganizationsUpdatedAt: 'server-ts',
      }),
    )
    expect(batchUpdateMock).toHaveBeenCalledWith(
      userRefA,
      expect.objectContaining({
        assignedOrganizations: { __op: 'arrayRemove', value: 'org_1' },
      }),
    )
    expect(batchUpdateMock).toHaveBeenCalledWith(
      userRefB,
      expect.objectContaining({
        assignedOrganizations: { __op: 'arrayRemove', value: 'org_1' },
      }),
    )
    expect(batchDeleteMock).toHaveBeenCalledWith({ path: 'organizations/org_1' })
    expect(batchCommitMock).toHaveBeenCalledTimes(1)
  })

  it('splits writes across batches when assignment updates exceed the batch delete threshold', async () => {
    const profileRefs = Array.from({ length: 500 }, (_, index) => ({
      path: `profiles/user_${index + 1}`,
    }))

    vi.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: profileRefs.map((ref) => ({ ref })),
      } as never)
      .mockResolvedValueOnce({
        docs: [],
      } as never)

    await deleteOrganization('org_big')

    expect(writeBatch).toHaveBeenCalledTimes(2)
    expect(batchUpdateMock).toHaveBeenCalledTimes(500)
    expect(batchDeleteMock).toHaveBeenCalledWith({ path: 'organizations/org_big' })
    expect(batchDeleteMock).toHaveBeenCalledTimes(1)
    expect(batchCommitMock).toHaveBeenCalledTimes(2)
  })

  it('records a recovery marker with context when a batch commit fails', async () => {
    const profileRef = { path: 'profiles/user_1' }

    vi.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [{ ref: profileRef }],
      } as never)
      .mockResolvedValueOnce({
        docs: [],
      } as never)

    batchCommitMock.mockRejectedValueOnce(new Error('commit failed'))

    await expect(deleteOrganization('org_fail')).rejects.toMatchObject({
      message: expect.stringContaining('Recovery marker recovery_marker_1'),
      recoveryMarkerId: 'recovery_marker_1',
      recoveryContext: expect.objectContaining({
        organizationId: 'org_fail',
        processedCount: 0,
        remainingCount: 1,
      }),
    })

    expect(addDoc).toHaveBeenCalledTimes(1)
    const markerPayload = vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>
    expect(markerPayload.organizationId).toBe('org_fail')
    expect(markerPayload.status).toBe('pending_recovery')
    expect(markerPayload.attemptedUserIds).toEqual(['user_1'])
    expect(markerPayload.remainingCount).toBe(1)
    expect(markerPayload.totalAssignmentRefs).toBe(1)
  })
})
