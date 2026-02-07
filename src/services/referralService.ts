import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/services/firebase'
import { REFERRAL_POINTS } from '@/config/pointsConfig'

type ReferralStatus = 'pending' | 'credited' | 'rejected'

type ReferralRecord = {
  referredUid: string
  referrerUid: string
  refCode: string
  status: ReferralStatus
  createdAt?: unknown
  creditedAt?: unknown
  firstActivityId?: string
  firstActivityAt?: unknown
}

export interface ReferralWithDetails extends ReferralRecord {
  id: string
  referredEmail?: string
  referredName?: string
}

const referralCodesCollection = collection(db, 'referralCodes')
const referralsCollection = collection(db, 'referrals')
const usersCollection = collection(db, 'users')
const profilesCollection = collection(db, 'profiles')

export async function generateReferralCode(uid: string): Promise<string> {
  const code = uid.trim()
  if (!code) {
    throw new Error('Unable to generate referral code without a user id.')
  }

  const codeRef = doc(referralCodesCollection, code)

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(codeRef)
    if (existing.exists()) return

    tx.set(codeRef, {
      uid,
      active: true,
      createdAt: serverTimestamp(),
    })
  })

  return code
}

export async function validateReferralCode(code: string): Promise<string | null> {
  const trimmed = code.trim()
  if (!trimmed) return null

  const codeSnap = await getDoc(doc(referralCodesCollection, trimmed))
  if (!codeSnap.exists()) return null

  const data = codeSnap.data() as { uid?: string; active?: boolean }
  if (!data.uid || data.active === false) return null

  return data.uid
}

