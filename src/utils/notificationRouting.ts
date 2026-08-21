/**
 * Only admin keeps a dedicated notifications inbox.
 * Learners, mentors, coaches, and partners use the bell + push popup.
 */
const PREFIXED_ROUTES: Array<{ prefix: string; path: string }> = [
  { prefix: '/admin', path: '/admin/notifications' },
]

const NO_INBOX_PREFIXES = ['/app', '/mentor', '/coach', '/partner'] as const

/** @deprecated Learner inbox removed — kept for any lingering imports. */
export const LEARNER_NOTIFICATIONS_PATH = '/app/weekly-glance'

const matchesPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** True when the current section has a full notifications inbox page. */
export const hasNotificationsInbox = (pathname: string): boolean => {
  if (NO_INBOX_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return false
  return PREFIXED_ROUTES.some(({ prefix }) => matchesPrefix(pathname, prefix))
}

/** Resolves the notifications page for whichever section the user is in. */
export const getNotificationsPath = (pathname: string): string => {
  if (matchesPrefix(pathname, '/coach')) return '/coach/dashboard'
  if (matchesPrefix(pathname, '/mentor')) return '/mentor/dashboard'
  if (matchesPrefix(pathname, '/partner')) return '/partner/dashboard'
  if (matchesPrefix(pathname, '/app')) return '/app/weekly-glance'
  const match = PREFIXED_ROUTES.find(({ prefix }) => matchesPrefix(pathname, prefix))
  return match ? match.path : '/app/weekly-glance'
}

/** Deep link that opens the page focused on (and marking read) one message. */
export const getNotificationDetailPath = (pathname: string, notificationId: string): string => {
  if (!hasNotificationsInbox(pathname)) {
    return getNotificationsPath(pathname)
  }
  return `${getNotificationsPath(pathname)}?id=${encodeURIComponent(notificationId)}`
}
