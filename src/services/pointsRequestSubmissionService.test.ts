import { beforeEach, describe, expect, it, vi } from 'vitest'
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import {
  PendingRequestExistsError,
  submitPointsVerificationRequestAtomic,
} from './pointsRequestSubmissionService'

vi.mock('@/services/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
    id,
    path: `${collectionName}/${id}`,
  })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-ts'),
}))

describe('pointsRequestSubmissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes points verification and approval records atomically with the same request id', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({
        exists: () => false,
        data: () => ({}),
      }),
      set: vi.fn(),
    }
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback(tx as never))

    const result = await submitPointsVerificationRequestAtomic({
      userId: 'user-1',
      organizationId: 'org-1',
      week: 3,
      activityId: 'impact_log',
      activityTitle: 'Impact Log entry',
      activityPoints: 500,
      proofUrl: 'https://example.com/proof',
      notes: 'note',
      approvalType: 'partner_approved',
    })

    expect(result.requestId).toBe('user-1__w3__impact_log')
    expect(tx.set).toHaveBeenCalledTimes(2)

    const [verificationRef, verificationPayload] = tx.set.mock.calls[0]
    const [approvalRef, approvalPayload] = tx.set.mock.calls[1]

    expect(verificationRef.path).toBe('points_verification_requests/user-1__w3__impact_log')
    expect(approvalRef.path).toBe('approvals/user-1__w3__impact_log')
    expect(verificationPayload.status).toBe('pending')
    expect(approvalPayload.status).toBe('pending')
    expect(approvalPayload.source.id).toBe('user-1__w3__impact_log')
    expect(serverTimestamp).toHaveBeenCalled()
    expect(doc).toHaveBeenCalledWith({}, 'points_verification_requests', 'user-1__w3__impact_log')
    expect(doc).toHaveBeenCalledWith({}, 'approvals', 'user-1__w3__impact_log')
  })

  it('throws PendingRequestExistsError when a pending request already exists', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'pending' }),
      }),
      set: vi.fn(),
    }
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback(tx as never))

    await expect(
      submitPointsVerificationRequestAtomic({
        userId: 'user-1',
        week: 1,
        activityId: 'impact_log',
        activityTitle: 'Impact Log entry',
        activityPoints: 500,
        proofUrl: 'https://example.com/proof',
        approvalType: 'partner_approved',
      }),
    ).rejects.toBeInstanceOf(PendingRequestExistsError)

    expect(tx.set).not.toHaveBeenCalled()
  })
})
