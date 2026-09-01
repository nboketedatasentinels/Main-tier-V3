/**
 * Build a standards-ish VEVENT / VCALENDAR string for Google / Outlook / Apple.
 */
export type CalendarEventInput = {
  title: string
  description?: string
  location?: string
  start: Date
  /** Defaults to start + 60 minutes. */
  end?: Date
  uid?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Format as UTC ICS datetime (YYYYMMDDTHHMMSSZ). */
export const toIcsUtc = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`

const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')

export const buildIcsCalendar = (event: CalendarEventInput): string => {
  const end = event.end ?? new Date(event.start.getTime() + 60 * 60 * 1000)
  const uid =
    event.uid ||
    `${event.start.getTime()}-${Math.random().toString(36).slice(2, 10)}@t4leader.com`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Transformation Leader//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]
  if (event.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description.trim())}`)
  }
  if (event.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(event.location.trim())}`)
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export const downloadIcsFile = (ics: string, filename = 'session.ics'): void => {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Google Calendar “template” URL (opens compose; user still confirms). */
export const buildGoogleCalendarUrl = (event: CalendarEventInput): string => {
  const end = event.end ?? new Date(event.start.getTime() + 60 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toIcsUtc(event.start).replace(/Z$/, '')}/${toIcsUtc(end).replace(/Z$/, '')}`,
  })
  if (event.description?.trim()) params.set('details', event.description.trim())
  if (event.location?.trim()) params.set('location', event.location.trim())
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
