/**
 * The notifications bell lives in five different layouts, each with its own
 * route prefix. A notification must open the page that sits inside the layout
 * the user is already in, so nobody loses their sidebar mid-navigation.
 */
const PREFIXED_ROUTES: Array<{ prefix: string; path: string }> = [
  { prefix: '/partner', path: '/partner/notifications' },
  { prefix: '/admin', path: '/admin/notifications' },
  { prefix: '/mentor', path: '/mentor/notifications' },
  { prefix: '/ambassador', path: '/ambassador/notifications' },
]

export const LEARNER_NOTIFICATIONS_PATH = '/app/notifications'

/** Resolves the notifications page for whichever section the user is in. */
export const getNotificationsPath = (pathname: string): string => {
  const match = PREFIXED_ROUTES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return match ? match.path : LEARNER_NOTIFICATIONS_PATH
}

/** Deep link that opens the page focused on (and marking read) one message. */
export const getNotificationDetailPath = (pathname: string, notificationId: string): string =>
  `${getNotificationsPath(pathname)}?id=${encodeURIComponent(notificationId)}`
