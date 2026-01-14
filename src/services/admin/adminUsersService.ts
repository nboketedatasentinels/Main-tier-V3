import {
  fetchOrganizationsList,
  listenToUsers,
  ManagedUserRecord,
} from '@/services/userManagementService'
import { AdminDataError, toAdminDataError } from './adminErrors'

const assertAdminAccess = (isAdmin?: boolean) => {
  if (!isAdmin) {
    throw new AdminDataError('Admin access required.', 'permission-denied')
  }
}

export const listenToAdminUsers = ({
  isAdmin,
  onData,
  onError,
  onStatusChange,
}: {
  isAdmin?: boolean
  onData: (users: ManagedUserRecord[]) => void
  onError?: (error: unknown) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'error' | 'retrying', detail?: Record<string, unknown>) => void
}) => {
  try {
    assertAdminAccess(isAdmin)
  } catch (error) {
    onStatusChange?.('error', { error })
    onError?.(error)
    return () => undefined
  }

  return listenToUsers({ onData, onError, onStatusChange })
}

export const fetchAdminOrganizationsList = async (isAdmin?: boolean) => {
  assertAdminAccess(isAdmin)
  try {
    return await fetchOrganizationsList()
  } catch (error) {
    throw toAdminDataError(error, 'Unable to load organizations.')
  }
}
