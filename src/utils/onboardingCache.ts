import { OnboardingSnapshot, OnboardingStep } from '@/types/onboarding'

type CacheRecord<T> = {
  value: T
  expiresAt: number
}

const memoryProgressCache: Map<string, CacheRecord<OnboardingSnapshot>> = new Map()
const memoryStepCache: Map<string, CacheRecord<OnboardingStep[]>> = new Map()

const FIVE_MINUTES = 5 * 60 * 1000
const FIFTEEN_MINUTES = 15 * 60 * 1000

const getSessionKey = (userId: string) => `onboarding-progress::${userId}`
const getStepKey = (role: string) => `onboarding-steps::${role}`

const isExpired = (record: CacheRecord<unknown>) => Date.now() > record.expiresAt

export const getCachedProgress = (userId: string): OnboardingSnapshot | null => {
  const memoryRecord = memoryProgressCache.get(userId)
  if (memoryRecord && !isExpired(memoryRecord)) {
    return memoryRecord.value
  }

  const sessionKey = getSessionKey(userId)
  const raw = sessionStorage.getItem(sessionKey)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CacheRecord<OnboardingSnapshot>
      if (!isExpired(parsed)) {
        memoryProgressCache.set(userId, parsed)
        return parsed.value
      }
    } catch (error) {
      console.warn('Failed to parse onboarding cache', error)
    }
  }

  return null
}

export const cacheProgress = (userId: string, progress: OnboardingSnapshot) => {
  const record: CacheRecord<OnboardingSnapshot> = {
    value: progress,
    expiresAt: Date.now() + FIVE_MINUTES,
  }

  memoryProgressCache.set(userId, record)
  sessionStorage.setItem(getSessionKey(userId), JSON.stringify(record))
}

export const clearProgressCache = (userId: string) => {
  memoryProgressCache.delete(userId)
  sessionStorage.removeItem(getSessionKey(userId))
}

export const getCachedSteps = (roleKey: string): OnboardingStep[] | null => {
  const memoryRecord = memoryStepCache.get(roleKey)
  if (memoryRecord && !isExpired(memoryRecord)) {
    return memoryRecord.value
  }

  const raw = sessionStorage.getItem(getStepKey(roleKey))
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CacheRecord<OnboardingStep[]>
      if (!isExpired(parsed)) {
        memoryStepCache.set(roleKey, parsed)
        return parsed.value
      }
    } catch (error) {
      console.error('Failed to parse step cache', error)
    }
  }

  return null
}

export const cacheSteps = (roleKey: string, steps: OnboardingStep[]) => {
  const record: CacheRecord<OnboardingStep[]> = {
    value: steps,
    expiresAt: Date.now() + FIFTEEN_MINUTES,
  }

  memoryStepCache.set(roleKey, record)
  sessionStorage.setItem(getStepKey(roleKey), JSON.stringify(record))
}

