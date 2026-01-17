import { useMemo, useState } from 'react'
import { PartnerUser } from '@/hooks/usePartnerDashboardData'

export type SortKey = 'name' | 'company' | 'progress' | 'week' | 'status' | 'lastActive' | 'risk'

interface UsePartnerUserSortingReturn {
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  toggleSort: (key: SortKey) => void
  sortedUsers: PartnerUser[]
}

const getSortableValue = (user: PartnerUser, key: SortKey) => {
  switch (key) {
    case 'name':
      return user.name || ''
    case 'company':
      return user.companyCode || ''
    case 'progress':
      return user.progressPercent ?? 0
    case 'week':
      return user.currentWeek ?? 0
    case 'status':
      return user.status || ''
    case 'lastActive': {
      if (!user.lastActive) return -Infinity
      const lastActiveTime = new Date(user.lastActive).getTime()
      return Number.isNaN(lastActiveTime) ? -Infinity : lastActiveTime
    }
    case 'risk':
      return user.riskStatus || ''
    default:
      return ''
  }
}

export const usePartnerUserSorting = (users: PartnerUser[]): UsePartnerUserSortingReturn => {
  const [sortKey, setSortKey] = useState<SortKey>('lastActive')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aVal = getSortableValue(a, sortKey)
      const bVal = getSortableValue(b, sortKey)

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [users, sortDir, sortKey])

  return { sortKey, sortDir, toggleSort, sortedUsers }
}
