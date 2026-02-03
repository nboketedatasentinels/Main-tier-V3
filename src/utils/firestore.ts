export const removeUndefinedFields = <T>(value: T): T => {
  if (value === undefined) {
    return undefined as T
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  // Don't process special types - return them as-is
  // This includes: Date, Firestore Timestamp, Firestore FieldValue, etc.
  if (
    value instanceof Date ||
    value.constructor?.name === 'Timestamp' ||
    value.constructor?.name === 'FieldValue' ||
    typeof (value as any).toDate === 'function' ||
    typeof (value as any).isEqual === 'function'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedFields(item)) as T
  }

  const cleanedEntries = Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, val]) => {
    if (val === undefined) return acc
    const cleanedValue = removeUndefinedFields(val)
    if (cleanedValue !== undefined) acc[key] = cleanedValue
    return acc
  }, {})

  return cleanedEntries as T
}
