export const removeUndefinedFields = <T>(value: T): T => {
  if (value === undefined) {
    return undefined as T
  }

  if (value === null || typeof value !== 'object') {
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
