/**
 * Record learner Pre completion and unlock course access.
 *
 * 1) Persists an unlock row in Supabase (course_access_unlocks)
 * 2) Optionally POSTs to VITE_COURSE_UNLOCK_WEBHOOK_URL (Wix / challenge page)
 *    when configured - never blocks the learner if the webhook fails.
 */
import { supabase } from '@/services/supabase'

export const requestCourseAccessUnlock = async (params: {
  userId: string
  courseKey: string
  courseTitle?: string | null
}): Promise<{ ok: boolean; skipped?: boolean; webhookOk?: boolean }> => {
  const courseKey = params.courseKey.trim()
  if (!params.userId || !courseKey) {
    return { ok: false }
  }

  const payload = {
    uid: params.userId,
    course_key: courseKey,
    course_title: params.courseTitle?.trim() || null,
    unlocked_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('course_access_unlocks').upsert(payload, {
    onConflict: 'uid,course_key',
  })

  if (error) {
    // Table may not be migrated yet - still try webhook and allow client open.
    console.warn('[courseAccessUnlock] persist failed', error.message)
  }

  const webhookUrl = (import.meta.env.VITE_COURSE_UNLOCK_WEBHOOK_URL as string | undefined)?.trim()
  let webhookOk: boolean | undefined
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: params.userId,
          courseKey,
          courseTitle: params.courseTitle ?? null,
          unlockedAt: payload.unlocked_at,
        }),
      })
      webhookOk = res.ok
      if (!res.ok) {
        console.warn('[courseAccessUnlock] webhook non-OK', res.status)
      }
    } catch (err) {
      webhookOk = false
      console.warn('[courseAccessUnlock] webhook failed', err)
    }
  }

  return {
    ok: true,
    skipped: !webhookUrl && Boolean(error),
    webhookOk,
  }
}
