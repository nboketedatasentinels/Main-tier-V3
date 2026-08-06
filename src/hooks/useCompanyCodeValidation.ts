import { useEffect, useState } from 'react'
import { validateCompanyCode } from '@/services/organizationService'
import type { Organization } from '@/types'

export type CompanyCodeValidationState = {
  isChecking: boolean
  isValid: boolean | null
  error: string | null
  organization: Organization | null
}

/**
 * Live-validates a 6-character company code for signup / claim flows.
 * Always calls the public lookup RPC - never defers to “after sign-up.”
 */
export function useCompanyCodeValidation(rawCode: string): CompanyCodeValidationState {
  const [isChecking, setIsChecking] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)

  useEffect(() => {
    const code = rawCode.trim().toUpperCase()

    if (!code || code.length !== 6) {
      setIsChecking(false)
      setIsValid(null)
      setError(null)
      setOrganization(null)
      return
    }

    let cancelled = false
    setIsChecking(true)
    setError(null)

    void validateCompanyCode(code)
      .then((result) => {
        if (cancelled) return
        setIsValid(result.valid)
        setError(result.error ?? null)
        setOrganization(result.valid && result.organization ? result.organization : null)
        setIsChecking(false)
      })
      .catch((validationError) => {
        if (cancelled) return
        setIsValid(false)
        setOrganization(null)
        setError(
          validationError instanceof Error
            ? validationError.message
            : 'Unable to verify company code.',
        )
        setIsChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [rawCode])

  return { isChecking, isValid, error, organization }
}
