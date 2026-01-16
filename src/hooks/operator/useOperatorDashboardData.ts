import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import {
  listenToDashboardMetrics,
  listenToEngagementRiskAggregates,
  listenToAdminActivityLog,
  listenToRegistrationTrend,
  listenToUserGrowthTrend,
  listenToRegistrations,
  listenToSystemAlerts,
  listenToTaskNotifications,
  listenToVerificationRequests,
} from '@/services/superAdminService'
import type {
  AdminActivityLogEntry,
  EngagementRiskAggregate,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'

type TrendPoint = { label: string; value: number }

type StreamKey =
  | 'metrics'
  | 'risk'
  | 'activityLog'
  | 'registrationTrend'
  | 'userGrowthTrend'
  | 'registrations'
  | 'verificationRequests'
  | 'systemAlerts'
  | 'taskNotifications'

type StreamStatus = {
  loading: boolean
  error: string | null
  lastSuccessAt: Date | null
}

type StreamMap = Record<StreamKey, StreamStatus>

const defaultMetrics: SuperAdminDashboardMetrics = {
  organizationCount: 0,
  managedCompanies: 0,
  paidMembers: 0,
  activeMembers: 0,
  engagementRate: 0,
  newRegistrations: 0,
}

const defaultRisk: EngagementRiskAggregate = { total: 0, riskBuckets: {} }

const initStreams = (): StreamMap => ({
  metrics: { loading: true, error: null, lastSuccessAt: null },
  risk: { loading: true, error: null, lastSuccessAt: null },
  activityLog: { loading: true, error: null, lastSuccessAt: null },
  registrationTrend: { loading: true, error: null, lastSuccessAt: null },
  userGrowthTrend: { loading: true, error: null, lastSuccessAt: null },
  registrations: { loading: true, error: null, lastSuccessAt: null },
  verificationRequests: { loading: true, error: null, lastSuccessAt: null },
  systemAlerts: { loading: true, error: null, lastSuccessAt: null },
  taskNotifications: { loading: true, error: null, lastSuccessAt: null },
})

export type OperatorScope = 'super_admin' | 'partner'

export function useOperatorDashboardData(scope: OperatorScope) {
  const { profile, profileStatus, lastProfileLoadAt, refreshProfile } = useAuth()
  const toast = useToast()

  // Data
  const [metrics, setMetrics] = useState<SuperAdminDashboardMetrics>(defaultMetrics)
  const [riskAggregate, setRiskAggregate] = useState<EngagementRiskAggregate>(defaultRisk)
  const [activityLog, setActivityLog] = useState<AdminActivityLogEntry[]>([])
  const [registrationTrend, setRegistrationTrend] = useState<TrendPoint[]>([])
  const [userGrowthTrend, setUserGrowthTrend] = useState<TrendPoint[]>([])
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([])
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlertRecord[]>([])
  const [taskNotifications, setTaskNotifications] = useState<TaskNotificationRecord[]>([])

  // Stream health
  const [streams, setStreams] = useState<StreamMap>(() => initStreams())
  const [refreshIndex, setRefreshIndex] = useState(0)

  const setStreamOk = useCallback((key: StreamKey) => {
    setStreams(prev => ({
      ...prev,
      [key]: { loading: false, error: null, lastSuccessAt: new Date() },
    }))
  }, [])

  const setStreamError = useCallback(
    (key: StreamKey, message: string, err: unknown) => {
      console.error(err)
      setStreams(prev => ({
        ...prev,
        [key]: { ...prev[key], loading: false, error: message },
      }))
      toast({ title: message, status: 'error' })
    },
    [toast],
  )

  // Decide which streams to run by scope
  const enabledStreams = useMemo(() => {
    const base: StreamKey[] = ['metrics', 'risk', 'systemAlerts']
    if (scope === 'super_admin') {
      return [
        ...base,
        'activityLog',
        'registrationTrend',
        'userGrowthTrend',
        'registrations',
        'verificationRequests',
        'taskNotifications',
      ]
    }
    // Partner gets a slimmer set; add more if needed
    return [...base, 'verificationRequests', 'taskNotifications']
  }, [scope])

  // subscribe helper (prevents duplicated unsubscribe boilerplate)
  const subscribe = useCallback(
    (_unsubs: Array<() => void>, key: StreamKey, fn: () => void) => {
      if (!enabledStreams.includes(key)) {
        // mark as not applicable
        setStreams(prev => ({
          ...prev,
          [key]: { loading: false, error: null, lastSuccessAt: null },
        }))
        return
      }
      fn()
    },
    [enabledStreams],
  )

  // Tier 1 + 2
  useEffect(() => {
    const unsubs: Array<() => void> = []

    subscribe(unsubs, 'metrics', () => {
      unsubs.push(
        listenToDashboardMetrics(
          live => {
            setMetrics(live)
            setStreamOk('metrics')
          },
          undefined,
          err => setStreamError('metrics', 'Failed to load metrics', err),
        ),
      )
    })

    subscribe(unsubs, 'risk', () => {
      unsubs.push(
        listenToEngagementRiskAggregates(
          agg => {
            setRiskAggregate(agg)
            setStreamOk('risk')
          },
          err => setStreamError('risk', 'Failed to load risk aggregates', err),
        ),
      )
    })

    subscribe(unsubs, 'activityLog', () => {
      unsubs.push(
        listenToAdminActivityLog(
          entries => {
            setActivityLog(entries)
            setStreamOk('activityLog')
          },
          10,
          err => setStreamError('activityLog', 'Failed to load activity log', err),
        ),
      )
    })

    subscribe(unsubs, 'registrationTrend', () => {
      unsubs.push(
        listenToRegistrationTrend(
          trend => {
            setRegistrationTrend(trend)
            setStreamOk('registrationTrend')
          },
          14,
          err => setStreamError('registrationTrend', 'Failed to load registration trend', err),
        ),
      )
    })

    subscribe(unsubs, 'userGrowthTrend', () => {
      unsubs.push(
        listenToUserGrowthTrend(
          trend => {
            setUserGrowthTrend(trend)
            setStreamOk('userGrowthTrend')
          },
          30,
          err => setStreamError('userGrowthTrend', 'Failed to load user growth trend', err),
        ),
      )
    })

    return () => unsubs.forEach(u => u())
  }, [refreshIndex, setStreamError, setStreamOk, subscribe])

  // Tier 3 (optional / heavier)
  useEffect(() => {
    const unsubs: Array<() => void> = []

    subscribe(unsubs, 'verificationRequests', () => {
      unsubs.push(
        listenToVerificationRequests(items => {
          setVerificationRequests(items)
          setStreamOk('verificationRequests')
        }),
      )
    })

    subscribe(unsubs, 'registrations', () => {
      unsubs.push(
        listenToRegistrations(items => {
          setRegistrations(items)
          setStreamOk('registrations')
        }),
      )
    })

    subscribe(unsubs, 'systemAlerts', () => {
      unsubs.push(
        listenToSystemAlerts(items => {
          setSystemAlerts(items)
          setStreamOk('systemAlerts')
        }),
      )
    })

    subscribe(unsubs, 'taskNotifications', () => {
      unsubs.push(
        listenToTaskNotifications(items => {
          setTaskNotifications(items)
          setStreamOk('taskNotifications')
        }),
      )
    })

    return () => unsubs.forEach(u => u())
  }, [setStreamOk, subscribe])

  const loading = useMemo(() => {
    // only consider enabled streams
    return (enabledStreams as StreamKey[]).some(k => streams[k].loading)
  }, [enabledStreams, streams])

  const error = useMemo(() => {
    // surface the first enabled error (your health panel can show all)
    const e = (enabledStreams as StreamKey[]).map(k => streams[k].error).find(Boolean)
    return e ?? null
  }, [enabledStreams, streams])

  const retryEngagement = () => setRefreshIndex(i => i + 1)
  const retryProfile = () => void refreshProfile({ reason: `${scope}-health-panel` })

  return {
    profile,
    profileStatus,
    lastProfileLoadAt: lastProfileLoadAt ? new Date(lastProfileLoadAt) : null,

    // Data
    metrics,
    riskAggregate,
    activityLog,
    registrationTrend,
    userGrowthTrend,
    registrations,
    verificationRequests,
    systemAlerts,
    taskNotifications,

    // Health
    streams,
    enabledStreams,
    loading,
    error,
    retryEngagement,
    retryProfile,
  }
}
