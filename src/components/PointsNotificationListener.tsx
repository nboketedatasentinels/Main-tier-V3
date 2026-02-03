import { useEffect } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { db } from '@/services/firebase'
import { PEER_SESSION_CONFIRMATION_ACTIVITY, PEER_SESSION_NO_SHOW_ACTIVITY } from '@/config/pointsConfig'
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

  useEffect(() => {
    if (!user) return undefined

    const ledgerIds = new Set<string>()
    let initialSnapshot = true

    const ledgerQuery = query(
      collection(db, 'pointsLedger'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(25),
    )

    const unsubscribeLedger = onSnapshot(
      ledgerQuery,
      (snapshot) => {
        if (initialSnapshot) {
          snapshot.docs.forEach((docSnap) => ledgerIds.add(docSnap.id))
          initialSnapshot = false
          return
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return
          const docId = change.doc.id
          if (ledgerIds.has(docId)) return
          ledgerIds.add(docId)

          const data = change.doc.data()
          if (data.source !== 'peer_session') return
          const points = Number(data.points ?? 0)
          if (!Number.isFinite(points) || points <= 0) return

          const activityId = data.activityId as string | undefined
          const description =
            activityId === PEER_SESSION_NO_SHOW_ACTIVITY.id
              ? PEER_SESSION_NO_SHOW_ACTIVITY.description
              : PEER_SESSION_CONFIRMATION_ACTIVITY.description
          const title =
            activityId === PEER_SESSION_NO_SHOW_ACTIVITY.id
              ? PEER_SESSION_NO_SHOW_ACTIVITY.title
              : PEER_SESSION_CONFIRMATION_ACTIVITY.title

          toast({
            title: `+${points.toLocaleString()} points`,
            description: description || title || 'Peer session points unlocked.',
            status: 'success',
            position: 'top',
          })
        })
      },
      (error) => {
        console.error('[PointsNotificationListener] Peer session ledger listener error', error)
      },
    )

    return () => {
      unsubscribeLedger()
    }
  }, [toast, user])

  return null
}

export default PointsNotificationListener
