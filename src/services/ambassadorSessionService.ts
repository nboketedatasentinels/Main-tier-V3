import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { awardChecklistPoints } from '@/services/pointsService'
import { createInAppNotification } from '@/services/notificationService'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'

const SLOTS = 'ambassador_slots'
const BOOKINGS = 'ambassador_slot_bookings'

export type AmbassadorSlotStatus = 'open' | 'full' | 'cancelled' | 'completed'
export type AmbassadorBookingStatus = 'booked' | 'attended' | 'no_show' | 'cancelled'

export interface AmbassadorSlot {
  id: string
  ambassadorId: string
  ambassadorName: string | null
  companyId: string
  companyCode: string | null
  title: string
  description: string | null
  scheduledAt: Date
  durationMinutes: number
  capacity: number
  meetingLink: string | null
  location: string | null
  status: AmbassadorSlotStatus
  bookingCount: number
  cancellationReason: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface AmbassadorBooking {
  id: string
  slotId: string
  learnerId: string
  learnerName: string | null
  ambassadorId: string
  companyId: string | null
  status: AmbassadorBookingStatus
  bookedAt: Date
  attendedAt: Date | null
  cancelledAt: Date | null
  cancelledBy: string | null
  cancelReason: string | null
  pointsAwarded: boolean
  pointsAwardedAt: Date | null
  // Denormalized slot fields for UI convenience
  slotTitle: string | null
  slotScheduledAt: Date | null
  slotStatus: AmbassadorSlotStatus | null
}

const parseTs = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  return null
}

const pickString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const mapSlot = (id: string, data: Record<string, unknown>): AmbassadorSlot => ({
  id,
  ambassadorId: pickString(data.ambassador_id) ?? '',
  ambassadorName: pickString(data.ambassador_name),
  companyId: pickString(data.company_id) ?? '',
  companyCode: pickString(data.company_code),
  title: pickString(data.title) ?? 'Ambassador coaching session',
  description: pickString(data.description),
  scheduledAt: parseTs(data.scheduled_at) ?? new Date(),
  durationMinutes: Number(data.duration_minutes ?? 60) || 60,
  capacity: Math.max(1, Number(data.capacity ?? 1)),
  meetingLink: pickString(data.meeting_link),
  location: pickString(data.location),
  status: (data.status as AmbassadorSlotStatus) || 'open',
  bookingCount: Math.max(0, Number(data.booking_count ?? 0)),
  cancellationReason: pickString(data.cancellation_reason),
  createdAt: parseTs(data.created_at) ?? new Date(),
  updatedAt: parseTs(data.updated_at),
})

const mapBooking = (id: string, data: Record<string, unknown>): AmbassadorBooking => ({
  id,
  slotId: pickString(data.slot_id) ?? '',
  learnerId: pickString(data.learner_id) ?? '',
  learnerName: pickString(data.learner_name),
  ambassadorId: pickString(data.ambassador_id) ?? '',
  companyId: pickString(data.company_id),
  status: (data.status as AmbassadorBookingStatus) || 'booked',
  bookedAt: parseTs(data.booked_at) ?? new Date(),
  attendedAt: parseTs(data.attended_at),
  cancelledAt: parseTs(data.cancelled_at),
  cancelledBy: pickString(data.cancelled_by),
  cancelReason: pickString(data.cancel_reason),
  pointsAwarded: Boolean(data.points_awarded),
  pointsAwardedAt: parseTs(data.points_awarded_at),
  slotTitle: pickString(data.slot_title),
  slotScheduledAt: parseTs(data.slot_scheduled_at),
  slotStatus: (pickString(data.slot_status) as AmbassadorSlotStatus | null) ?? null,
})

const bookingIdFor = (slotId: string, learnerId: string) => `${slotId}__${learnerId}`

async function getJourneyContext(
  uid: string,
): Promise<{ journeyType: JourneyType; weekNumber: number } | null> {
  try {
    const profileSnap = await getDoc(doc(db, 'profiles', uid))
    if (!profileSnap.exists()) return null
    const profile = profileSnap.data() as { journeyType?: JourneyType; currentWeek?: number }
    if (!profile.journeyType) return null
    return {
      journeyType: profile.journeyType,
      weekNumber: Math.max(1, Number(profile.currentWeek ?? 1)),
    }
  } catch (err) {
    console.error('[AmbassadorSessionService] Journey context failed:', err)
    return null
  }
}

