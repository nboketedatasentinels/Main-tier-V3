/**
 * Meeting invite helpers - in-app push + optional mailto (no notifications page).
 */

export const MEETING_NOTIFICATION_KINDS = new Set([
  'mentorship_scheduled_by_mentor',
  'mentorship_confirmed',
  'mentorship_cancelled',
  'mentorship_declined',
  'coach_slot_published',
  'ambassador_slot_booked',
  'ambassador_slot_cancelled',
  'ambassador_attendance',
])

export const isMeetingNotification = (notification: {
  type?: string
  metadata?: Record<string, unknown> | null
}): boolean => {
  const md = (notification.metadata ?? {}) as Record<string, unknown>
  const kind = typeof md.kind === 'string' ? md.kind : ''
  if (MEETING_NOTIFICATION_KINDS.has(kind)) return true
  return notification.type === 'session_request'
}

export const buildMeetingMailtoHref = (params: {
  to?: string | null
  subject: string
  body: string
}): string => {
  const subject = encodeURIComponent(params.subject.trim() || 'Meeting invitation')
  const body = encodeURIComponent(params.body.trim())
  const to = (params.to || '').trim()
  return to ? `mailto:${to}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`
}

export const openMeetingMailto = (href: string): void => {
  if (!href.startsWith('mailto:')) return
  try {
    window.location.href = href
  } catch {
    // ignore popup blockers / environments without a mail client
  }
}

export const formatMeetingWhen = (when: Date): string =>
  when.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
