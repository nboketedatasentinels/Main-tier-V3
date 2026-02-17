import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminNotification, NotificationCategory } from '@/types/notifications'
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '@/services/notificationService'
import { useAuth } from '@/hooks/useAuth'

interface UseAdminNotificationsOptions {
  role: 'partner' | 'super_admin'
  enabled?: boolean
  limit?: number
  filters?: NotificationCategory[]
}

export const useAdminNotifications = ({
  role,
  enabled = true,
  limit = 50,
  filters = [],
}: UseAdminNotificationsOptions) => {
  const { refreshAdminSession } = useAuth()
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }

    if (!enabled) {
      setNotifications([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    let isCancelled = false

    const loadNotifications = async (attempt = 0): Promise<void> => {
      try {
        const items = await fetchAdminNotifications()
        if (isCancelled) return
        setNotifications(
          items
            .filter((item) => {
              if (!item.target_roles) return true
              return item.target_roles.includes(role)
            })
            .slice(0, limit),
        )
        setError(null)
      } catch (err) {
        if (isCancelled) return
        const code = (err as { code?: string })?.code
        if (code === 'permission-denied' && attempt === 0) {
          try {
            await refreshAdminSession()
            if (!isCancelled) {
              await loadNotifications(1)
            }
            return
          } catch (refreshError) {
            console.error('[useAdminNotifications] token refresh failed', refreshError)
          }
        }
        console.error('[useAdminNotifications] load error', err)
        setNotifications([])
        setError(
          code === 'permission-denied'
            ? 'You do not have permission to view admin notifications.'
            : 'Unable to load admin notifications',
        )
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    void loadNotifications()
    pollTimerRef.current = window.setInterval(() => {
      void loadNotifications()
    }, 30000)

    return () => {
      isCancelled = true
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [enabled, limit, refreshAdminSession, role])

  const filteredNotifications = useMemo(() => {
    if (!filters.length) return notifications
    return notifications.filter((notification) =>
      filters.includes(notification.category || 'other'),
    )
  }, [filters, notifications])

  const unreadCount = useMemo(
    () => filteredNotifications.filter((notification) => !notification.is_read).length,
    [filteredNotifications],
  )

  const markNotificationAsRead = async (id: string) => {
    try {
      await markAdminNotificationRead(id)
    } catch (err) {
      console.error(err)
      setError('Unable to mark notification as read')
    }
  }

  const markAllAsRead = async () => {
    try {
      await markAllAdminNotificationsRead()
    } catch (err) {
      console.error(err)
      setError('Unable to mark all notifications as read')
    }
  }

  return {
    notifications: filteredNotifications,
    unreadCount,
    loading,
    error,
    markNotificationAsRead,
    markAllAsRead,
  }
}
