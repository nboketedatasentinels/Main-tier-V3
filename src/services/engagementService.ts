import { httpsCallable } from 'firebase/functions'
import { functions } from '@/services/firebase'

export interface EngagementActionParams {
  userId: string
  actionLabel: string
  actorId: string | null
  actorName: string | null
  additionalData?: Record<string, any>
}

/**
 * Records an engagement action for a user via a secure Cloud Function.
 */
export const recordEngagementAction = async (params: EngagementActionParams) => {
  const recordAction = httpsCallable<EngagementActionParams, { success: boolean }>(
    functions,
    'recordEngagementAction'
  )
  return recordAction(params)
}

/**
 * Applies a bulk engagement action to multiple users via a secure Cloud Function.
 */
export const bulkRecordEngagementActions = async (
  userIds: string[],
  actionLabel: string,
  actorId: string | null,
  actorName: string | null
) => {
  const bulkAction = httpsCallable<
    { userIds: string[]; actionLabel: string; actorId: string | null; actorName: string | null },
    { success: boolean; results: any[] }
  >(functions, 'bulkRecordEngagementActions')

  return bulkAction({ userIds, actionLabel, actorId, actorName })
}
