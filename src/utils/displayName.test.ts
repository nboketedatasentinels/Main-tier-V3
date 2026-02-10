import { describe, expect, it } from 'vitest'
import { getDisplayName } from './displayName'

describe('getDisplayName', () => {
  it('prefers fullName over provider displayName', () => {
    expect(
      getDisplayName({
        fullName: 'Taylor Signup Name',
        displayName: 'Google Profile Name',
      }),
    ).toBe('Taylor Signup Name')
  })

  it('uses provider displayName when fullName is missing (google sign-in fallback)', () => {
    expect(
      getDisplayName({
        fullName: '',
        displayName: 'Google Profile Name',
      }),
    ).toBe('Google Profile Name')
  })

  it('falls back to first/last name when fullName and displayName are unavailable', () => {
    expect(
      getDisplayName({
        firstName: 'Taylor',
        lastName: 'Jordan',
      }),
    ).toBe('Taylor Jordan')
  })

  it('falls back to email prefix after name fields', () => {
    expect(
      getDisplayName({
        fullName: 'unknown',
        displayName: 'unknown',
        email: 'alex.rivera@example.com',
      }),
    ).toBe('Alex Rivera')
  })
})

