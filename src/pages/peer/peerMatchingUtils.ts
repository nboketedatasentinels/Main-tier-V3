export type MatchRefreshPreference = 'weekly' | 'biweekly' | 'on-demand' | 'disabled'

export type MatchPreferencesForWindow = {
  refreshPreference: MatchRefreshPreference
  preferredMatchDay: number
  timezone: string
}

export type MatchWindow = {
  key: string
  label: string
  startDate?: Date
  endDate?: Date
  nextRefreshAt?: Date | null
  frequencyLabel: string
  durationDays?: number
}

const formatMatchDate = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(date)

export const buildMatchWindow = (
  preferences: MatchPreferencesForWindow,
  nowOverride: Date = new Date(),
): MatchWindow => {
  if (preferences.refreshPreference === 'disabled') {
    return {
      key: 'disabled',
      label: 'Matching disabled',
      nextRefreshAt: null,
      frequencyLabel: 'Disabled',
    }
  }

  if (preferences.refreshPreference === 'on-demand') {
    return {
      key: 'on-demand',
      label: 'On-demand match',
      nextRefreshAt: null,
      frequencyLabel: 'On-demand',
    }
  }

  const now = nowOverride
  const dayOfWeek = now.getUTCDay()
  const diff = (dayOfWeek - preferences.preferredMatchDay + 7) % 7
  const windowStart = new Date(now)
  windowStart.setUTCDate(now.getUTCDate() - diff)
  windowStart.setUTCHours(0, 0, 0, 0)

  const cycleLength = preferences.refreshPreference === 'biweekly' ? 14 : 7
  let startDate = windowStart

  if (preferences.refreshPreference === 'biweekly') {
    const referenceAnchor = new Date(Date.UTC(2024, 0, 1))
    const referenceDay = referenceAnchor.getUTCDay()
    const refDiff = (referenceDay - preferences.preferredMatchDay + 7) % 7
    referenceAnchor.setUTCDate(referenceAnchor.getUTCDate() - refDiff)

    const weeksSinceReference = Math.floor(
      (windowStart.getTime() - referenceAnchor.getTime()) / (7 * 24 * 60 * 60 * 1000),
    )
    const cycleIndex = Math.floor(weeksSinceReference / 2)
    startDate = new Date(referenceAnchor)
    startDate.setUTCDate(referenceAnchor.getUTCDate() + cycleIndex * 14)
  }

  const endDate = new Date(startDate)
  endDate.setUTCDate(startDate.getUTCDate() + cycleLength - 1)

  const nextRefreshAt = new Date(startDate)
  nextRefreshAt.setUTCDate(startDate.getUTCDate() + cycleLength)
  const label = `${formatMatchDate(startDate, preferences.timezone)} - ${formatMatchDate(endDate, preferences.timezone)}`

  return {
    key: `${preferences.refreshPreference}-${startDate.toISOString().slice(0, 10)}`,
    label,
    startDate,
    endDate,
    nextRefreshAt,
    frequencyLabel: preferences.refreshPreference === 'biweekly' ? 'Every 2 weeks' : 'Weekly',
    durationDays: cycleLength,
  }
}

export const getStoredPeerId = (data: Record<string, unknown>): string | null => {
  const rawId = data.peer_id ?? data.peerId
  if (typeof rawId !== 'string') return null
  const normalized = rawId.trim()
  return normalized.length > 0 ? normalized : null
}

const hashSeed = (seed: string) => {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash
}

export const selectReplacementPeer = <T extends { id: string }>(
  candidates: T[],
  seed: string,
  excludeIds: string[] = [],
): T | null => {
  const excluded = new Set(excludeIds.filter(Boolean))
  const pool = candidates.filter((candidate) => !excluded.has(candidate.id))
  if (!pool.length) return null
  const index = hashSeed(seed) % pool.length
  return pool[index]
}
