import {
  fetchEngagementHistory,
  fetchEngagementRoster,
  fetchEngagementTrendSeries,
  fetchRecentActivities,
} from '@/services/userManagementService'
import { toAdminDataError } from './adminErrors'

export type EngagementAvailability = 'ready' | 'no_activity' | 'not_enabled'

export const fetchAdminEngagementSnapshot = async () => {
  try {
    const [roster, trends] = await Promise.all([
      fetchEngagementRoster(),
      fetchEngagementTrendSeries(),
    ])

    let availability: EngagementAvailability = 'ready'
    if (!roster.length && !trends.length) {
      availability = 'not_enabled'
    } else if (!roster.length) {
      availability = 'no_activity'
    }

    return { roster, trends, availability }
  } catch (error) {
    throw toAdminDataError(error, 'Unable to load engagement data.', {
      missingCollectionMessage: 'Engagement collection not initialized.',
      indexMessage: 'Missing Firestore index for engagement queries.',
    })
  }
}

export const fetchAdminEngagementHistory = async (userId: string) => {
  try {
    return await fetchEngagementHistory(userId)
  } catch (error) {
    throw toAdminDataError(error, 'Unable to load engagement history.')
  }
}

export const fetchAdminRecentActivities = async (userId: string) => {
  try {
    return await fetchRecentActivities(userId)
  } catch (error) {
    throw toAdminDataError(error, 'Unable to load recent activity.')
  }
}
