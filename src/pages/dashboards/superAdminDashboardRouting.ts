export const DASHBOARD_TABS = new Set([
  'overview',
  'organizations',
  'users',
  'approvals',
  'admin-oversight',
  'reports',
])

export const resolveDashboardTabFromSearch = (search: string): string => {
  const params = new URLSearchParams(search)
  const requestedTab = params.get('tab')
  return requestedTab && DASHBOARD_TABS.has(requestedTab) ? requestedTab : 'overview'
}

export const buildDashboardSearchForNavigation = (search: string, nextPage: string): string => {
  const params = new URLSearchParams(search)
  if (nextPage === 'overview') {
    params.delete('tab')
  } else {
    params.set('tab', nextPage)
  }
  params.delete('create')
  const nextSearch = params.toString()
  return nextSearch ? `?${nextSearch}` : ''
}

export const consumeCreateIntentFromSearch = (search: string): string => {
  const params = new URLSearchParams(search)
  params.delete('create')
  const nextSearch = params.toString()
  return nextSearch ? `?${nextSearch}` : ''
}

