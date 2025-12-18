export const isBootstrapAdmin = (email: string | null): boolean => {
  if (!email) {
    return false
  }

  const adminEmails = (import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAILS || '')
    .split(',')
    .map((emailEntry: string) => emailEntry.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length === 0) {
    return false
  }

  return adminEmails.includes(email.toLowerCase())
}
