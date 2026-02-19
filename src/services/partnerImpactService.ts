import { httpsCallable } from 'firebase/functions'
import { functions } from '@/services/firebase'

export interface SyncPartnerImpactLogsRequest {
  forceFullRefresh?: boolean
}

export interface SyncPartnerImpactLogsResponse {
  status: 'success' | 'skipped'
  message: string
  fetchedCount: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  lastSyncedAt: string
}

export const syncPartnerImpactLogs = async (
  payload: SyncPartnerImpactLogsRequest = {},
): Promise<SyncPartnerImpactLogsResponse> => {
  const callable = httpsCallable<SyncPartnerImpactLogsRequest, SyncPartnerImpactLogsResponse>(
    functions,
    'syncPartnerImpactLogs',
  )

  const result = await callable(payload)
  return result.data
}

export const partnerImpactService = {
  syncPartnerImpactLogs,
}

export default partnerImpactService
