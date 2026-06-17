import {
  listenToUsers,
  ManagedUserRecord,
  type OrganizationOption,
} from '@/services/userManagementService'
import { fetchOrganizations } from '@/services/supabaseSuperAdminService'
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

export const fetchAdminOrganizationsList = async (): Promise<OrganizationOption[]> => {
  try {
    // Organizations now live in Supabase. Firestore denies under Supabase auth,
    // which is what surfaced "permission denied / admin role missing" on the
    // Users tab. Map the Supabase records to the {id,name,code} option shape
    // both consumers (Users tab filter + Upgrade Request modal) expect.
    const orgs = await fetchOrganizations()
    return orgs
      .filter((o) => Boolean(o.id))
      .map((o) => ({ id: o.id as string, name: o.name, code: o.code }))
  } catch (error) {
    throw toAdminDataError(error, 'Unable to load organizations.')
  }
}
