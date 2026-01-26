import { describe, it, expect, vi, beforeEach } from 'vitest'
import { creditReferralPoints } from './referralService'
import { runTransaction, doc } from 'firebase/firestore'
import { createInAppNotification } from './notificationService'

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}))

vi.mock('@/services/firebase', () => ({
  db: {},
}))

vi.mock('./notificationService', () => ({
  createInAppNotification: vi.fn(),
}))

vi.mock('@/utils/points', () => ({
  calculateLevel: vi.fn(() => 2),
}))

vi.mock('@/config/pointsConfig', () => ({
  REFERRAL_POINTS: 100,
  REFERRAL_MAX_PER_USER: 100,
}))

describe('referralService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('creditReferralPoints', () => {
    it('should credit points and send notifications', async () => {
      const referredUid = 'referred-user'
      const referrerUid = 'referrer-user'

      // Mock transaction
      const mockTx = {
        get: vi.fn(),
        set: vi.fn(),
      }
      vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
        return callback(mockTx)
      })

      // Mock referral data
      mockTx.get.mockImplementation(async (ref) => {
        if (ref === 'referral-ref') {
          return {
            exists: () => true,
            data: () => ({
              referrerUid,
              status: 'pending',
            }),
          }
        }
        if (ref === 'referrer-user-ref') {
          return {
            exists: () => true,
            data: () => ({
              totalPoints: 500,
              referralCount: 0,
            }),
          }
        }
        return { exists: () => false }
      })

      // Mock doc creation to return identifiable strings for matching
      vi.mocked(doc).mockImplementation((_coll, id) => {
        if (id === referredUid) return 'referral-ref' as unknown as ReturnType<typeof doc>
        if (id === referrerUid) return 'referrer-user-ref' as unknown as ReturnType<typeof doc>
        return 'other-ref' as unknown as ReturnType<typeof doc>
      })

      const result = await creditReferralPoints(referredUid)

      expect(result.success).toBe(true)
      expect(mockTx.set).toHaveBeenCalled()

      // Verify notification was sent
      expect(createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
        userId: referrerUid,
        type: 'referral_success',
      }))

      // Verify tier reward notification (1st referral reached)
      expect(createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: 'referral_reward',
        title: expect.stringContaining('First Referral'),
      }))
    })
  })
})
