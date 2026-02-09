export type DisplayNameInput = {
  fullName?: string | null
  full_name?: string | null
  name?: string | null
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  uid?: string | null
}

const normalize = (value?: string | null) => {
  if (!value || typeof value !== 'string') return ''
  return value.trim()
}

/**
 * Resolves a human-readable display name with graceful fallback chain.
 * Priority: fullName → displayName → firstName+lastName → email prefix → truncated UID
 */
export const getDisplayName = (
  profile?: DisplayNameInput | null,
  fallback: string = 'Member',
): string => {
  if (!profile) return fallback

  // 1. Full name variants from profile docs (preferred for app-managed names)
  const fullName = normalize(profile.fullName)
  if (fullName && fullName.toLowerCase() !== 'unknown') return fullName

  const legacyFullName = normalize(profile.full_name)
  if (legacyFullName && legacyFullName.toLowerCase() !== 'unknown') return legacyFullName

  const name = normalize(profile.name)
  if (name && name.toLowerCase() !== 'unknown') return name

  // 2. Explicit provider display name (for providers like Google)
  const displayName = normalize(profile.displayName)
  if (displayName && displayName.toLowerCase() !== 'unknown') return displayName

  // 3. Constructed from first/last
  const combined = normalize(`${profile.firstName ?? ''} ${profile.lastName ?? ''}`)
  if (combined) return combined

  // 4. Email prefix (before @)
  const email = normalize(profile.email)
  if (email) {
    const prefix = email.split('@')[0]
    // Capitalize first letter, handle dots/underscores
    return prefix
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  // 5. Truncated UID as last resort
  const uid = normalize(profile.uid)
  if (uid) return `User-${uid.slice(-6).toUpperCase()}`

  return fallback
}

/**
 * Returns initials for avatar fallback
 */
export const getInitials = (name: string): string => {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

