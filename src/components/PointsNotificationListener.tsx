import { useEffect } from 'react'
import { onSnapshot, orderBy, query, where, collection } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { db } from '@/services/firebase'
import emitter from '@/utils/eventEmitter'
import { WeeklyTargetAlert } from '@/types/notifications'

export const PointsNotificationListener = () => {
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (!user) return

    const pointsListener = (event: Event) => {
      const custom = event as CustomEvent
      const { points, reason, engagementPoints, impactPoints } = custom.detail || {}
      toast({
        title: `+${points} points earned`,
        description: `${engagementPoints || 0} engagement · ${impactPoints || 0} impact — ${reason}`,
        status: 'success',
      })
    }

    emitter.addEventListener('pointsAwarded', pointsListener)

    const alertsQuery = query(
      collection(db, 'weekly_target_alerts'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc'),
    )

    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const alert = { ...(change.doc.data() as WeeklyTargetAlert), id: change.doc.id }
          if (alert.type === 'warning') {
            toast({
              title: "Heads up! You're close to missing this week's minimum points",
              description: alert.message,
              status: 'warning',
            })
          }
          if (alert.type === 'alert') {
            toast({
              title: "You're falling behind on this week's minimum points",
              description: alert.message,
              status: 'error',
            })
          }
          if (alert.type === 'recovery') {
            toast({
              title: 'Nice recovery! You are back on track',
              description: alert.message,
              status: 'success',
            })
          }
        }
      })
    })

    return () => {
      emitter.removeEventListener('pointsAwarded', pointsListener)
      unsubscribeAlerts()
    }
  }, [toast, user])

  return null
}

export default PointsNotificationListener
