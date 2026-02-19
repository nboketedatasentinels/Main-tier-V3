import { beforeEach, describe, expect, it, vi } from 'vitest'
import { creditReferralPoints } from './referralService'
import { doc, getDoc } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  where: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('@/services/firebase', () => ({
  db: {},
  functions: {},
}))

describe('referralService.creditReferralPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success when referral remains pending (handled by Cloud Function trigger)', async () => {
    vi.mocked(doc).mockReturnValue('referral-ref' as unknown as ReturnType<typeof doc>)
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'pending' }),
    } as never)

    const result = await creditReferralPoints('referred-user')

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns an error when referral record is missing', async () => {
    vi.mocked(doc).mockReturnValue('referral-ref' as unknown as ReturnType<typeof doc>)
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as never)

    const result = await creditReferralPoints('referred-user')

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('Referral record not found')
  })
})