export async function createAmbassadorSlot(params: {
  ambassadorId: string
  ambassadorName?: string
  companyId: string
  companyCode?: string
  title: string
  description?: string
  scheduledAt: Date
  durationMinutes?: number
  capacity: number
  meetingLink?: string
  location?: string
}): Promise<string> {
  const {
    ambassadorId,
    ambassadorName,
    companyId,
    companyCode,
    title,
    description,
    scheduledAt,
    durationMinutes = 60,
    capacity,
    meetingLink,
    location,
  } = params

  if (!ambassadorId) throw new Error('Ambassador id is required.')
  if (!companyId) throw new Error('Organization is required.')
  if (!title.trim()) throw new Error('A session title is required.')
  if (capacity < 1) throw new Error('Capacity must be at least 1 learner.')
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new Error('Scheduled time must be in the future.')
  }

  const docRef = await addDoc(collection(db, SLOTS), {
    ambassador_id: ambassadorId,
    ambassador_name: ambassadorName ?? null,
    company_id: companyId,
    company_code: companyCode ?? null,
    title: title.trim(),
    description: description?.trim() || null,
    scheduled_at: Timestamp.fromDate(scheduledAt),
    duration_minutes: Math.max(15, Math.round(durationMinutes)),
    capacity: Math.round(capacity),
    meeting_link: meetingLink?.trim() || null,
    location: location?.trim() || null,
    status: 'open' as AmbassadorSlotStatus,
    booking_count: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    created_by: ambassadorId,
  })

  return docRef.id
}

export async function updateAmbassadorSlot(params: {
  slotId: string
  updates: Partial<{
    title: string
    description: string | null
    scheduledAt: Date
    durationMinutes: number
    capacity: number
    meetingLink: string | null
    location: string | null
  }>
}): Promise<void> {
  const { slotId, updates } = params
  const slotRef = doc(db, SLOTS, slotId)
  const slotSnap = await getDoc(slotRef)
  if (!slotSnap.exists()) throw new Error('Slot not found.')

  const data = slotSnap.data() as { booking_count?: number; status?: AmbassadorSlotStatus }
  if (data.status === 'cancelled' || data.status === 'completed') {
    throw new Error('Slot is closed and cannot be edited.')
  }

  const payload: Record<string, unknown> = { updated_at: serverTimestamp() }
  if (updates.title !== undefined) payload.title = updates.title.trim()
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.scheduledAt) payload.scheduled_at = Timestamp.fromDate(updates.scheduledAt)
  if (updates.durationMinutes !== undefined)
    payload.duration_minutes = Math.max(15, Math.round(updates.durationMinutes))
  if (updates.capacity !== undefined) {
    const currentBookings = data.booking_count ?? 0
    if (updates.capacity < currentBookings) {
      throw new Error(
        `Capacity cannot be below current booking count (${currentBookings}).`,
      )
    }
    payload.capacity = Math.round(updates.capacity)
    // Re-open a full slot if capacity increased
    if (data.status === 'full' && updates.capacity > currentBookings) {
      payload.status = 'open' as AmbassadorSlotStatus
    }
  }
  if (updates.meetingLink !== undefined) payload.meeting_link = updates.meetingLink
  if (updates.location !== undefined) payload.location = updates.location

  await updateDoc(slotRef, payload)
}

