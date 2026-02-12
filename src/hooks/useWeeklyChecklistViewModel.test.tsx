import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeeklyChecklistViewModel } from './useWeeklyChecklistViewModel'
import { triggerHaptic } from '@/utils/haptics'
import { submitPointsVerificationRequestAtomic } from '@/services/pointsRequestSubmissionService'

const toastSpy = vi.fn()
const setSearchParamsSpy = vi.fn()
const stableSearchParams = new URLSearchParams()
const stableAuthState = {
  user: { uid: 'user-1' },
  profile: {
    role: 'user',
    currentWeek: 1,
    companyId: 'org-1',
    organizationId: 'org-1',
  },
}

vi.mock('@chakra-ui/react', () => ({
  useToast: () => toastSpy,
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [stableSearchParams, setSearchParamsSpy],
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableAuthState,
}))

vi.mock('@/utils/membership', () => ({
  isFreeUser: () => false,
}))

vi.mock('@/utils/journeyType', () => ({
  resolveJourneyType: () => '6W',
}))

vi.mock('@/utils/firestore', () => ({
  removeUndefinedFields: <T,>(value: T) => value,
}))

vi.mock('@/utils/role', () => ({
  normalizeRole: (value: unknown) => String(value || ''),
}))

vi.mock('@/config/pointsConfig', () => ({
  JOURNEY_META: {
    '6W': { weeks: 6, weeklyTarget: 4000, mode: 'full', timelineDisplay: 'duration' },
  },
  getActivitiesForJourney: () => [
    {
      id: 'proof-activity',
      baseId: 'proof-activity',
      title: 'Proof Activity',
      description: 'Requires proof',
      points: 500,
      maxPerMonth: 1,
      activityPolicy: { type: 'window_limited', maxPerWindow: 1 },
      approvalType: 'partner_approved',
      requiresApproval: true,
      week: 1,
      category: 'Learning',
      flexibleWeeks: true,
    },
  ],
  resolveCanonicalActivityId: (id: string | null) => id,
}))

vi.mock('@/utils/activityStateManager', () => ({
  calculateActivityAvailability: () => ({
    state: 'available',
    isScheduledForWeek: true,
  }),
}))

vi.mock('@/services/firebase', () => ({
  db: {},
}))

const getDocsSpy = vi.fn(async () => ({ docs: [], size: 0 }))
const getDocSpy = vi.fn(async () => ({
  exists: () => true,
  data: () => ({ journeyType: '6W' }),
}))
const onSnapshotSpy = vi.fn((ref: { type?: string; col?: string }, onNext: (snapshot: unknown) => void) => {
  if (ref?.type === 'doc') {
    if (ref.col === 'weeklyProgress') {
      onNext({ exists: () => false, data: () => null })
    } else if (ref.col === 'checklists') {
      onNext({ exists: () => false, data: () => ({}) })
    } else {
      onNext({ exists: () => false, data: () => null })
    }
    return vi.fn()
  }
  onNext({ docs: [] })
  return vi.fn()
})

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ type: 'collection', name }),
  doc: (_db: unknown, col: string, id: string) => ({ type: 'doc', col, id, path: `${col}/${id}` }),
  getDoc: (...args: unknown[]) => getDocSpy(...args),
  getDocs: (...args: unknown[]) => getDocsSpy(...args),
  onSnapshot: (...args: unknown[]) => onSnapshotSpy(...args),
  query: (...args: unknown[]) => ({ type: 'query', args }),
  serverTimestamp: () => 'server-ts',
  setDoc: vi.fn(async () => undefined),
  where: (...args: unknown[]) => ({ type: 'where', args }),
}))

vi.mock('@/services/pointsService', () => ({
  revokeChecklistPoints: vi.fn(async () => undefined),
}))

vi.mock('@/utils/activityRouter', () => ({
  handleActivityCompletion: vi.fn(async () => undefined),
}))

vi.mock('@/utils/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

vi.mock('@/services/pointsRequestSubmissionService', () => ({
  PendingRequestExistsError: class PendingRequestExistsError extends Error {
    constructor() {
      super('pending_request_exists')
      this.name = 'PendingRequestExistsError'
    }
  },
  submitPointsVerificationRequestAtomic: vi.fn(async () => ({ requestId: 'req-1' })),
}))

const submitProofSpy = vi.mocked(submitPointsVerificationRequestAtomic)
const triggerHapticSpy = vi.mocked(triggerHaptic)

const mountViewModel = async () => {
  const hook = renderHook(() => useWeeklyChecklistViewModel())

  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false)
    expect(hook.result.current.activities.length).toBeGreaterThan(0)
  })

  return hook
}

describe('useWeeklyChecklistViewModel proof submission', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    submitProofSpy.mockResolvedValue({ requestId: 'req-1' })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('rejects invalid proof URL and triggers warning haptic', async () => {
    const hook = await mountViewModel()
    const activity = hook.result.current.activities[0]

    act(() => {
      hook.result.current.openProofModal(activity)
      hook.result.current.updateProofModal({ proofUrl: 'http://' })
    })

    await act(async () => {
      await hook.result.current.submitProofForApproval()
    })

    expect(submitProofSpy).not.toHaveBeenCalled()
    expect(triggerHapticSpy).toHaveBeenCalledWith('warning')
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Invalid link',
        status: 'warning',
      }),
    )
  })

  it('normalizes valid URL submissions and triggers success haptic', async () => {
    const hook = await mountViewModel()
    const activity = hook.result.current.activities[0]

    act(() => {
      hook.result.current.openProofModal(activity)
      hook.result.current.updateProofModal({ proofUrl: 'example.com/proof', notes: 'done' })
    })

    await act(async () => {
      await hook.result.current.submitProofForApproval()
    })

    expect(submitProofSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        activityId: 'proof-activity',
        proofUrl: 'https://example.com/proof',
      }),
    )
    expect(triggerHapticSpy).toHaveBeenCalledWith('success')
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Proof submitted',
        status: 'success',
      }),
    )
    expect(hook.result.current.proofModal.isOpen).toBe(false)
  })

  it('triggers error haptic when submission fails', async () => {
    submitProofSpy.mockRejectedValueOnce(new Error('network'))
    const hook = await mountViewModel()
    const activity = hook.result.current.activities[0]

    act(() => {
      hook.result.current.openProofModal(activity)
      hook.result.current.updateProofModal({ proofUrl: 'https://example.com/proof' })
    })

    await act(async () => {
      await hook.result.current.submitProofForApproval()
    })

    expect(triggerHapticSpy).toHaveBeenCalledWith('error')
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Submission failed',
        status: 'error',
      }),
    )
  })
})
