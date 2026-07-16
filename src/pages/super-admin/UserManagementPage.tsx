import { useEffect, useState } from 'react'
import { SimpleGrid, Stack } from '@chakra-ui/react'
import { ShieldCheck } from 'lucide-react'
import { UserManagementWithTabs } from '@/components/admin/UserManagementWithTabs'
import { MetricCard } from '@/components/admin/MetricCard'
import { fetchRoleBreakdownCounts } from '@/services/supabaseSuperAdminService'

type RoleCounts = {
  free: number
  paid: number
  partners: number
  mentors: number
  ambassadors: number
}

export const UserManagementPage = () => {
  const [counts, setCounts] = useState<RoleCounts>({
    free: 0,
    paid: 0,
    partners: 0,
    mentors: 0,
    ambassadors: 0,
  })

  useEffect(() => {
    let cancelled = false
    fetchRoleBreakdownCounts()
      .then((result) => {
        if (!cancelled) setCounts(result)
      })
      .catch((error) => console.error('Failed to load role counts', error))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Stack spacing={6}>
      <SimpleGrid columns={[1, 2, 3, 5]} spacing={4}>
        <MetricCard label="Free Users" value={counts.free} icon={ShieldCheck} helper="Learners on the free tier." />
        <MetricCard label="Paid Users" value={counts.paid} icon={ShieldCheck} helper="Learners on a paid membership." />
        <MetricCard label="Partners" value={counts.partners} icon={ShieldCheck} helper="Organization-scoped access." />
        <MetricCard label="Mentors" value={counts.mentors} icon={ShieldCheck} helper="Mentor role access." />
        <MetricCard label="Ambassadors" value={counts.ambassadors} icon={ShieldCheck} helper="Ambassador role access." />
      </SimpleGrid>
      <UserManagementWithTabs />
    </Stack>
  )
}
