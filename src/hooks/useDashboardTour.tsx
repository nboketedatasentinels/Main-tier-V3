import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import introJs, { Step } from 'intro.js'
import 'intro.js/introjs.css'
import { VisuallyHidden } from '@chakra-ui/react'
import { useAuth } from './useAuth'
import {
  DashboardTourVariant,
  getDashboardTourProgress,
  saveDashboardTourProgress,
} from '@/services/boltDatabase'

export interface DashboardTourStep extends Step {
  title: string
  element?: string | HTMLElement
}

export const useDashboardTour = (
  variant: DashboardTourVariant,
  steps: DashboardTourStep[],
  autoStart: boolean
) => {
  const { user } = useAuth()
  const introRef = useRef<introJs.IntroJs | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [announcement, setAnnouncement] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(false)
  const [hasSkipped, setHasSkipped] = useState(false)

  const userId = user?.uid || 'anonymous'

  const memoizedSteps = useMemo(() => steps, [steps])

  const persistProgress = useCallback(
    async (stepIndex: number, completed = false, skipped = false) => {
      setCurrentStep(stepIndex)
      setHasCompleted(completed)
      setHasSkipped(skipped)
      await saveDashboardTourProgress({
        userId,
        variant,
        currentStep: stepIndex,
        completed,
        skipped,
        lastUpdated: new Date().toISOString(),
      })
    },
    [userId, variant]
  )

  const teardownTour = useCallback(() => {
    introRef.current?.exit()
    introRef.current = null
  }, [])

  const startTour = useCallback(
    (stepIndex = 0) => {
      if (!memoizedSteps.length) return

      teardownTour()
      const intro = introJs()
      introRef.current = intro

      const getStepNumber = () =>
        (intro as unknown as { _currentStep?: number })._currentStep ?? stepIndex

      intro.setOptions({
        steps: memoizedSteps,
        showBullets: false,
        showStepNumbers: true,
        showProgress: true,
        keyboardNavigation: true,
        nextLabel: 'Next',
        prevLabel: 'Back',
        skipLabel: 'Skip tour',
        doneLabel: 'Finish tour',
      })

      intro.onbeforeexit(() => {
        persistProgress(getStepNumber(), false, true)
      })

      intro.onchange((element) => {
        const stepNumber = getStepNumber()
        const labelText = element?.getAttribute('aria-label') || element?.id || 'Dashboard section'
        setAnnouncement(`Step ${stepNumber + 1} of ${memoizedSteps.length}: ${labelText}`)
        persistProgress(stepNumber)
      })

      intro.oncomplete(() => {
        persistProgress(memoizedSteps.length - 1, true, false)
        setAnnouncement('Dashboard tour completed')
      })

      intro.goToStepNumber(stepIndex + 1).start()
    },
    [memoizedSteps, persistProgress, teardownTour]
  )

  useEffect(() => {
    const loadProgress = async () => {
      const progress = await getDashboardTourProgress(userId, variant)
      const stepIndex = progress?.currentStep ?? 0
      setCurrentStep(stepIndex)
      setHasCompleted(progress?.completed ?? false)
      setHasSkipped(progress?.skipped ?? false)
      setIsLoading(false)

      if (autoStart && !progress?.completed) {
        setTimeout(() => startTour(stepIndex), 400)
      }
    }

    loadProgress()

    return () => {
      teardownTour()
    }
  }, [autoStart, startTour, teardownTour, userId, variant])

  const announcementNode = useMemo(
    () => (
      <VisuallyHidden role="status" aria-live="polite">
        {announcement || 'Dashboard tour ready'}
      </VisuallyHidden>
    ),
    [announcement]
  )

  return {
    startTour,
    currentStep,
    hasCompleted,
    hasSkipped,
    isLoading,
    announcementNode,
  }
}
