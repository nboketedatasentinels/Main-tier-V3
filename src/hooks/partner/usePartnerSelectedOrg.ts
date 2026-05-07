import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export const PARTNER_ORG_PARAM = 'org'
const STORAGE_KEY = 'partner.selectedOrg'

const readStorage = (): string => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

const writeStorage = (value: string) => {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sessionStorage unavailable — non-fatal */
  }
}

/**
 * Shared org selection across every /partner/* page. The chosen company
 * persists when navigating between Dashboard, Learner Assignments, Course
 * Approvals, etc., via two cooperating layers:
 *
 *  1. URL `?org=<id>` — primary source of truth. Shareable, reload-safe,
 *     visible in browser history.
 *  2. `sessionStorage` mirror — picked up when a navigate() call drops the
 *     query string. Avoids forcing every navigation in the app to carry
 *     `?org=` through manually.
 *
 * Returns:
 *  - selectedOrg: the org id (or '' when none chosen yet)
 *  - setSelectedOrg: writes the value to URL + storage ('' / 'all' clear it)
 */
export const usePartnerSelectedOrg = (): {
  selectedOrg: string
  setSelectedOrg: (value: string) => void
} => {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlValue = searchParams.get(PARTNER_ORG_PARAM) ?? ''

  // If the URL is missing ?org= but a previous selection exists in storage,
  // hydrate the URL from storage. This is what makes navigation between
  // partner pages preserve the chosen org without having to thread ?org=
  // through every navigate() call.
  useEffect(() => {
    if (urlValue) return
    const stored = readStorage()
    if (!stored) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.set(PARTNER_ORG_PARAM, stored)
        return next
      },
      { replace: true },
    )
  }, [urlValue, setSearchParams])

  const setSelectedOrg = useCallback(
    (value: string) => {
      const normalized = !value || value === 'all' ? '' : value
      writeStorage(normalized)
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (!normalized) next.delete(PARTNER_ORG_PARAM)
          else next.set(PARTNER_ORG_PARAM, normalized)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { selectedOrg: urlValue, setSelectedOrg }
}