export async function cancelAmbassadorSlot(params: {
  slotId: string
  actorId: string
  reason?: string
}): Promise<void> {
  const { slotId, actorId, reason } = params
  const slotRef = doc(db, SLOTS, slotId)

  const slotSnap = await getDoc(slotRef)
  if (!slotSnap.exists()) throw new Error('Slot not found.')
  const data = slotSnap.data() as { status?: AmbassadorSlotStatus; title?: string }
  if (data.status === 'cancelled' || data.status === 'completed') {
    throw new Error('Slot is already closed.')
  }

  await updateDoc(slotRef, {
    status: 'cancelled' as AmbassadorSlotStatus,
    cancellation_reason: reason?.trim() || null,
    cancelled_by: actorId,
    updated_at: serverTimestamp(),
  })

  // Fan-out: cancel all active bookings for this slot + notify learners
  const bookingsQuery = query(
    collection(db, BOOKINGS),
    where('slot_id', '==', slotId),
    where('status', '==', 'booked'),
  )
  const snapshot = await getDocs(bookingsQuery)
  const notifyPromises: Promise<unknown>[] = []
  for (const docSnap of snapshot.docs) {
    const bookingData = docSnap.data() as { learner_id?: string }
    await updateDoc(docSnap.ref, {
      status: 'cancelled' as AmbassadorBookingStatus,
      cancelled_at: serverTimestamp(),
      cancelled_by: actorId,
      cancel_reason: reason?.trim() || 'Ambassador cancelled the session',
      slot_status: 'cancelled' as AmbassadorSlotStatus,
    })
    if (bookingData.learner_id) {
      notifyPromises.push(
        createInAppNotification({
          userId: bookingData.learner_id,
          type: 'important_update',
          title: 'Ambassador session cancelled',
          message: reason?.trim()
            ? `${data.title ?? 'A coaching session'} was cancelled. Reason: ${reason.trim()}`
            : `${data.title ?? 'A coaching session'} was cancelled by the ambassador.`,
          relatedId: slotId,
          metadata: { slotId, kind: 'ambassador_slot_cancelled' },
        }).catch((err) =>
          console.warn('[AmbassadorSessionService] notify cancel fan-out failed:', err),
        ),
      )
    }
  }
  await Promise.all(notifyPromises)
}

export async function bookAmbassadorSlot(params: {
  slotId: string
  learnerId: string
  learnerName?: string
  companyId?: string
}): Promise<string> {
  const { slotId, learnerId, learnerName, companyId } = params

  if (!slotId || !learnerId) throw new Error('Slot and learner ids are required.')

  const slotRef = doc(db, SLOTS, slotId)
  const bookingId = bookingIdFor(slotId, learnerId)
  const bookingRef = doc(db, BOOKINGS, bookingId)

  let ambassadorId: string | null = null
  let slotTitle: string | null = null

  await runTransaction(db, async (tx) => {
    const [slotDoc, bookingDoc] = await Promise.all([tx.get(slotRef), tx.get(bookingRef)])
    if (!slotDoc.exists()) throw new Error('This session no longer exists.')

    const slotData = slotDoc.data()
    if (slotData.status === 'cancelled' || slotData.status === 'completed') {
      throw new Error('This session is no longer accepting bookings.')
    }

    const capacity = Number(slotData.capacity ?? 0)
    const currentCount = Number(slotData.booking_count ?? 0)
    if (currentCount >= capacity) {
      throw new Error('This session is already full.')
    }

    if (bookingDoc.exists()) {
      const existing = bookingDoc.data() as { status?: AmbassadorBookingStatus }
      if (existing.status === 'booked' || existing.status === 'attended') {
        throw new Error('You are already booked for this session.')
      }
    }

    ambassadorId = pickString(slotData.ambassador_id)
    slotTitle = pickString(slotData.title)

    const scheduledAt = slotData.scheduled_at
    tx.set(bookingRef, {
      slot_id: slotId,
      learner_id: learnerId,
      learner_name: learnerName ?? null,
      ambassador_id: ambassadorId,
      company_id: companyId ?? slotData.company_id ?? null,
      status: 'booked' as AmbassadorBookingStatus,
      booked_at: serverTimestamp(),
      attended_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancel_reason: null,
      points_awarded: false,
      points_awarded_at: null,
      slot_title: slotTitle,
      slot_scheduled_at: scheduledAt ?? null,
      slot_status: slotData.status as AmbassadorSlotStatus,
    })

    const nextCount = currentCount + 1
    tx.update(slotRef, {
      booking_count: increment(1),
      status: nextCount >= capacity ? ('full' as AmbassadorSlotStatus) : (slotData.status as AmbassadorSlotStatus),
      updated_at: serverTimestamp(),
    })
  })

  if (ambassadorId) {
    await createInAppNotification({
      userId: ambassadorId,
      type: 'session_request',
      title: 'New booking on your coaching session',
      message: `${learnerName ?? 'A learner'} booked "${slotTitle ?? 'your session'}".`,
      relatedId: slotId,
      metadata: { slotId, bookingId, learnerId, kind: 'ambassador_slot_booked' },
    }).catch((err) => console.warn('[AmbassadorSessionService] notify booking failed:', err))
  }

  return bookingId
}

