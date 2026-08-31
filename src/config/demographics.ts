/**
 * Shared demographic options used by learner signup and the LIFT assessment
 * contact step so both surfaces stay in sync.
 */

export type AgeRangeOption =
  | 'under_25'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_64'
  | '65_plus'
  | 'prefer_not'

export const AGE_RANGE_OPTIONS: { value: AgeRangeOption; label: string }[] = [
  { value: 'under_25', label: 'Under 25' },
  { value: '25_34', label: '25-34' },
  { value: '35_44', label: '35-44' },
  { value: '45_54', label: '45-54' },
  { value: '55_64', label: '55-64' },
  { value: '65_plus', label: '65+' },
  { value: 'prefer_not', label: 'Prefer not to say' },
]

export const isAgeRangeOption = (value: unknown): value is AgeRangeOption =>
  typeof value === 'string' && AGE_RANGE_OPTIONS.some((option) => option.value === value)

export const ageRangeLabel = (value: string | null | undefined): string => {
  if (!value) return ''
  return AGE_RANGE_OPTIONS.find((option) => option.value === value)?.label ?? value
}
