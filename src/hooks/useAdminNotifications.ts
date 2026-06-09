import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminNotification, NotificationCategory } from '@/types/notifications'
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '@/services/notificationService'

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

    const loadNotifications = async (): Promise<void> => {
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
        // Do NOT call refreshAdminSession() here. Notifications are still read
        // from Firebase, which always denies under Supabase auth; refreshing the
        // Supabase token cannot help and previously caused a
        // refresh -> TOKEN_REFRESHED -> re-render -> refresh loop that hit
        // Supabase's 429 rate limit and force-logged-out the user.
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
  }, [enabled, limit, role])

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