export async function cancelBooking(params: {
  bookingId: string
  actorId: string
  reason?: string
}): Promise<void> {
  const { bookingId, actorId, reason } = params
  const bookingRef = doc(db, BOOKINGS, bookingId)

  await runTransaction(db, async (tx) => {
    const bookingDoc = await tx.get(bookingRef)
    if (!bookingDoc.exists()) throw new Error('Booking not found.')

    const bookingData = bookingDoc.data()
    const currentStatus = bookingData.status as AmbassadorBookingStatus | undefined
    if (currentStatus !== 'booked') {
      throw new Error('Booking cannot be cancelled in its current state.')
    }

    const slotId = pickString(bookingData.slot_id)
    if (!slotId) throw new Error('Booking is missing a slot reference.')

    const slotRef = doc(db, SLOTS, slotId)
    const slotDoc = await tx.get(slotRef)
    const slotStatus = slotDoc.exists() ? (slotDoc.data().status as AmbassadorSlotStatus) : 'open'

    tx.update(bookingRef, {
      status: 'cancelled' as AmbassadorBookingStatus,
      cancelled_at: serverTimestamp(),
      cancelled_by: actorId,
      cancel_reason: reason?.trim() || null,
    })

    if (slotDoc.exists()) {
      tx.update(slotRef, {
        booking_count: increment(-1),
        status: slotStatus === 'full' ? 'open' : slotStatus,
        updated_at: serverTimestamp(),
      })
    }
  })
}

export async function markAttendance(params: {
  bookingId: string
  status: 'attended' | 'no_show'
  markedBy: string
}): Promise<{ pointsAwarded: boolean }> {
  const { bookingId, status, markedBy } = params
  const bookingRef = doc(db, BOOKINGS, bookingId)

  let learnerId: string | null = null
  let slotTitle: string | null = null
  let shouldAwardPoints = false

  await runTransaction(db, async (tx) => {
    const bookingDoc = await tx.get(bookingRef)
    if (!bookingDoc.exists()) throw new Error('Booking not found.')

    const data = bookingDoc.data()
    const currentStatus = data.status as AmbassadorBookingStatus | undefined

    if (currentStatus === status) {
      learnerId = pickString(data.learner_id)
      slotTitle = pickString(data.slot_title)
      return
    }

    if (currentStatus !== 'booked' && currentStatus !== 'attended' && currentStatus !== 'no_show') {
      throw new Error('Attendance can only be marked on active bookings.')
    }

    learnerId = pickString(data.learner_id)
    slotTitle = pickString(data.slot_title)
    shouldAwardPoints = status === 'attended' && !data.points_awarded

    tx.update(bookingRef, {
      status,
      attended_at: status === 'attended' ? serverTimestamp() : null,
      marked_by: markedBy,
      ...(shouldAwardPoints ? { points_awarded: true, points_awarded_at: serverTimestamp() } : {}),
    })
  })

  if (shouldAwardPoints && learnerId) {
    try {
      const context = await getJourneyContext(learnerId)
      if (context) {
        const activity = getActivityDefinitionById({
          activityId: 'ambassador_session',
          journeyType: context.journeyType,
        })
        if (activity) {
          await awardChecklistPoints({
            uid: learnerId,
            journeyType: context.journeyType,
            weekNumber: context.weekNumber,
            activity,
            source: 'ambassador_attendance',
            claimRef: `ambassador_session:${bookingId}`,
          })
        } else {
          console.warn(
            `[AmbassadorSessionService] ambassador_session activity unavailable for ${context.journeyType}`,
          )
        }
      }
    } catch (err) {
      console.error('[AmbassadorSessionService] Failed to award attendance points:', err)
    }
  }

  if (learnerId) {
    await createInAppNotification({
      userId: learnerId,
      type: 'approval',
      title: status === 'attended' ? 'Attendance confirmed' : 'Marked as no-show',
      message:
        status === 'attended'
          ? shouldAwardPoints
            ? `Your ambassador confirmed your attendance at "${slotTitle ?? 'the session'}". Points added.`
            : `Your ambassador confirmed your attendance at "${slotTitle ?? 'the session'}".`
          : `Your ambassador recorded a no-show for "${slotTitle ?? 'the session'}".`,
      relatedId: bookingId,
      metadata: { bookingId, kind: 'ambassador_attendance' },
    }).catch((err) =>
      console.warn('[AmbassadorSessionService] notify attendance failed:', err),
    )
  }

  return { pointsAwarded: shouldAwardPoints }
}

