import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  listenToUserNotifications,
  markNotificationRead,
} from '@/services/notificationService'
import { NotificationDetailModal } from './NotificationDetailModal'
import type { NotificationRecord } from '@/types/notifications'

const toMillis = (value: unknown): number => {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (typeof value === 'object' && value && 'toDate' in value) {
    const d = (value as { toDate?: () => Date }).toDate?.()
    return d instanceof Date ? d.getTime() : 0
  }
  return 0
}

const isPendingPush = (
  n: NotificationRecord,
  dismissed: Set<string>,
): boolean => {
  if (n.type !== 'programme_day') return false
  if (n.is_read || n.read) return false
  if (dismissed.has(n.id)) return false
  const md = (n.metadata ?? {}) as { priority?: string }
  return md.priority === 'push'
}

export const ProgrammePushPopup = () => {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) {
      setNotifications([])
      setActiveId(null)
      setDismissedIds(new Set())
      return
    }
    const unsub = listenToUserNotifications(profile.id, setNotifications)
    return unsub
  }, [profile?.id])

  const queue = useMemo(() => {
    return notifications
      .filter((n) => isPendingPush(n, dismissedIds))
      .sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at))
  }, [notifications, dismissedIds])

  useEffect(() => {
    if (activeId) return
    if (queue.length === 0) return
    setActiveId(queue[0].id)
  }, [queue, activeId])

  const active = activeId
    ? notifications.find((n) => n.id === activeId) ?? null
    : null

  const handleClose = async () => {
    if (activeId) {
      const idToDismiss = activeId
      setDismissedIds((prev) => {
        const next = new Set(prev)
        next.add(idToDismiss)
        return next
      })
      try {
        await markNotificationRead(idToDismiss)
      } catch (err) {
        console.warn('[ProgrammePushPopup] failed to mark read', err)
      }
    }
    setActiveId(null)
  }

  return (
    <NotificationDetailModal
      notification={active}
      isOpen={Boolean(active)}
      onClose={handleClose}
    />
  )
}
