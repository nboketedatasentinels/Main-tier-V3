import { supabase } from '@/services/supabase'
import { buildIcsCalendar, formatMeetingWhen } from '@/utils/meetingInvite'

/** Best-effort email with .ics so the learner can save the meeting. */
export async function sendSessionCalendarInviteEmail(params: {
  to: string
  learnerName?: string | null
  organizerName?: string | null
  title: string
  start: Date
  end?: Date
  meetingLink?: string | null
  description?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const to = params.to.trim().toLowerCase()
  if (!to) return { success: false, error: 'missing_to' }

  const icsContent = buildIcsCalendar({
    title: params.title,
    start: params.start,
    end: params.end,
    location: params.meetingLink || undefined,
    description: params.description || undefined,
  })

  try {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean
      error?: string
    }>('send-session-calendar-invite', {
      body: {
        to,
        learnerName: params.learnerName || null,
        organizerName: params.organizerName || null,
        title: params.title,
        whenLabel: formatMeetingWhen(params.start),
        startIso: params.start.toISOString(),
        endIso: (params.end ?? new Date(params.start.getTime() + 60 * 60 * 1000)).toISOString(),
        meetingLink: params.meetingLink || null,
        description: params.description || null,
        icsContent,
      },
    })
    if (error) throw error
    if (!data?.success) {
      return { success: false, error: data?.error || 'invite_failed' }
    }
    return { success: true }
  } catch (err) {
    console.warn('[sessionCalendarInvite] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'invite_failed',
    }
  }
}
