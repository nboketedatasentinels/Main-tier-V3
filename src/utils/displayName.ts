export type DisplayNameInput = {
  fullName?: string | null
  full_name?: string | null
  name?: string | null
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

const normalize = (value?: string | null) => {
  if (!value || typeof value !== 'string') return ''
  return value.trim()
}

export const getDisplayName = (
  profile?: DisplayNameInput | null,
  fallback: string = 'Member',
): string => {
  if (!profile) return fallback

  const fullName = normalize(profile.fullName)
  if (fullName) return fullName

  const legacyFullName = normalize(profile.full_name)
  if (legacyFullName) return legacyFullName

  const name = normalize(profile.name)
  if (name) return name

  const displayName = normalize(profile.displayName)
  if (displayName) return displayName

  const combined = normalize(`${profile.firstName ?? ''} ${profile.lastName ?? ''}`)
  if (combined) return combined

  const email = normalize(profile.email)
  if (email) return email

  return fallback
}

