const LEADERBOARD_TIP_KEY = 'firebase.leaderboard_filter_tip'

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn('Failed to parse dashboard cache', error)
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
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
