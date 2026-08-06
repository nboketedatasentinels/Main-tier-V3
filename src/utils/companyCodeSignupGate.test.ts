import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_COMPANY_CODE_UX_MESSAGES,
  getCompanyCodeSignupBlocker,
} from '@/utils/companyCodeSignupGate'

describe('getCompanyCodeSignupBlocker', () => {
  it('requires a code', () => {
    expect(
      getCompanyCodeSignupBlocker({
        code: '',
        isChecking: false,
        isValid: null,
        error: null,
      }),
    ).toBe('Company code is required.')
  })

  it('requires six characters', () => {
    expect(
      getCompanyCodeSignupBlocker({
        code: 'ABC',
        isChecking: false,
        isValid: null,
        error: null,
      }),
    ).toBe('Company code must be 6 characters.')
  })

  it('shows a short verifying message while checking - not a deferred-verify trap', () => {
    const message = getCompanyCodeSignupBlocker({
      code: 'ORBF55',
      isChecking: true,
      isValid: null,
      error: null,
    })
    expect(message).toBe('Verifying your company code…')
    for (const forbidden of FORBIDDEN_COMPANY_CODE_UX_MESSAGES) {
      expect(message).not.toContain(forbidden)
    }
  })

  it('surfaces invalid codes with the lookup error', () => {
    expect(
      getCompanyCodeSignupBlocker({
        code: 'ORBF55',
        isChecking: false,
        isValid: false,
        error: 'Company code not found.',
      }),
    ).toBe('Company code not found.')
  })

  it('allows submit when the code is live-validated', () => {
    expect(
      getCompanyCodeSignupBlocker({
        code: 'ORBF55',
        isChecking: false,
        isValid: true,
        error: null,
      }),
    ).toBeNull()
  })

  it('never returns the historical deferred-verification blockers', () => {
    const scenarios = [
      getCompanyCodeSignupBlocker({
        code: 'ORBF55',
        isChecking: true,
        isValid: null,
        error: null,
      }),
      getCompanyCodeSignupBlocker({
        code: 'ORBF55',
        isChecking: false,
        isValid: null,
        error: null,
      }),
      getCompanyCodeSignupBlocker({
        code: 'ORBF55',
        isChecking: false,
        isValid: false,
        error: 'Company is not active.',
      }),
    ]
    for (const message of scenarios) {
      for (const forbidden of FORBIDDEN_COMPANY_CODE_UX_MESSAGES) {
        expect(message ?? '').not.toContain(forbidden)
      }
    }
  })
})

describe('signup company-code regression guard', () => {
  it('keeps forbidden deferred-verify copy out of SignUpPage', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/auth/SignUpPage.tsx'),
      'utf8',
    )
    for (const forbidden of FORBIDDEN_COMPANY_CODE_UX_MESSAGES) {
      expect(source).not.toContain(forbidden)
    }
    // Do not reintroduce the unauthenticated skip that caused the bug.
    expect(source).not.toMatch(/auth\.currentUser/)
    expect(source).not.toMatch(/verified after sign-?up/i)
  })

  it('keeps validateCompanyCode on the public lookup RPC (works before login)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/organizationService.ts'),
      'utf8',
    )
    expect(source).toContain("lookup_organization_code")
    expect(source).toMatch(/rpc\(\s*['"]lookup_organization_code['"]/)
  })
})
