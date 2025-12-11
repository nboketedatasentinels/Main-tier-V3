import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cacheProgress,
  cacheSteps,
  clearProgressCache,
  getCachedProgress,
  getCachedSteps,
} from '@/utils/onboardingCache'
import {
  OnboardingSnapshot,
  OnboardingStep,
  OnboardingStepItem,
  ProgressState,
} from '@/types/onboarding'
import {
  fetchOnboardingProgress,
  fetchOnboardingSteps,
  logOnboardingAnalytics,
  persistOnboardingProgress,
} from '@/services/onboardingService'

const INITIAL_PROGRESS: ProgressState = {
  completedSteps: [],
  completedItems: [],
  totalPoints: 0,
  onboardingStartTime: null,
  pointsDeducted: false,
  pointsDeductedAmount: null,
  updatedAt: null,
}

interface UseOnboardingStepsOptions {
  userId?: string
  roleKey: string
  resume?: boolean
}

export const useOnboardingSteps = ({ userId, roleKey, resume }: UseOnboardingStepsOptions) => {
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [progress, setProgress] = useState<OnboardingSnapshot | null>(null)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hydrateProgress = useCallback(
    (nextProgress?: OnboardingSnapshot | ProgressState | null): OnboardingSnapshot => ({
      ...(INITIAL_PROGRESS as ProgressState),
      ...nextProgress,
      onboardingComplete: (nextProgress as OnboardingSnapshot | null)?.onboardingComplete ?? false,
      onboardingSkipped: (nextProgress as OnboardingSnapshot | null)?.onboardingSkipped ?? false,
      lastStepId: (nextProgress as OnboardingSnapshot | null)?.lastStepId ?? null,
    }),
    [],
  )

  const loadSteps = useCallback(async () => {
    try {
      const cached = getCachedSteps(roleKey)
      if (cached) {
        setSteps(cached)
      }

      const remoteSteps = await fetchOnboardingSteps(roleKey)
      setSteps(remoteSteps)
      cacheSteps(roleKey, remoteSteps)
    } catch (err) {
      console.error(err)
      setError('Unable to load onboarding steps right now.')
    }
  }, [roleKey])

  const loadProgress = useCallback(async () => {
    if (!userId) return

    const cached = getCachedProgress(userId)
    if (cached) {
      setProgress(hydrateProgress(cached))
      setActiveStepId(cached.lastStepId || cached.completedSteps[0] || null)
    }

    const remote = await fetchOnboardingProgress(userId)
    const hydrated = hydrateProgress(remote || INITIAL_PROGRESS)

    cacheProgress(userId, hydrated)
    setProgress(hydrated)
    setActiveStepId((remote?.lastStepId || hydrated.completedSteps[0]) ?? null)
  }, [hydrateProgress, userId])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadSteps(), loadProgress()])
      .catch((err) => {
        console.error(err)
        setError('Unable to initialize onboarding')
      })
      .finally(() => setLoading(false))
  }, [loadProgress, loadSteps])

  const activeStep = useMemo(() => steps.find((step) => step.id === activeStepId) ?? steps[0], [
    activeStepId,
    steps,
  ])

  const totalItemCount = useMemo(
    () => steps.reduce((count, step) => count + step.items.length, 0),
    [steps],
  )

  const completedPercentage = useMemo(() => {
    if (!progress) return 0
    return Math.round((progress.completedItems.length / Math.max(totalItemCount, 1)) * 100)
  }, [progress, totalItemCount])

  const updateProgress = useCallback(
    async (updater: (current: OnboardingSnapshot) => OnboardingSnapshot, label: string) => {
      if (!userId) return

      setProgress((current) => {
        const hydrated = hydrateProgress(current)
        const next = updater(hydrated)
        cacheProgress(userId, next)
        persistOnboardingProgress(userId, next)
        return next
      })

      await logOnboardingAnalytics({
        user_id: userId,
        status: 'in_progress',
        progress_percentage: completedPercentage,
        completed_item_count: progress?.completedItems.length || 0,
        total_item_count: totalItemCount,
        role: roleKey,
        label,
        variant: resume ? 'resume' : 'start',
        triggered_from: 'onboarding_wizard',
        recorded_at: new Date().toISOString(),
      })
    },
    [userId, hydrateProgress, completedPercentage, progress?.completedItems.length, totalItemCount, roleKey, resume],
  )

  const markItemComplete = useCallback(
    (item: OnboardingStepItem, stepId: string) => {
      updateProgress((current) => {
        if (current.completedItems.includes(item.id)) return current

        const updatedItems = [...current.completedItems, item.id]
        const updatedSteps = current.completedSteps.includes(stepId)
          ? current.completedSteps
          : current.completedSteps

        return {
          ...current,
          completedItems: updatedItems,
          completedSteps: updatedSteps,
          totalPoints: current.totalPoints + item.points,
          updatedAt: new Date().toISOString(),
          lastStepId: stepId,
        }
      }, item.id)
    },
    [updateProgress],
  )

  const markStepComplete = useCallback(
    (step: OnboardingStep) => {
      updateProgress((current) => {
        if (current.completedSteps.includes(step.id)) return current

        const allItemsCompleted = step.items.every((item) => current.completedItems.includes(item.id))
        if (!allItemsCompleted) return current

        return {
          ...current,
          completedSteps: [...current.completedSteps, step.id],
          totalPoints: current.totalPoints + step.points,
          updatedAt: new Date().toISOString(),
          lastStepId: step.id,
          onboardingComplete: [...current.completedSteps, step.id].length === steps.length,
        }
      }, step.id)
    },
    [steps.length, updateProgress],
  )

  const skipOnboarding = useCallback(() => {
    if (!userId) return
    setProgress((current) => {
      const hydrated = hydrateProgress(current)
      const next: OnboardingSnapshot = {
        ...hydrated,
        onboardingSkipped: true,
        onboardingComplete: false,
        updatedAt: new Date().toISOString(),
      }
      cacheProgress(userId, next)
      persistOnboardingProgress(userId, next)
      return next
    })
  }, [hydrateProgress, userId])

  const resetOnboarding = useCallback(() => {
    if (!userId) return
    setProgress(hydrateProgress(INITIAL_PROGRESS))
    clearProgressCache(userId)
  }, [hydrateProgress, userId])

  const applyPenalty = useCallback(
    (amount: number) => {
      if (!userId) return

      setProgress((current) => {
        const hydrated = hydrateProgress(current)
        if (hydrated.pointsDeducted) return hydrated

        const next: OnboardingSnapshot = {
          ...hydrated,
          totalPoints: hydrated.totalPoints + amount,
          pointsDeducted: true,
          pointsDeductedAmount: amount,
          updatedAt: new Date().toISOString(),
        }

        cacheProgress(userId, next)
        persistOnboardingProgress(userId, next)
        return next
      })
    },
    [hydrateProgress, userId],
  )

  return {
    steps,
    activeStep,
    setActiveStepId,
    progress,
    loading,
    error,
    completedPercentage,
    totalItemCount,
    markItemComplete,
    markStepComplete,
    skipOnboarding,
    resetOnboarding,
    applyPenalty,
  }
}
