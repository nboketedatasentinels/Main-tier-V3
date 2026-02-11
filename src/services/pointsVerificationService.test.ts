import { beforeEach, describe, expect, it, vi } from 'vitest'
import { approvePointsVerificationRequest, rejectPointsVerificationRequest } from './pointsVerificationService'
import { getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { createInAppNotification } from './notificationService'

vi.mock('@/services/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({ path: `${collectionName}/${id}`, id })),
  getDoc: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-ts'),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}))

vi.mock('./pointsService', () => ({
  awardChecklistPoints: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/config/pointsConfig', () => ({
  getActivityDefinitionById: vi.fn(() => ({
    id: 'impact_log',
    title: 'Impact Log entry',
    points: 500,
    approvalType: 'partner_approved',
    maxPerMonth: 4,
    week: 1,
    category: 'Impact',
  })),
  resolveCanonicalActivityId: vi.fn((id: string) => id),
}))

vi.mock('@/utils/journeyType', () => ({
  resolveJourneyType: vi.fn(() => '6W'),
}))

vi.mock('./notificationService', () => ({
  createInAppNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./superAdminService', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./checklistService', () => ({
  upsertChecklistActivity: vi.fn().mockResolvedValue(undefined),
}))

describe('pointsVerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        journeyType: '6W',
        programDurationWeeks: 6,
      }),
    } as never)
  })

  it('mirrors approved status into approvals and sends approval notification', async () => {
    await approvePointsVerificationRequest({
      request: {
        id: 'req-1',
        user_id: 'user-1',
        organizationId: 'org-1',
        week: 2,
        activity_id: 'impact_log',
        activity_title: 'Impact Log entry',
        points: 500,
        proof_url: 'https://example.com/proof',
        notes: 'evidence',
      },
      approver: { id: 'admin-1', name: 'Admin' },
    })

    expect(updateDoc).toHaveBeenCalled()
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'approvals/req-1' }),
      expect.objectContaining({
        status: 'approved',
        userId: 'user-1',
        type: 'points_verification',
      }),
      { merge: true },
    )
    expect(createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: 'Activity Submission Approved',
      }),
    )
  })

  it('mirrors rejected status into approvals', async () => {
    await rejectPointsVerificationRequest({
      request: {
        id: 'req-2',
        user_id: 'user-2',
        organizationId: 'org-2',
        week: 4,
        activity_id: 'impact_log',
        activity_title: 'Impact Log entry',
        points: 500,
        proof_url: 'https://example.com/proof',
      },
      approver: { id: 'admin-2', name: 'Reviewer' },
      reason: 'Insufficient evidence',
    })

    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'points_verification_requests/req-2' }),
      expect.objectContaining({ status: 'rejected' }),
    )
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'approvals/req-2' }),
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: 'Insufficient evidence',
        userId: 'user-2',
      }),
      { merge: true },
    )
  })
})