export async function markSlotCompleted(slotId: string): Promise<void> {
  const slotRef = doc(db, SLOTS, slotId)
  await setDoc(
    slotRef,
    { status: 'completed' as AmbassadorSlotStatus, updated_at: serverTimestamp() },
    { merge: true },
  )
}

const subscribeToSlotsBy = (
  field: 'ambassador_id' | 'company_id',
  value: string,
  onUpdate: (slots: AmbassadorSlot[]) => void,
  onError?: (error: Error) => void,
  extraOpenOnly = false,
): Unsubscribe => {
  const constraints = extraOpenOnly
    ? [where(field, '==', value), where('status', 'in', ['open', 'full'])]
    : [where(field, '==', value)]
  const q = query(collection(db, SLOTS), ...constraints, orderBy('scheduled_at', 'asc'))
  return onSnapshot(
    q,
    (snapshot) => onUpdate(snapshot.docs.map((d) => mapSlot(d.id, d.data()))),
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}

export const subscribeToAmbassadorSlots = (
  ambassadorId: string,
  onUpdate: (slots: AmbassadorSlot[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => subscribeToSlotsBy('ambassador_id', ambassadorId, onUpdate, onError)

export const subscribeToOpenSlotsForOrg = (
  companyId: string,
  onUpdate: (slots: AmbassadorSlot[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => subscribeToSlotsBy('company_id', companyId, onUpdate, onError, true)

export const subscribeToSlotBookings = (
  slotId: string,
  onUpdate: (bookings: AmbassadorBooking[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(collection(db, BOOKINGS), where('slot_id', '==', slotId))
  return onSnapshot(
    q,
    (snapshot) => {
      const bookings = snapshot.docs.map((d) => mapBooking(d.id, d.data()))
      bookings.sort(
        (a, b) => (a.bookedAt?.getTime() ?? 0) - (b.bookedAt?.getTime() ?? 0),
      )
      onUpdate(bookings)
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}

export const subscribeToLearnerBookings = (
  learnerId: string,
  onUpdate: (bookings: AmbassadorBooking[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(collection(db, BOOKINGS), where('learner_id', '==', learnerId))
  return onSnapshot(
    q,
    (snapshot) => {
      const bookings = snapshot.docs.map((d) => mapBooking(d.id, d.data()))
      bookings.sort(
        (a, b) =>
          (b.slotScheduledAt?.getTime() ?? b.bookedAt?.getTime() ?? 0) -
          (a.slotScheduledAt?.getTime() ?? a.bookedAt?.getTime() ?? 0),
      )
      onUpdate(bookings)
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}

export const groupBookingsByStatus = (
  bookings: AmbassadorBooking[],
): Record<AmbassadorBookingStatus, AmbassadorBooking[]> => ({
  booked: bookings.filter((b) => b.status === 'booked'),
  attended: bookings.filter((b) => b.status === 'attended'),
  no_show: bookings.filter((b) => b.status === 'no_show'),
  cancelled: bookings.filter((b) => b.status === 'cancelled'),
})
