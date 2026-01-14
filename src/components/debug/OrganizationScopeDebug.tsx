import React from 'react'
import { Box, Heading, Stack, Text } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { getOrgScope } from '@/utils/organizationScope'

export const OrganizationScopeDebug: React.FC = () => {
  const { profile } = useAuth()
  const orgScope = getOrgScope(profile)

  return (
    <Box borderWidth="1px" borderRadius="lg" padding={4} bg="surface.default">
      <Heading size="sm" mb={3}>
        Organization Scope Debug
      </Heading>
      <Stack spacing={1}>
        <Text>companyId: {profile?.companyId || 'MISSING'}</Text>
        <Text>companyCode: {profile?.companyCode || 'MISSING'}</Text>
        <Text>organizationId: {profile?.organizationId || 'MISSING'}</Text>
        <Text>organizationCode: {profile?.organizationCode || 'MISSING'}</Text>
        <Text>Scope Valid: {orgScope.isValid ? 'YES' : 'NO'}</Text>
        <Text>Scope CompanyId: {orgScope.companyId || 'MISSING'}</Text>
        <Text>Scope CompanyCode: {orgScope.companyCode || 'MISSING'}</Text>
      </Stack>
    </Box>
  )
}
