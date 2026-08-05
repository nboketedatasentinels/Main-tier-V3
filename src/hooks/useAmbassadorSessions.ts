import { useEffect, useMemo, useState } from 'react'
import {
  groupBookingsByStatus,
  subscribeToCoachSlots,
  subscribeToLearnerBookings,
  subscribeToOpenSlotsForOrg,
  subscribeToSlotBookings,
  type CoachBooking,
  type CoachBookingStatus,
  type CoachSlot,
} from '@/services/ambassadorSessionService'

interface SlotsResult {
  slots: CoachSlot[]
  loading: boolean
  error: string | null
}

interface BookingsResult {
  bookings: CoachBooking[]
  byStatus: Record<CoachBookingStatus, CoachBooking[]>
  loading: boolean
  error: string | null
}

const useSlotSubscription = (
  subscribe:
    | ((
        id: string,
        onUpdate: (slots: CoachSlot[]) => void,
        onError?: (error: Error) => void,
      ) => () => void)
    | null,
  id: string | null | undefined,
): SlotsResult => {
  const [slots, setSlots] = useState<CoachSlot[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(id && subscribe))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !subscribe) {
      setSlots([])
      setLoading(false)
      setError(null)
      return () => undefined
    }

    setLoading(true)
    setError(null)

    const unsubscribe = subscribe(
      id,
      (next) => {
        setSlots(next)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [id, subscribe])

  return { slots, loading, error }
}

const useBookingsSubscription = (
  subscribe:
    | ((
        id: string,
        onUpdate: (bookings: CoachBooking[]) => void,
        onError?: (error: Error) => void,
      ) => () => void)
    | null,
  id: string | null | undefined,
): BookingsResult => {
  const [bookings, setBookings] = useState<CoachBooking[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(id && subscribe))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !subscribe) {
      setBookings([])
      setLoading(false)
      setError(null)
      return () => undefined
    }

    setLoading(true)
    setError(null)

    const unsubscribe = subscribe(
      id,
      (next) => {
        setBookings(next)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [id, subscribe])

  const byStatus = useMemo(() => groupBookingsByStatus(bookings), [bookings])

  return { bookings, byStatus, loading, error }
}

export const useAmbassadorSlots = (ambassadorId?: string | null): SlotsResult =>
  useSlotSubscription(subscribeToCoachSlots, ambassadorId ?? null)

export const useOpenSlotsForOrg = (companyId?: string | null): SlotsResult =>
  useSlotSubscription(subscribeToOpenSlotsForOrg, companyId ?? null)

export const useSlotBookings = (slotId?: string | null): BookingsResult =>
  useBookingsSubscription(subscribeToSlotBookings, slotId ?? null)

export const useLearnerBookings = (learnerId?: string | null): BookingsResult =>
  useBookingsSubscription(subscribeToLearnerBookings, learnerId ?? null)
