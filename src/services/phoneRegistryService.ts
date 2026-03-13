import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { normalizePhoneNumber } from '@/utils/phoneNumber'

const COLLECTION = 'phone_registry'

/**
 * Check whether a normalized phone number is already claimed by another user.
 * Returns the owning UID when taken, or null when available.
 */
export async function checkPhoneAvailability(
  rawPhone: string,
): Promise<{ available: boolean; ownerUid: string | null }> {
  const normalized = normalizePhoneNumber(rawPhone)
  const snap = await getDoc(doc(db, COLLECTION, normalized))

  if (!snap.exists()) {
    return { available: true, ownerUid: null }
  }

  return { available: false, ownerUid: (snap.data().uid as string) ?? null }
}

/**
 * Claim a phone number for the given user.  Writes a document whose ID is the
 * normalized phone and whose body carries the UID + email for cross-platform
 * lookups.
 *
 * This should be called immediately after the Firebase Auth user is created
 * (inside the signUp flow).  If the doc already exists for a *different* UID
 * the write is rejected by security rules.
 */
export async function claimPhoneNumber(
  rawPhone: string,
  uid: string,
  email: string,
): Promise<void> {
  const normalized = normalizePhoneNumber(rawPhone)

  await setDoc(doc(db, COLLECTION, normalized), {
    uid,
    email: email.trim().toLowerCase(),
    phone: normalized,
    claimedAt: serverTimestamp(),
  })
}

/**
 * Look up a user UID by their phone number.  Useful for cross-platform
 * identity resolution (e.g. Ambassadors platform ↔ Tier platform).
 */
export async function lookupUserByPhone(
  rawPhone: string,
): Promise<{ uid: string; email: string } | null> {
  const normalized = normalizePhoneNumber(rawPhone)
  const snap = await getDoc(doc(db, COLLECTION, normalized))

  if (!snap.exists()) return null

  const data = snap.data()
  return { uid: data.uid as string, email: data.email as string }
}

/**
 * Look up a user UID by email across the profiles collection.
 * Useful for cross-platform identity resolution.
 */
export async function lookupUserByEmail(
  email: string,
): Promise<{ uid: string; phoneNumber: string | null } | null> {
  const normalized = email.trim().toLowerCase()
  const q = query(
    collection(db, 'profiles'),
    where('email', '==', normalized),
    limit(1),
  )
  const snap = await getDocs(q)

  if (snap.empty) return null

  const data = snap.docs[0].data()
  return {
    uid: snap.docs[0].id,
    phoneNumber: (data.phoneNumber as string) ?? null,
  }
}