export async function createReferral(
  referredUid: string,
  referrerUid: string,
  refCode: string
): Promise<{ success: boolean; error?: Error }> {
  const trimmedCode = refCode.trim()
  if (!trimmedCode) {
    return { success: false, error: new Error('Referral code is missing.') }
  }

  if (referredUid === referrerUid) {
    return { success: false, error: new Error('You cannot refer yourself.') }
  }

  try {
    await runTransaction(db, async (tx) => {
      const referralRef = doc(referralsCollection, referredUid)
      const referralCodeRef = doc(referralCodesCollection, trimmedCode)
      const referredUserRef = doc(usersCollection, referredUid)
      const referredProfileRef = doc(profilesCollection, referredUid)

      const referralSnap = await tx.get(referralRef)
      if (referralSnap.exists()) {
        throw new Error('Referral already exists for this user.')
      }

      const referralCodeSnap = await tx.get(referralCodeRef)
      if (!referralCodeSnap.exists()) {
        throw new Error('Referral code is invalid.')
      }

      const referralCodeData = referralCodeSnap.data() as { uid?: string; active?: boolean }
      if (!referralCodeData.uid || referralCodeData.active === false) {
        throw new Error('Referral code is inactive.')
      }

      if (referralCodeData.uid !== referrerUid) {
        throw new Error('Referral code does not match referrer.')
      }

      const referredUserSnap = await tx.get(referredUserRef)
      if (referredUserSnap.exists()) {
        const referredUserData = referredUserSnap.data() as { referredBy?: string | null }
        if (referredUserData.referredBy) {
          throw new Error('This account already has a referrer.')
        }
      }

      const referralPayload: ReferralRecord = {
        referredUid,
        referrerUid,
        refCode: trimmedCode,
        status: 'pending',
        createdAt: serverTimestamp(),
      }

      tx.set(referralRef, referralPayload)
      tx.set(
        referredUserRef,
        {
          referredBy: referrerUid,
          referralStatus: 'pending',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      tx.set(
        referredProfileRef,
        {
          referredBy: referrerUid,
          referralStatus: 'pending',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    })

    return { success: true }
  } catch (error) {
    console.error('🔴 [Referral] Failed to create referral', error)
    const normalizedError = error instanceof Error ? error : new Error('Unable to create referral.')
    return { success: false, error: normalizedError }
  }
}

/**
 * @deprecated Use Cloud Function trigger instead. Points are now awarded automatically
 * when the referred user completes their first platform activity.
 *
 * This function is kept for backwards compatibility but should not be called directly.
 * The Cloud Function `onReferredUserFirstActivity` handles referral point awards.
 *
 * For manual credit (admin/partner use), use `manualCreditReferralPoints` instead.
 */
export async function creditReferralPoints(
  referredUid: string
): Promise<{ success: boolean; error?: Error }> {
  console.warn(
    '[Referral] creditReferralPoints is deprecated. Points are now awarded via Cloud Function when referred user completes first activity.'
  )

  try {
    // Check if referral is still pending
    const referralDoc = await getDoc(doc(referralsCollection, referredUid))
    if (!referralDoc.exists()) {
      return { success: false, error: new Error('Referral record not found.') }
    }

    const referralData = referralDoc.data() as ReferralRecord
    if (referralData.status === 'credited') {
      // Already credited, consider this success
      return { success: true }
    }

    if (referralData.status === 'rejected') {
      return { success: false, error: new Error('Referral was rejected.') }
    }

    // For pending referrals, the Cloud Function will handle it when the user
    // completes their first activity. Return success to not block onboarding.
    console.log(
      `[Referral] Referral for ${referredUid} is pending. Points will be awarded when user completes first activity.`
    )
    return { success: true }
  } catch (error) {
    console.error('🔴 [Referral] Error checking referral status', error)
    const normalizedError =
      error instanceof Error ? error : new Error('Unable to check referral status.')
    return { success: false, error: normalizedError }
  }
}

/**
 * Manually credit referral points via Cloud Function.
 * Only super_admin and partner roles can use this function.
 *
 * Use this when automatic detection failed or for edge cases.
 */
export async function manualCreditReferralPoints(
  referredUid: string
): Promise<{ success: boolean; message: string }> {
  try {
    const creditReferralPointsCallable = httpsCallable<
      { referredUid: string },
      { success: boolean; message: string }
    >(functions, 'creditReferralPointsCallable')

    const result = await creditReferralPointsCallable({ referredUid })
    return result.data
  } catch (error) {
    console.error('🔴 [Referral] Failed to manually credit referral points', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to credit referral points',
    }
  }
}

/**
 * Subscribe to real-time updates for a user's referrals.
 * Returns an unsubscribe function.
 *
 * @param referrerUid - The UID of the referrer to watch
 * @param callback - Called with updated referral list whenever changes occur
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToReferrals(
  referrerUid: string,
  callback: (referrals: ReferralWithDetails[]) => void
): () => void {
  const q = query(
    referralsCollection,
    where('referrerUid', '==', referrerUid),
    orderBy('createdAt', 'desc'),
    limit(50)
  )

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      const referrals: ReferralWithDetails[] = []

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as ReferralRecord
        let referredEmail: string | undefined
        let referredName: string | undefined

        // Fetch referred user details
        try {
          const referredProfile = await getDoc(doc(profilesCollection, data.referredUid))
          if (referredProfile.exists()) {
            const profileData = referredProfile.data()
            referredEmail = profileData.email
            referredName = profileData.fullName || profileData.firstName
          }
        } catch {
          // Ignore errors fetching profile details
        }

        referrals.push({
          id: docSnap.id,
          ...data,
          referredEmail,
          referredName,
        })
      }

      callback(referrals)
    },
    (error) => {
      console.error('🔴 [Referral] Error subscribing to referrals', error)
    }
  )

  return unsubscribe
}

/**
 * Subscribe to real-time updates for a referred user's referral status.
 * Useful for showing the referred user when their referral is credited.
 *
 * @param referredUid - The UID of the referred user
 * @param callback - Called with updated referral record whenever status changes
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToReferralStatus(
  referredUid: string,
  callback: (referral: ReferralRecord | null) => void
): () => void {
  const referralRef = doc(referralsCollection, referredUid)

  const unsubscribe = onSnapshot(
    referralRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as ReferralRecord)
      } else {
        callback(null)
      }
    },
    (error) => {
      console.error('🔴 [Referral] Error subscribing to referral status', error)
    }
  )

  return unsubscribe
}

/**
 * Get referral statistics for a user.
 */
export async function getReferralStats(referrerUid: string): Promise<{
  totalReferrals: number
  pendingReferrals: number
  creditedReferrals: number
  rejectedReferrals: number
  totalPointsEarned: number
}> {
  try {
    const q = query(referralsCollection, where('referrerUid', '==', referrerUid))
    const snapshot = await getDocs(q)

    let pendingReferrals = 0
    let creditedReferrals = 0
    let rejectedReferrals = 0

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as ReferralRecord
      switch (data.status) {
        case 'pending':
          pendingReferrals++
          break
        case 'credited':
          creditedReferrals++
          break
        case 'rejected':
          rejectedReferrals++
          break
      }
    })

    return {
      totalReferrals: snapshot.size,
      pendingReferrals,
      creditedReferrals,
      rejectedReferrals,
      totalPointsEarned: creditedReferrals * REFERRAL_POINTS,
    }
  } catch (error) {
    console.error('🔴 [Referral] Error getting referral stats', error)
    return {
      totalReferrals: 0,
      pendingReferrals: 0,
      creditedReferrals: 0,
      rejectedReferrals: 0,
      totalPointsEarned: 0,
    }
  }
}

/**
 * Check if a user has completed their first activity (has at least one ledger entry).
 * This can be used to show referred users their progress toward earning the referrer points.
 */
export async function hasCompletedFirstActivity(uid: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'pointsLedger'),
      where('uid', '==', uid),
      limit(1)
    )
    const snapshot = await getDocs(q)
    return snapshot.size > 0
  } catch (error) {
    console.error('🔴 [Referral] Error checking first activity', error)
    return false
  }
}
