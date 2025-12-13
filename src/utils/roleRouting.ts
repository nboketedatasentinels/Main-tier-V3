export const normalizeRole = (role: unknown): string => {
  return String(role ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

export const getLandingPathForRole = (_role: unknown) => '/app/weekly-glance'
