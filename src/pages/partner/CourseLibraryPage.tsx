import React, { useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, AlertDescription, AlertIcon, Box, Flex, Spinner } from '@chakra-ui/react'
import { PartnerLayout } from '@/layouts/PartnerLayout'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import { OrganizationCourseLibrary } from '@/components/courses/OrganizationCourseLibrary'
import { handlePartnerSidebarNavigate } from '@/utils/partnerSidebarNavigation'

/** Partner / super admin: manage one organisation's own course library. */
export const CourseLibraryPage: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { organizations, loading: orgsLoading } = usePartnerOrganizations()
  const { selectedOrg: selectedOrgId, setSelectedOrg: setSelectedOrgId } = usePartnerSelectedOrg()

  const handleNavigate = useCallback(
    (key: string) => handlePartnerSidebarNavigate(navigate, key, 'course-library'),
    [navigate],
  )

  const orgOptions = useMemo(
    () =>
      organizations
        .filter((o) => Boolean(o.id))
        .map((o) => ({ id: o.id!, code: o.code, name: o.name })),
    [organizations],
  )

  // A library belongs to exactly one organisation - auto-pick the first.
  useEffect(() => {
    if (selectedOrgId) return
    if (orgOptions.length > 0) {
      setSelectedOrgId(orgOptions[0].id)
      return
    }
    if (profile?.companyId) setSelectedOrgId(profile.companyId)
  }, [orgOptions, profile?.companyId, selectedOrgId, setSelectedOrgId])

  const selectedOrg = orgOptions.find((o) => o.id === selectedOrgId)

  return (
    <PartnerLayout
      activeItem="course-library"
      organizations={orgOptions}
      selectedOrg={selectedOrgId || 'all'}
      onSelectOrg={(orgValue) => setSelectedOrgId(orgValue === 'all' ? '' : orgValue)}
      onNavigate={handleNavigate}
    >
      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={6}>
        {orgsLoading && !selectedOrgId ? (
          <Flex justify="center" py={16}>
            <Spinner color="purple.500" />
          </Flex>
        ) : selectedOrgId ? (
          <OrganizationCourseLibrary organizationId={selectedOrgId} organizationName={selectedOrg?.name} />
        ) : (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <AlertDescription>Select an organization to manage its course library.</AlertDescription>
          </Alert>
        )}
      </Box>
    </PartnerLayout>
  )
}

export default CourseLibraryPage
