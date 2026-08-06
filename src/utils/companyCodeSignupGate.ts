/**
 * Signup / company-code UX gate.
 *
 * REGRESSION RULE (Aug 2026): Never defer org-code verification to “after sign-up”
 * and then block submit with “please wait for the company code to be verified.”
 * Unauthenticated signup must live-validate via `lookup_organization_code`.
 * Do not restore `auth.currentUser` skips on the signup form.
 *
 * Free learners may leave the code blank. When a code is entered, it must still
 * be live-validated before submit.
 */

export type CompanyCodeGateInput = {
  code: string
  isChecking: boolean
  isValid: boolean | null
  error: string | null
  /** When false, an empty code is allowed (free-user signup). Default true. */
  required?: boolean
}

/** Copy that must never reappear in signup UX - blocks a valid invite code. */
export const FORBIDDEN_COMPANY_CODE_UX_MESSAGES = [
  'Please wait for the company code to be verified.',
  'Code will be verified after sign-up',
] as const

/**
 * Returns a user-facing blocker for the company-code field, or null when OK to submit.
 * Always assumes live validation is in progress or complete - never “verify later.”
 */
export function getCompanyCodeSignupBlocker(input: CompanyCodeGateInput): string | null {
  const code = input.code.trim()
  const required = input.required !== false

  if (!code) {
    return required ? 'Company code is required.' : null
  }
  if (code.length !== 6) return 'Company code must be 6 characters.'
  if (input.isChecking) return 'Verifying your company code…'
  if (input.isValid === false) {
    return input.error?.trim() || 'Company code is invalid or inactive.'
  }
  if (input.isValid !== true) {
    return 'Enter your 6-character company code to continue.'
  }
  return null
}
