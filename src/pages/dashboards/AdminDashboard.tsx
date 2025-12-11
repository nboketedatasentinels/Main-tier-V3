import React from 'react'
import { Box, Text } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'
import { SuperAdminDashboard } from './SuperAdminDashboard'
import { CompanyAdminDashboard } from './CompanyAdminDashboard'

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth()

  if (profile?.role === UserRole.SUPER_ADMIN) {
    return <SuperAdminDashboard />
  }

  if (profile?.role === UserRole.COMPANY_ADMIN) {
    return <CompanyAdminDashboard />
  }

  return (
    <Box>
      <Text color="brand.text">No admin dashboard available for your role.</Text>
    </Box>
  )
}

export default AdminDashboard
