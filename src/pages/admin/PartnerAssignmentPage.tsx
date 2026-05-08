import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  Select,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import {
  getEligibleLearnersForActivity,
  assignActivityToLearner,
} from '@/services/partnerAssignmentService'
import { FULL_ACTIVITIES } from '@/config/pointsConfig'
import { UserProfile } from '@/types'
import PartnerLayout from '@/layouts/PartnerLayout'
import { CourseApprovalsSection } from '@/components/partner/CourseApprovalsSection'

const TAB_KEYS = ['issue', 'course-approvals'] as const
type TabKey = (typeof TAB_KEYS)[number]

const tabIndexFromKey = (key: string | null): number => {
  const idx = TAB_KEYS.indexOf((key as TabKey) ?? 'issue')
  return idx >= 0 ? idx : 0
}

export const PartnerAssignmentPage: React.FC = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { assignedOrganizationIds } = usePartnerAdminSnapshot({ enabled: true })
  const { organizations: partnerOrganizations } = usePartnerOrganizations()
  const { selectedOrg } = usePartnerSelectedOrg()
  const toast = useToast()

  const [learners, setLearners] = useState<UserProfile[]>([])
  const [selectedLearners, setSelectedLearners] = useState<string[]>([])
  const [selectedActivity, setSelectedActivity] = useState<string>('')
  const [weekNumber, setWeekNumber] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  const tabIndex = tabIndexFromKey(searchParams.get('tab'))

  const handleTabsChange = useCallback(
    (index: number) => {
      const key = TAB_KEYS[index] ?? 'issue'
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        if (key === 'issue') next.delete('tab')
        else next.set('tab', key)
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const partnerIssuedActivities = useMemo(
    () => FULL_ACTIVITIES.filter((activity) => activity.approvalType === 'partner_issued'),
    [],
  )

  // Honor the header dropdown's selected org. When the partner picks a
  // specific company, narrow the issuance pool to just that org. When the
  // dropdown is set to "All organizations" (selectedOrg === ''), fall back
  // to every org the partner is assigned to.
  const organizationIds = useMemo(() => {
    if (selectedOrg) return [selectedOrg]
    if (assignedOrganizationIds.length) return assignedOrganizationIds
    if (profile?.organizationId) return [profile.organizationId]
    return []
  }, [selectedOrg, assignedOrganizationIds, profile?.organizationId])

  const layoutOrgs = useMemo(
    () =>
      partnerOrganizations
        .filter(o => Boolean(o.id))
        .map(o => ({ id: o.id!, code: o.code, name: o.name })),
    [partnerOrganizations],
  )

  useEffect(() => {
    const loadLearners = async () => {
      try {
        const data = await getEligibleLearnersForActivity('', organizationIds)
        setLearners(data)
      } catch (error) {
        console.error(error)
      }
    }
    if (organizationIds.length) {
      loadLearners()
    } else {
      setLearners([])
    }
  }, [organizationIds])

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 250)
    return () => clearTimeout(handler)
  }, [searchTerm])

  const handleAssign = async () => {
    if (!selectedActivity || selectedLearners.length === 0) {
      toast({
        title: 'Selection required',
        description: 'Please select an activity and at least one learner.',
        status: 'warning',
      })
      return
    }

    if (!user?.uid) {
      toast({
        title: 'Sign-in required',
        description: 'Your session is missing identity context. Please sign out and sign back in.',
        status: 'error',
      })
      return
    }

    setLoading(true)
    try {
      await Promise.all(
        selectedLearners.map(learnerId =>
          assignActivityToLearner({
            partnerId: user.uid,
            learnerId,
            activityId: selectedActivity,
            weekNumber,
          }),
        ),
      )

      toast({
        title: 'Issue successful',
        description: `Activity issued to ${selectedLearners.length} learners.`,
        status: 'success',
      })
      setSelectedLearners([])
    } catch (error) {
      console.error(error)
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something went wrong while issuing the activity.'
      toast({
        title: 'Issue failed',
        description: message,
        status: 'error',
        duration: 9000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredLearners = useMemo(() => {
    const normalized = debouncedSearchTerm.toLowerCase()
    if (!normalized) return learners
    return learners.filter(learner =>
      learner.fullName.toLowerCase().includes(normalized) ||
      learner.email.toLowerCase().includes(normalized),
    )
  }, [learners, debouncedSearchTerm])

  const toggleLearner = (id: string) => {
    setSelectedLearners(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    )
  }

  const toggleSelectAll = () => {
    if (selectedLearners.length === filteredLearners.length) {
      setSelectedLearners([])
    } else {
      setSelectedLearners(filteredLearners.map(l => l.id))
    }
  }

  const isAllSelected = filteredLearners.length > 0 && selectedLearners.length === filteredLearners.length

  const handleNavigate = useCallback(
    (key: string) => {
      if (key === 'partner-assignment') {
        // already here — keep current tab
        return
      }
      if (key === 'learner-assignments') {
        navigate('/partner/learner-assignments')
        return
      }
      if (key === 'overview') {
        navigate('/partner/dashboard')
        return
      }
      navigate(`/partner/dashboard?page=${encodeURIComponent(key)}`)
    },
    [navigate],
  )

  return (
    <PartnerLayout
      activeItem="partner-assignment"
      organizations={layoutOrgs}
      onNavigate={handleNavigate}
    >
      <Stack spacing={6}>
        <Box>
          <Heading size="lg">Partner Activity Issuing</Heading>
          <Text color="gray.500">
            Issue partner-issued activities and approve course completions for learners in your organizations.
          </Text>
        </Box>

        <Tabs
          index={tabIndex}
          onChange={handleTabsChange}
          colorScheme="purple"
          variant="enclosed"
          isLazy
          lazyBehavior="keepMounted"
        >
          <TabList>
            <Tab whiteSpace="nowrap">Issue Activities</Tab>
            <Tab whiteSpace="nowrap">
              Course Approvals
              <Badge ml={2} colorScheme="purple" fontSize="xs" variant="subtle">
                Journey courses
              </Badge>
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0} py={6}>
              <Stack spacing={6}>
                <HStack spacing={4} flexWrap="wrap">
                  <FormControl>
                    <FormLabel>Select Activity</FormLabel>
                    <Select
                      placeholder="Choose activity"
                      value={selectedActivity}
                      onChange={e => setSelectedActivity(e.target.value)}
                    >
                      {partnerIssuedActivities.length > 0 ? (
                        partnerIssuedActivities.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.title} ({a.points} pts)
                          </option>
                        ))
                      ) : (
                        <option disabled>No partner-issued activities defined</option>
                      )}
                    </Select>
                  </FormControl>

                  <FormControl maxW="200px">
                    <FormLabel>Week</FormLabel>
                    <Select
                      value={weekNumber}
                      onChange={e => setWeekNumber(parseInt(e.target.value))}
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                        <option key={week} value={week}>
                          Week {week}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </HStack>

                <FormControl>
                  <FormLabel>Search Learners</FormLabel>
                  <Input
                    placeholder="Name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </FormControl>

                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>
                          <Checkbox
                            isChecked={isAllSelected}
                            isIndeterminate={selectedLearners.length > 0 && selectedLearners.length < filteredLearners.length}
                            onChange={toggleSelectAll}
                          >
                            Select All
                          </Checkbox>
                        </Th>
                        <Th>Name</Th>
                        <Th>Email</Th>
                        <Th>Journey</Th>
                        <Th>Points</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredLearners.map(l => (
                        <Tr key={l.id}>
                          <Td>
                            <Checkbox
                              isChecked={selectedLearners.includes(l.id)}
                              onChange={() => toggleLearner(l.id)}
                            />
                          </Td>
                          <Td>{l.fullName}</Td>
                          <Td>{l.email}</Td>
                          <Td>{l.journeyType}</Td>
                          <Td>{(l.totalPoints ?? 0).toLocaleString()}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>

                <Button
                  colorScheme="purple"
                  onClick={handleAssign}
                  isLoading={loading}
                  isDisabled={selectedLearners.length === 0 || !selectedActivity || !user?.uid}
                >
                  Issue Activity to {selectedLearners.length} Learners
                </Button>
              </Stack>
            </TabPanel>

            <TabPanel px={0} py={6}>
              <CourseApprovalsSection />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Stack>
    </PartnerLayout>
  )
}

export default PartnerAssignmentPage
