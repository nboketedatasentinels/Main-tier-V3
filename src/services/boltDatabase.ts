export type DashboardTourVariant = 'paid' | 'free'

export type TourStorageRow = {
  userId: string
  variant: DashboardTourVariant
  currentStep: number
  completed: boolean
  skipped: boolean
  lastUpdated: string
}

const DASHBOARD_TOUR_KEY = 'bolt.dashboard_tour_progress'
const LEADERBOARD_TIP_KEY = 'bolt.leaderboard_filter_tip'

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn('Failed to parse Bolt DB cache', error)
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const getDashboardTourProgress = async (
  userId: string,
  variant: DashboardTourVariant
): Promise<TourStorageRow | null> => {
  const rows = readJson<TourStorageRow[]>(DASHBOARD_TOUR_KEY, [])
  return rows.find((row) => row.userId === userId && row.variant === variant) ?? null
}

export const saveDashboardTourProgress = async (
  progress: TourStorageRow
): Promise<TourStorageRow> => {
  const rows = readJson<TourStorageRow[]>(DASHBOARD_TOUR_KEY, [])
  const filtered = rows.filter(
    (row) => !(row.userId === progress.userId && row.variant === progress.variant)
  )
  const nextRow = { ...progress, lastUpdated: new Date().toISOString() }
  writeJson(DASHBOARD_TOUR_KEY, [...filtered, nextRow])
  return nextRow
}

export const markLeaderboardFilterSeen = async (userId: string) => {
  const seenUsers = new Set(readJson<string[]>(LEADERBOARD_TIP_KEY, []))
  seenUsers.add(userId)
  writeJson(LEADERBOARD_TIP_KEY, Array.from(seenUsers))
}

export const hasSeenLeaderboardFilter = async (userId: string): Promise<boolean> => {
  const seenUsers = new Set(readJson<string[]>(LEADERBOARD_TIP_KEY, []))
  return seenUsers.has(userId)
}
