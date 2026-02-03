import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/services/firebase'

/**
 * Hook to manage engagement monitoring feature flag
 */
export const useEngagementConfig = () => {
  const [engagementEnabled, setEngagementEnabled] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const configRef = doc(db, 'platform_config', 'engagement')
        const snap = await getDoc(configRef)
        setEngagementEnabled(snap.exists() && snap.data()?.enabled === true)
      } catch (error) {
        console.error('[useEngagementConfig] Failed to check config:', error)
        setEngagementEnabled(false)
      } finally {
        setIsLoading(false)
      }
    }
    checkConfig()
  }, [])

  const enableEngagement = async () => {
    try {
      const configRef = doc(db, 'platform_config', 'engagement')
      await setDoc(
        configRef,
        {
          enabled: true,
          enabledAt: serverTimestamp(),
          enabledBy: auth.currentUser?.uid || null,
        },
        { merge: true }
      )
      setEngagementEnabled(true)
    } catch (error) {
      console.error('[useEngagementConfig] Failed to enable engagement:', error)
      throw error
    }
  }

  return { engagementEnabled, isLoading, enableEngagement }
}
