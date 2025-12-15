import React from 'react'
import { Box, Text } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { SuperAdminDashboard } from './SuperAdminDashboard'
import { CompanyAdminDashboard } from './CompanyAdminDashboard'

export const AdminDashboard: React.FC = () => {
  const { isAdmin, isSuperAdmin } = useAuth()

  // isSuperAdmin is a specific flag, check it first
  if (isSuperAdmin) {
    return <SuperAdminDashboard />
  }

  // isAdmin is a general flag for any admin type
  if (isAdmin) {
    return <CompanyAdminDashboard />
  }

  return (
    <Box p={8} textAlign="center">
      <Text fontSize="xl" fontWeight="bold">
        No admin dashboard available for your role.
      </Text>
      <Text mt={2}>Please contact support if you believe this is an error.</Text>
    </Box>
  )
}

export default AdminDashboard
