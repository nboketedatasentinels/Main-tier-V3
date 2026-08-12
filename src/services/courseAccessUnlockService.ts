/**
 * Placeholder for Wix / challenge-page unlock after learner Pre is submitted.
 * Wire the real API here when credentials are available; until then Pre gate
 * still unlocks client-side by opening the course URL after submit.
 */
export const requestCourseAccessUnlock = async (params: {
  userId: string
  courseKey: string
  courseTitle?: string | null
}): Promise<{ ok: boolean; skipped?: boolean }> => {
  // No Wix unlock API in-repo yet — intentional no-op.
  if (import.meta.env.DEV) {
    console.info('[courseAccessUnlock] Pre submitted; Wix unlock pending', params)
  }
  return { ok: true, skipped: true }
}
