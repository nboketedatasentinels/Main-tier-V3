import {
  fetchOrganizationsList,
  listenToUsers,
  ManagedUserRecord,
} from '@/services/userManagementService'
import { toAdminDataError } from './adminErrors'

export const listenToAdminUsers = ({
  onData,
  onError,
  onStatusChange,
}: {
  onData: (users: ManagedUserRecord[]) => void
  onError?: (error: unknown) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'error' | 'retrying', detail?: Record<string, unknown>) => void
}) => {
  return listenToUsers({ onData, onError, onStatusChange })
}

export const fetchAdminOrganizationsList = async () => {
  try {
    return await fetchOrganizationsList()
  } catch (error) {
    throw toAdminDataError(error, 'Unable to load organizations.')
  }
}
