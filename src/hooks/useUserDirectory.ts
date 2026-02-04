import { useEffect, useMemo, useState } from 'react'
import { fetchUserProfileById } from '@/services/userProfileService'
import { getDisplayName, type DisplayNameInput } from '@/utils/displayName'

export type UserDirectoryEntry = {
  name: string
  email?: string | null
}

const buildDisplayNameInput = (profile: Record<string, unknown> | null | undefined): DisplayNameInput => {
  if (!profile) return {}
  return {
    displayName: typeof profile.displayName === 'string' ? profile.displayName : undefined,
    fullName: typeof profile.fullName === 'string' ? profile.fullName : undefined,
    full_name: typeof profile.full_name === 'string' ? profile.full_name : undefined,
    name: typeof profile.name === 'string' ? profile.name : undefined,
    firstName: typeof profile.firstName === 'string' ? profile.firstName : undefined,
    lastName: typeof profile.lastName === 'string' ? profile.lastName : undefined,
    email: typeof profile.email === 'string' ? profile.email : undefined,
  }
}

export const useUserDirectory = (userIds: Array<string | null | undefined>) => {
  const normalizedIds = useMemo(() => {
    const unique = new Set<string>()
    userIds.forEach((id) => {
      const trimmed = typeof id === 'string' ? id.trim() : ''
      if (trimmed) unique.add(trimmed)
    })
    return Array.from(unique)
  }, [userIds])

  const [directory, setDirectory] = useState<Map<string, UserDirectoryEntry>>(() => new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const missing = normalizedIds.filter((id) => !directory.has(id))
    if (!missing.length) return

    const fetchMissing = async () => {
      setLoading(true)
      try {
        const results = await Promise.all(
          missing.map(async (userId) => {
            try {
              const profile = await fetchUserProfileById(userId)
              const displayInput = buildDisplayNameInput(profile as unknown as Record<string, unknown>)
              const name = getDisplayName(displayInput, 'Unknown user')
              const email = profile?.email ?? null
              return [userId, { name, email }] as const
            } catch {
              return [userId, { name: 'Unknown user', email: null }] as const
            }
          }),
        )

        if (cancelled) return
        setDirectory((prev) => {
          const next = new Map(prev)
          results.forEach(([id, entry]) => next.set(id, entry))
          return next
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchMissing()

    return () => {
      cancelled = true
    }
  }, [directory, normalizedIds])

  return { directory, loading }
}
