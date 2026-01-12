import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { calculateLevel } from '@/utils/points'
import { REFERRAL_MAX_PER_USER, REFERRAL_POINTS } from '@/config/pointsConfig'

type ReferralStatus = 'pending' | 'credited' | 'rejected'

type ReferralRecord = {
  referredUid: string
  referrerUid: string
  refCode: string
  status: ReferralStatus
  createdAt?: unknown
  creditedAt?: unknown
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

export async function creditReferralPoints(
  referredUid: string
): Promise<{ success: boolean; error?: Error }> {
  try {
    await runTransaction(db, async (tx) => {
      const referralRef = doc(referralsCollection, referredUid)
      const referralSnap = await tx.get(referralRef)

      if (!referralSnap.exists()) {
        throw new Error('Referral record not found.')
      }

      const referralData = referralSnap.data() as ReferralRecord
      if (referralData.status !== 'pending') {
        return
      }

      const referrerUid = referralData.referrerUid
      if (!referrerUid) {
        throw new Error('Referral record is missing referrer information.')
      }

      const referrerUserRef = doc(usersCollection, referrerUid)
      const referrerProfileRef = doc(profilesCollection, referrerUid)
      const referrerUserSnap = await tx.get(referrerUserRef)

      if (!referrerUserSnap.exists()) {
        throw new Error('Referrer profile not found.')
      }

      const referrerData = referrerUserSnap.data() as { totalPoints?: number; referralCount?: number }
      const currentTotalPoints = referrerData.totalPoints ?? 0
      const currentReferralCount = referrerData.referralCount ?? 0

      if (REFERRAL_MAX_PER_USER && currentReferralCount >= REFERRAL_MAX_PER_USER) {
        tx.set(
          referralRef,
          {
            status: 'rejected',
            creditedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
        tx.set(
          doc(usersCollection, referredUid),
          { referralStatus: 'rejected', updatedAt: serverTimestamp() },
          { merge: true }
        )
        tx.set(
          doc(profilesCollection, referredUid),
          { referralStatus: 'rejected', updatedAt: serverTimestamp() },
          { merge: true }
        )
        return
      }

      const updatedTotalPoints = currentTotalPoints + REFERRAL_POINTS
      const updatedReferralCount = currentReferralCount + 1
      const updatedLevel = calculateLevel(updatedTotalPoints)

      tx.set(
        referralRef,
        {
          status: 'credited',
          creditedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      tx.set(
        referrerUserRef,
        {
          totalPoints: updatedTotalPoints,
          level: updatedLevel,
          referralCount: updatedReferralCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      tx.set(
        referrerProfileRef,
        {
          totalPoints: updatedTotalPoints,
          level: updatedLevel,
          referralCount: updatedReferralCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      tx.set(
        doc(usersCollection, referredUid),
        {
          referralStatus: 'credited',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      tx.set(
        doc(profilesCollection, referredUid),
        {
          referralStatus: 'credited',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    })

    return { success: true }
  } catch (error) {
    console.error('🔴 [Referral] Failed to credit referral points', error)
    const normalizedError = error instanceof Error ? error : new Error('Unable to credit referral points.')
    return { success: false, error: normalizedError }
  }
}
