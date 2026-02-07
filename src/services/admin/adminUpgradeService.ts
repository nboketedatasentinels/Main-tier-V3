import {
  getAllUpgradeRequests,
  getPendingUpgradeRequests,
  getUserRequestsForAdmin,
  updateUpgradeRequestStatus,
} from '@/services/upgradeRequestService'
import { toAdminDataError } from './adminErrors'
import { UpgradeRequest, UpgradeRequestStatus } from '@/types/upgrade'

export const fetchAdminUpgradeRequests = async (): Promise<UpgradeRequest[]> => {
  try {
    return await getAllUpgradeRequests()
  } catch (error) {
    throw toAdminDataError(error, 'Failed to load upgrade requests.')
  }
}

export const fetchAdminPendingUpgradeRequests = async (): Promise<UpgradeRequest[]> => {
  try {
    return await getPendingUpgradeRequests()
  } catch (error) {
    throw toAdminDataError(error, 'Failed to load pending upgrade requests.')
  }
}

export const fetchAdminUserRequests = async (userId: string) => {
  try {
    return await getUserRequestsForAdmin(userId)
  } catch (error) {
    throw toAdminDataError(error, 'Failed to load user upgrade requests.')
  }
}

export const updateAdminUpgradeRequestStatus = async (
  requestId: string,
  status: UpgradeRequestStatus,
  notes?: string,
  reviewedBy?: string,
) => {
  try {
    return await updateUpgradeRequestStatus(requestId, status, notes, reviewedBy)
  } catch (error) {
    throw toAdminDataError(error, 'Failed to update upgrade request.')
  }
}
