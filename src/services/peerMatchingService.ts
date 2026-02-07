/**
 * Peer Matching Service
 *
 * Provides frontend access to peer matching Cloud Functions.
 * Used by super admins to manually trigger peer matching.
 */

import { httpsCallable } from 'firebase/functions'
import { functions } from '@/services/firebase'

export interface TriggerPeerMatchingRequest {
  organizationId?: string
}

export interface TriggerPeerMatchingResponse {
  status: 'success' | 'error'
  message: string
  totalUsers: number
  totalCreated: number
  totalSkipped: number
  groupsProcessed: number
  duration: number
  triggeredBy?: string
}

/**
 * Manually trigger peer matching for all organizations or a specific organization.
 * Only callable by super_admin users.
 *
 * @param organizationId - Optional organization ID to limit matching to
 * @returns Promise with matching results
 */
export const triggerPeerMatching = async (
  organizationId?: string
): Promise<TriggerPeerMatchingResponse> => {
  const callable = httpsCallable<TriggerPeerMatchingRequest, TriggerPeerMatchingResponse>(
    functions,
    'triggerPeerMatching'
  )

  const result = await callable({ organizationId })
  return result.data
}

/**
 * Service object for dependency injection and testing
 */
export const peerMatchingService = {
  triggerPeerMatching,
}

export default peerMatchingService
