import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import {
  handleNotificationAction,
  listenToUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService'
import { NotificationCategory, NotificationRecord, NotificationType } from '@/types/notifications'
import { useAuth } from './useAuth'

const notificationCategoryMap: Record<NotificationType, NotificationCategory> = {
  challenge_request: 'action_required',
  challenge_invite: 'action_required',
  challenge_response: 'action_required',
  session_request: 'action_required',
  task_due: 'action_required',
  direct_message: 'mentions',
  mention: 'mentions',
  system_alert: 'system_alerts',
  maintenance: 'system_alerts',
  downtime: 'system_alerts',
  milestone: 'important_updates',
  achievement: 'important_updates',
  important_update: 'important_updates',
  product_update: 'important_updates',
  engagement_alert: 'important_updates',
  intervention_reminder: 'important_updates',
  escalation_notice: 'important_updates',
  system_event: 'important_updates',
  progress_report: 'important_updates',
  mentee_checkin: 'important_updates',
  approval: 'action_required',
  badge_awarded: 'important_updates',
  referral_success: 'important_updates',
  referral_reward: 'important_updates',
  programme_day: 'important_updates',
  unknown: 'other',
}

const resolveCategory = (notification: NotificationRecord): NotificationCategory => {
  return notification.category || notificationCategoryMap[notification.type] || 'other'
}

export interface UseNotificationsOptions {
  enabled?: boolean
  category?: NotificationCategory | 'all'
  limit?: number
}

export const useNotifications = ({
  enabled = true,
  category = 'all',
  limit = 100,
}: UseNotificationsOptions = {}) => {
  const { profile } = useAuth()
  const toast = useToast()

  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>(category)

  useEffect(() => setActiveCategory(category), [category])

  useEffect(() => {
    if (!profile?.id || !enabled) {
      setNotifications([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const unsubscribe = listenToUserNotifications(profile.id, (items) => {
      const limited = items.slice(0, limit)
      setNotifications(limited)
      setLoading(false)
    }, (err) => {
      const code = (err as { code?: string })?.code
      console.error('[useNotifications] listener error', err)
      setNotifications([])
      setLoading(false)
      if (code === 'permission-denied') {
        setError('You do not have permission to view notifications.')
        return
      }
      setError('Unable to load notifications')
    })

    return () => unsubscribe()
  }, [enabled, limit, profile?.id])

  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications

    return notifications.filter((notification) => resolveCategory(notification) === activeCategory)
  }, [activeCategory, notifications])

  const unreadCount = useMemo(
    () => filteredNotifications.filter((notification) => !notification.is_read && !notification.read).length,
    [filteredNotifications],
  )

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, NotificationRecord & { count?: number }> = {}

    notifications.forEach((notification) => {
      const key = `${notification.type}-${notification.related_id || 'none'}`
      if (!groups[key]) {
        groups[key] = { ...notification, count: 1 }
      } else {
        groups[key] = { ...groups[key], count: (groups[key].count || 1) + 1 }
      }
    })

    return Object.values(groups)
  }, [notifications])

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId)
    } catch (err) {
      console.error(err)
      setError('Unable to mark notification as read')
      toast({ status: 'error', title: 'Notification error', description: 'Could not mark notification as read.' })
    }
  }, [toast])

  const handleMarkAll = useCallback(async () => {
    if (!profile?.id) return

    try {
      await markAllNotificationsRead(profile.id)
    } catch (err) {
      console.error(err)
      setError('Unable to mark all notifications as read')
      toast({ status: 'error', title: 'Notification error', description: 'Could not mark all as read.' })
    }
  }, [profile?.id, toast])

  const handleAction = useCallback(
    async (notification: NotificationRecord, action: NotificationRecord['action_response']) => {
      try {
        await handleNotificationAction(notification, action)
      } catch (err) {
        console.error(err)
        setError('Unable to update notification')
        toast({ status: 'error', title: 'Notification error', description: 'Could not update notification action.' })
      }
    },
    [toast],
  )

  return {
    notifications: filteredNotifications,
    unreadCount,
    loading,
    error,
    category: activeCategory,
    setCategory: setActiveCategory,
    markNotificationAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAll,
    updateNotificationAction: handleAction,
    groupedNotifications,
  }
}
