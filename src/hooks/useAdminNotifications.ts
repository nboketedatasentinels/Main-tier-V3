import { useEffect, useMemo, useState } from 'react'
import { AdminNotification, NotificationCategory } from '@/types/notifications'
import {
  listenToAdminNotifications,
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

  useEffect(() => {
    if (!enabled) return

    setLoading(true)
    const unsubscribe = listenToAdminNotifications((items) => {
      const filtered = items
        .filter((item) => !item.target_roles || item.target_roles.includes(role))
        .slice(0, limit)
      setNotifications(filtered)
      setLoading(false)
    })

    return () => unsubscribe()
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
