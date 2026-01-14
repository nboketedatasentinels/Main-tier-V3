import {
  getAllUpgradeRequests,
  getPendingUpgradeRequests,
  getUserRequestsForAdmin,
  updateUpgradeRequestStatus,
} from '@/services/upgradeRequestService'
import { AdminDataError, toAdminDataError } from './adminErrors'
import { UpgradeRequest, UpgradeRequestStatus } from '@/types/upgrade'

const assertAdminAccess = (isAdmin?: boolean) => {
  if (!isAdmin) {
    throw new AdminDataError('Admin access required.', 'permission-denied')
  }
}

export const fetchAdminUpgradeRequests = async (isAdmin?: boolean): Promise<UpgradeRequest[]> => {
  assertAdminAccess(isAdmin)
  try {
    return await getAllUpgradeRequests()
  } catch (error) {
    if (error instanceof AdminDataError) throw error
    throw toAdminDataError(error, 'Failed to load upgrade requests.')
  }
}

export const fetchAdminPendingUpgradeRequests = async (isAdmin?: boolean): Promise<UpgradeRequest[]> => {
  assertAdminAccess(isAdmin)
  try {
    return await getPendingUpgradeRequests()
  } catch (error) {
    if (error instanceof AdminDataError) throw error
    throw toAdminDataError(error, 'Failed to load pending upgrade requests.')
  }
}

export const fetchAdminUserRequests = async (isAdmin: boolean | undefined, userId: string) => {
  assertAdminAccess(isAdmin)
  try {
    return await getUserRequestsForAdmin(userId)
  } catch (error) {
    if (error instanceof AdminDataError) throw error
    throw toAdminDataError(error, 'Failed to load user upgrade requests.')
  }
}

export const updateAdminUpgradeRequestStatus = async (
  isAdmin: boolean | undefined,
  requestId: string,
  status: UpgradeRequestStatus,
  notes?: string,
  reviewedBy?: string,
) => {
  assertAdminAccess(isAdmin)
  try {
    return await updateUpgradeRequestStatus(requestId, status, notes, reviewedBy)
  } catch (error) {
    if (error instanceof AdminDataError) throw error
    throw toAdminDataError(error, 'Failed to update upgrade request.')
  }
}
