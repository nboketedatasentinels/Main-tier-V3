import { beforeEach, describe, expect, it, vi } from 'vitest'
import { awardChecklistPoints } from './pointsService'

const mockGetDocs = vi.fn()
const mockGetDoc = vi.fn()
const mockRunTransaction = vi.fn()
const mockDoc = vi.fn((_db: unknown, collectionName: string, id: string) => ({ path: `${collectionName}/${id}` }))
const mockCollection = vi.fn((_db: unknown, name: string) => name)
const mockQuery = vi.fn(() => ({}))
const mockWhere = vi.fn(() => ({}))
const mockOrderBy = vi.fn(() => ({}))
const mockLimit = vi.fn(() => ({}))
const mockServerTimestamp = vi.fn(() => 'mock-ts')
const mockIncrement = vi.fn((value: number) => ({ __increment: value }))

vi.mock('./firestoreDebug', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  increment: (...args: unknown[]) => mockIncrement(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}))

vi.mock('@/services/firebase', () => ({
  db: {},
}))

vi.mock('@/utils/points', () => ({
  calculateLevel: vi.fn(() => 1),
}))

vi.mock('./badgeService', () => ({
  awardBadge: vi.fn(),
}))

vi.mock('./windowProgressService', () => ({
  updateWindowOnAward: vi.fn(),
  updateWindowOnRevoke: vi.fn(),
}))

vi.mock('./journeyCompletionService', () => ({
  checkAndHandleJourneyCompletion: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./nudgeMonitorService', () => ({
  detectStatusChangeAndNudge: vi.fn().mockResolvedValue(undefined),
}))

const emptySnapshot = { size: 0, docs: [] as Array<{ data: () => Record<string, unknown> }> }

describe('pointsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supports repeatable claims with claimRef and does not apply implicit maxPerWeek=1', async () => {
    mockGetDocs
      .mockResolvedValueOnce(emptySnapshot) // ledgerSnapshot
      .mockResolvedValueOnce({ ...emptySnapshot, size: 1 }) // weeklyActivitySnapshot
      .mockResolvedValueOnce({ ...emptySnapshot, size: 1 }) // windowActivitySnapshot
      .mockResolvedValueOnce(emptySnapshot) // lastActivitySnapshot
      .mockResolvedValueOnce({ ...emptySnapshot, size: 1 }) // totalActivitySnapshot
      .mockResolvedValueOnce(emptySnapshot) // activeChallengesSnapshot

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ companyId: null }),
    })

    const tx = {
      get: vi.fn(async (ref: { path: string }) => {
        if (ref.path.startsWith('pointsLedger/')) {
          return { exists: () => false, data: () => ({}) }
        }
        if (ref.path.startsWith('weeklyProgress/')) {
          return { exists: () => false, data: () => ({ pointsEarned: 0, status: 'alert' }) }
        }
        if (ref.path.startsWith('users/')) {
          return { exists: () => true, data: () => ({ totalPoints: 0 }) }
        }
        return { exists: () => false, data: () => ({}) }
      }),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    mockRunTransaction.mockImplementation(async (_db: unknown, callback: (txArg: unknown) => unknown) => callback(tx))

    await expect(
      awardChecklistPoints({
        uid: 'user-1',
        journeyType: '6W',
        weekNumber: 2,
        activity: {
          id: 'impact_log',
          baseId: 'impact_log',
          title: 'Impact Log entry',
          description: 'desc',
          points: 500,
          maxPerMonth: 4,
          activityPolicy: { type: 'window_limited', maxPerWindow: 4 },
          approvalType: 'self',
          week: 1,
          category: 'Impact',
          flexibleWeeks: true,
        },
        source: 'peer_session',
        claimRef: 'session:1',
      }),
    ).resolves.toBeUndefined()

    expect(mockDoc).toHaveBeenCalledWith({}, 'pointsLedger', 'user-1__w2__impact_log__session_1')
    const ledgerSetCall = tx.set.mock.calls.find(
      (call) => call[0]?.path === 'pointsLedger/user-1__w2__impact_log__session_1',
    )
    expect(ledgerSetCall).toBeTruthy()
    expect(ledgerSetCall?.[1]?.claimRef).toBe('session:1')
  })
})
