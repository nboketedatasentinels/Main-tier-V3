import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { Organization } from '@/types'
import { db } from './firebase'

const DEBOUNCE_DELAY = 500
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingResolvers: ((value: {
  valid: boolean
  organization?: Organization
  error?: string
}) => void)[] = []
let lastCode = ''

const fetchOrganization = async (
  code: string
): Promise<{ valid: boolean; organization?: Organization; error?: string }> => {
  try {
    const orgQuery = query(
      collection(db, 'organizations'),
      where('code', '==', code),
      where('status', '==', 'active'),
      limit(1)
    )

    const snapshot = await getDocs(orgQuery)

    if (snapshot.empty) {
      return { valid: false, error: 'Invalid or inactive company code' }
    }

    const docSnap = snapshot.docs[0]
    const data = docSnap.data() as Organization

    return {
      valid: true,
      organization: {
        ...data,
        id: docSnap.id,
      },
    }
  } catch (error) {
    console.error('Error validating company code', error)
    return { valid: false, error: 'Unable to validate company code right now' }
  }
}

export const validateCompanyCode = async (
  code: string
): Promise<{ valid: boolean; organization?: Organization; error?: string }> => {
  lastCode = code

  return new Promise((resolve) => {
    pendingResolvers.push(resolve)

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(async () => {
      const result = await fetchOrganization(lastCode)
      const resolvers = [...pendingResolvers]
      pendingResolvers = []

      resolvers.forEach((fn) => fn(result))
    }, DEBOUNCE_DELAY)
  })
}
