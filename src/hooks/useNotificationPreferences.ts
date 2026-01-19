/**
 * useNotificationPreferences Hook
 * Manages notification preference settings for users
 */

import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { NotificationPreferences } from '@/types/monitoring'

const DEFAULT_PREFERENCES: NotificationPreferences = {
  id: '',
  userId: '',
  emailNotificationsEnabled: true,
  inAppNotificationsEnabled: true,
  statusAlerts: {
    enabled: true,
    frequency: 'instant',
    includeAtRiskWarnings: true,
    includeInactiveNotices: true,
  },
  recoveryNotifications: {
    enabled: true,
  },
  weeklyDigests: {
    enabled: false,
    frequency: 'weekly',
    preferredDay: 'monday',
    preferredTime: '09:00',
  },
  updatedAt: Timestamp.now(),
}

export interface UseNotificationPreferencesResult {
  preferences: NotificationPreferences | null
  loading: boolean
  error: Error | null
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>
  updateStatusAlerts: (updates: Partial<NotificationPreferences['statusAlerts']>) => Promise<void>
  updateRecoveryNotifications: (updates: Partial<NotificationPreferences['recoveryNotifications']>) => Promise<void>
  updateWeeklyDigests: (updates: Partial<NotificationPreferences['weeklyDigests']>) => Promise<void>
  toggleEmailNotifications: () => Promise<void>
  toggleInAppNotifications: () => Promise<void>
  resetToDefaults: () => Promise<void>
}

export function useNotificationPreferences(userId: string): UseNotificationPreferencesResult {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch preferences on mount
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    fetchPreferences()
  }, [userId])

  const fetchPreferences = async () => {
    try {
      setLoading(true)
      const prefsRef = doc(db, 'notification_preferences', userId)
      const prefsSnapshot = await getDoc(prefsRef)

      if (prefsSnapshot.exists()) {
        setPreferences(prefsSnapshot.data() as NotificationPreferences)
      } else {
        // Create default preferences
        const defaultPrefs = {
          ...DEFAULT_PREFERENCES,
          id: userId,
          userId,
          updatedAt: Timestamp.now(),
        }
        await setDoc(prefsRef, defaultPrefs)
        setPreferences(defaultPrefs)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch preferences'))
      setPreferences(null)
    } finally {
      setLoading(false)
    }
  }

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return

    try {
      const prefsRef = doc(db, 'notification_preferences', userId)
      const updatedPrefs = {
        ...preferences,
        ...updates,
        updatedAt: Timestamp.now(),
      }

      await updateDoc(prefsRef, updatedPrefs)
      setPreferences(updatedPrefs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update preferences'))
    }
  }

  const updateStatusAlerts = async (updates: Partial<NotificationPreferences['statusAlerts']>) => {
    if (!preferences) return

    const updatedStatusAlerts = {
      ...preferences.statusAlerts,
      ...updates,
    }

    await updatePreferences({
      statusAlerts: updatedStatusAlerts,
    })
  }

  const updateRecoveryNotifications = async (
    updates: Partial<NotificationPreferences['recoveryNotifications']>,
  ) => {
    if (!preferences) return

    const updatedRecovery = {
      ...preferences.recoveryNotifications,
      ...updates,
    }

    await updatePreferences({
      recoveryNotifications: updatedRecovery,
    })
  }

  const updateWeeklyDigests = async (updates: Partial<NotificationPreferences['weeklyDigests']>) => {
    if (!preferences) return

    const updatedDigests = {
      ...preferences.weeklyDigests,
      ...updates,
    }

    await updatePreferences({
      weeklyDigests: updatedDigests,
    })
  }

  const toggleEmailNotifications = async () => {
    if (!preferences) return

    await updatePreferences({
      emailNotificationsEnabled: !preferences.emailNotificationsEnabled,
    })
  }

  const toggleInAppNotifications = async () => {
    if (!preferences) return

    await updatePreferences({
      inAppNotificationsEnabled: !preferences.inAppNotificationsEnabled,
    })
  }

  const resetToDefaults = async () => {
    const defaultPrefs = {
      ...DEFAULT_PREFERENCES,
      id: userId,
      userId,
      updatedAt: Timestamp.now(),
    }

    const prefsRef = doc(db, 'notification_preferences', userId)
    await setDoc(prefsRef, defaultPrefs, { merge: true })
    setPreferences(defaultPrefs)
  }

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    updateStatusAlerts,
    updateRecoveryNotifications,
    updateWeeklyDigests,
    toggleEmailNotifications,
    toggleInAppNotifications,
    resetToDefaults,
  }
}

/**
 * Custom hook to get learner status dashboard data
 */
export function useLearnerStatusDashboard(userId: string) {
  const [statusData, setStatusData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    fetchStatusData()
  }, [userId])

  const fetchStatusData = async () => {
    try {
      setLoading(true)
      const statusRef = doc(db, 'learner_status', userId)
      const statusSnapshot = await getDoc(statusRef)

      if (statusSnapshot.exists()) {
        setStatusData(statusSnapshot.data())
      } else {
        setStatusData(null)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch status data'))
      setStatusData(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshStatusData = async () => {
    await fetchStatusData()
  }

  return { statusData, loading, error, refreshStatusData }
}

/**
 * Custom hook to get partner dashboard data
 */
export function usePartnerDashboard(partnerId: string, orgId: string) {
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!partnerId || !orgId) {
      setLoading(false)
      return
    }

    fetchDashboardData()
  }, [partnerId, orgId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Query learner statuses for this org
      const { getDocs, query, where } = await import('firebase/firestore')

      const statusQuery = query(
        collection(db, 'learner_status'),
        where('orgId', '==', orgId),
      )

      const statusSnapshot = await getDocs(statusQuery)
      const statuses = statusSnapshot.docs.map((doc) => doc.data())

      // Get alerts
      const alertsQuery = query(
        collection(db, 'status_alerts'),
        where('orgId', '==', orgId),
      )

      const alertsSnapshot = await getDocs(alertsQuery)
      const alerts = alertsSnapshot.docs.map((doc) => doc.data())

      const dashData = {
        learners: statuses,
        alerts,
        stats: {
          total: statuses.length,
          active: statuses.filter((s: any) => s.currentStatus === 'active').length,
          atRisk: statuses.filter((s: any) => s.currentStatus === 'at_risk').length,
          inactive: statuses.filter((s: any) => s.currentStatus === 'inactive').length,
        },
      }

      setDashboardData(dashData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'))
      setDashboardData(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshDashboardData = async () => {
    await fetchDashboardData()
  }

  return { dashboardData, loading, error, refreshDashboardData }
}
