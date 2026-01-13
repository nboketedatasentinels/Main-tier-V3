import React, { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Box,
  Badge,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { InfoIcon } from '@chakra-ui/icons'
import { ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { CourseOption, OrganizationRecord, ProgramDurationOption } from '@/types/admin'
import {
  determineClusterFromTeamSize,
  fetchAvailableCourses,
  fetchOrganizationAssignments,
  fetchOrganizationDetails,
} from '@/services/organizationService'
import { updateOrganization } from '@/services/superAdminService'
import {
  MonthlyCourseAssignments,
  buildMonthlyAssignmentsFromArray,
  buildMonthlyAssignmentsSummary,
  formatMonthRange,
  getAssignedCourseIdsFromMonthlyAssignments,
  getMonthAvailabilityStatus,
  getMonthDateRange,
  resolveProgramMonthCount,
} from '@/utils/monthlyCourseAssignments'
import {
  clusterBoundaries,
  clusterTiers,
  getClusterDisplayName,
  getClusterShortName,
  getClusterTierByName,
} from '@/utils/clusterTiers'

interface EditOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  organization?: OrganizationRecord | null
  onUpdated?: (organization: OrganizationRecord) => void
}

const programDurations: ProgramDurationOption[] = [
  { value: 1.5, label: '1.5 months (6 weeks)', courseCount: 3 },
  { value: 3, label: '3 months', courseCount: 3 },
  { value: 6, label: '6 months', courseCount: 6 },
  { value: 9, label: '9 months', courseCount: 9 },
  { value: 12, label: '12 months', courseCount: 12 },
]

const emptyOrganization: OrganizationRecord = {
  name: '',
  code: '',
  status: 'pending',
  teamSize: 0,
  village: '',
  cluster: '',
  description: '',
  courseAssignments: [],
  programDuration: undefined,
  monthlyCourseAssignments: {},
  courseAssignmentStructure: 'monthly',
}

export const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
  isOpen,
  onClose,
  organization,
  onUpdated,
}) => {
  const toast = useToast()
  const [form, setForm] = useState<OrganizationRecord>(emptyOrganization)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [monthlyAssignments, setMonthlyAssignments] = useState<MonthlyCourseAssignments>({})

  const courseLimit = useMemo(() => {
    const option = programDurations.find((duration) => duration.value === form.programDuration)
    return option?.courseCount ?? 0
  }, [form.programDuration])

  const remainingCourses = courseLimit - getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, courseLimit).length
  const codeLength = form.code.trim().length
  const isCodeValidLength = codeLength === 6
  const cohortStartDate = useMemo(
    () => (form.cohortStartDate ? new Date(String(form.cohortStartDate)) : null),
    [form.cohortStartDate],
  )
  const monthlySummary = useMemo(
    () =>
      buildMonthlyAssignmentsSummary({
        monthlyAssignments,
        totalMonths: courseLimit,
        courseTitleLookup: (courseId) =>
          courses.find((course) => course.id === courseId)?.title || courseId,
      }),
    [monthlyAssignments, courseLimit, courses],
  )
  const duplicateCourses = useMemo(() => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    Object.values(monthlyAssignments).forEach((courseId) => {
      if (!courseId) return
      if (seen.has(courseId)) {
        duplicates.add(courseId)
      } else {
        seen.add(courseId)
      }
    })
    return Array.from(duplicates)
  }, [monthlyAssignments])
  const emptyMonths = useMemo(
    () =>
      Array.from({ length: courseLimit }, (_, index) => ({
        month: index + 1,
        courseId: monthlyAssignments[String(index + 1)] || '',
      })).filter((entry) => !entry.courseId),
    [monthlyAssignments, courseLimit],
  )

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.title.localeCompare(b.title)),
    [courses],
  )
  const clusterDisplayName = useMemo(() => getClusterDisplayName(form.cluster), [form.cluster])
  const clusterShortName = useMemo(() => getClusterShortName(form.cluster), [form.cluster])
  const clusterTier = useMemo(() => getClusterTierByName(form.cluster), [form.cluster])
  const clusterHelperColor = clusterTier.colorScheme === 'gray' ? 'gray.600' : `${clusterTier.colorScheme}.600`
  const hasValidTeamSize = (form.teamSize || 0) > 0
  const isClusterAssigned = (form.teamSize || 0) >= 4 && Boolean(form.cluster)
  const nextBoundary = clusterBoundaries.find((boundary) => boundary > (form.teamSize || 0))
  const transitionHint = hasValidTeamSize && nextBoundary ? `${nextBoundary - 1}→${nextBoundary}` : null
  const isClusterBoundary = clusterBoundaries.includes(form.teamSize || 0) && hasValidTeamSize
  const boundaryTier = clusterTiers.find((tier) => tier.min === form.teamSize)
  const nextBoundaryTier = boundaryTier
    ? clusterTiers[clusterTiers.findIndex((tier) => tier.name === boundaryTier.name) + 1]
    : undefined
  const clusterProgressMax = 50
  const clusterProgressValue = Math.min(form.teamSize || 0, clusterProgressMax)
  const clusterProgressPercent = (clusterProgressValue / clusterProgressMax) * 100
  const clusterHighlightBg = `${clusterTier.colorScheme}.50`
  const clusterTooltipContent = (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        Cluster breakdown
      </Text>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Cluster</Th>
            <Th>Range</Th>
            <Th>Badge</Th>
          </Tr>
        </Thead>
        <Tbody>
          {clusterTiers.map((tier) => (
            <Tr key={tier.name}>
              <Td>{tier.shortName}</Td>
              <Td>{tier.rangeLabel} users</Td>
              <Td>
                <Badge colorScheme={tier.colorScheme} variant="subtle">
                  {tier.shortName}
                </Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <Text fontSize="xs" color="gray.600" mt={2}>
        No Cluster (1-3), Kalahari (4-10), Sahara (11-20), Sahel (21-40), Serengeti (41+).
      </Text>
    </Box>
  )
  const clusterHelperText = isClusterAssigned
    ? `Assigned to ${clusterShortName} based on cohort size.`
    : 'No cluster assigned (1-3 users).'
  const boundaryAlertText = nextBoundaryTier
    ? `Cluster tier: ${clusterShortName}. Adding 1 more user keeps you in ${clusterShortName}; ${nextBoundaryTier.shortName} begins at ${nextBoundaryTier.min} users.`
    : `Cluster tier: ${clusterShortName}. You're in the highest tier.`

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyOrganization)
      setCourses([])
      setMonthlyAssignments({})
      return
    }

    if (organization) {
      setForm({ ...emptyOrganization, ...organization })
    }

    const fetchData = async () => {
      if (!organization?.id) return
      setIsLoading(true)
      try {
        const [courseOptions, organizationDetails, assignments] = await Promise.all([
          fetchAvailableCourses(),
          fetchOrganizationDetails(organization.id),
          fetchOrganizationAssignments(organization.id),
        ])

        setCourses(courseOptions)

        if (organizationDetails) {
          const totalMonths = resolveProgramMonthCount(organizationDetails.programDuration ?? null)
          setForm({
            ...emptyOrganization,
            ...organizationDetails,
            courseAssignments: assignments.length
              ? assignments
              : organizationDetails.courseAssignments || [],
          })
          setMonthlyAssignments(() => {
            if (organizationDetails.monthlyCourseAssignments) {
              return organizationDetails.monthlyCourseAssignments
            }
            return buildMonthlyAssignmentsFromArray(
              assignments.length ? assignments : organizationDetails.courseAssignments || [],
              totalMonths || assignments.length,
            )
          })
        }
      } catch (error) {
        console.error(error)
        toast({ title: 'Unable to load organization data', status: 'error' })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [isOpen, organization, toast])

  useEffect(() => {
    if (!isOpen) return
    if ((form.teamSize ?? 0) > 0 && !form.cluster) {
      setForm((prev) => ({ ...prev, cluster: determineClusterFromTeamSize(prev.teamSize) }))
    }
  }, [form.cluster, form.teamSize, isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!courseLimit) {
      setMonthlyAssignments({})
      return
    }
    setMonthlyAssignments((prev) => {
      const seed = Object.keys(prev).length
        ? prev
        : buildMonthlyAssignmentsFromArray(form.courseAssignments || [], courseLimit)
      const next: MonthlyCourseAssignments = {}
      for (let index = 0; index < courseLimit; index += 1) {
        const key = String(index + 1)
        next[key] = seed[key] || ''
      }
      return next
    })
  }, [courseLimit, form.courseAssignments, isOpen])

  if (!organization) return null

  const updateField = (key: keyof OrganizationRecord, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleTeamSizeChange = (value: string) => {
    const parsed = Number(value)
    const cluster = determineClusterFromTeamSize(parsed)
    setForm((prev) => ({ ...prev, teamSize: parsed, cluster }))
  }

  const handleMonthlyAssignmentChange = (monthKey: string, courseId: string) => {
    setMonthlyAssignments((prev) => ({
      ...prev,
      [monthKey]: courseId,
    }))
  }

  const swapMonthlyAssignments = (fromIndex: number, toIndex: number) => {
    setMonthlyAssignments((prev) => {
      const next = { ...prev }
      const fromKey = String(fromIndex + 1)
      const toKey = String(toIndex + 1)
      const temp = next[fromKey] || ''
      next[fromKey] = next[toKey] || ''
      next[toKey] = temp
      return next
    })
  }

  const handleSubmit = async () => {
    if (!organization.id) return

    try {
      if (!form.name || form.name.length < 3) throw new Error('Organization name must be at least 3 characters')
      if (!form.code) throw new Error('Organization code is required')
      if (!isCodeValidLength) throw new Error('Organization code must be exactly 6 characters')
      if (!form.programDuration) throw new Error('Program duration is required')
      if (!form.teamSize || form.teamSize <= 0) {
        throw new Error('Cohort size must be greater than 0 to assign a cluster')
      }
      if (courseLimit && emptyMonths.length) {
        throw new Error(`Please assign a course for each of the ${courseLimit} month(s)`)
      }

      setIsSubmitting(true)
      const assignmentArray = getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, courseLimit)
      const { id: _id, ...payload } = form
      await updateOrganization(organization.id, {
        ...payload,
        code: form.code.toUpperCase(),
        courseAssignments: assignmentArray,
        monthlyCourseAssignments: monthlyAssignments,
        courseAssignmentStructure: 'monthly',
      })
      toast({
        title: 'Organization updated successfully',
        description: `Cluster: ${clusterDisplayName}`,
        status: 'success',
      })
      onUpdated?.({ ...form, id: organization.id })
      onClose()
    } catch (error) {
      toast({
        title: 'Unable to update organization',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit organization</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isLoading ? (
            <Flex justify="center" align="center" py={12} direction="column" gap={3}>
              <Spinner size="lg" />
              <Text color="gray.600">Loading organization data...</Text>
            </Flex>
          ) : (
            <Stack spacing={8}>
              <Box>
                <Text fontWeight="bold">ORGANIZATION DETAILS</Text>
                <Text color="gray.600" fontSize="sm">
                  Update organization details and program configuration.
                </Text>
              </Box>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                <GridItem>
                  <FormControl isRequired>
                    <FormLabel>Organization name</FormLabel>
                    <Input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl isRequired isInvalid={codeLength > 0 && !isCodeValidLength}>
                    <FormLabel display="flex" alignItems="center" gap={2}>
                      Organization code
                      <Tooltip label="6-character code: 2-letter prefix + 4 random characters." placement="top">
                        <InfoIcon color="gray.400" />
                      </Tooltip>
                    </FormLabel>
                    <InputGroup>
                      <InputLeftAddon>Code</InputLeftAddon>
                      <Input
                        value={form.code}
                        onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                        maxLength={6}
                        placeholder="6-char code"
                        textTransform="uppercase"
                      />
                    </InputGroup>
                    <FormHelperText color={isCodeValidLength ? 'green.500' : 'gray.600'}>
                      {codeLength}/6 characters
                    </FormHelperText>
                    <FormErrorMessage>Organization code must be exactly 6 characters.</FormErrorMessage>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Village</FormLabel>
                    <Input value={form.village} onChange={(e) => updateField('village', e.target.value)} />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl isRequired>
                    <FormLabel>Cohort size</FormLabel>
                    <Input
                      type="number"
                      value={form.teamSize || ''}
                      onChange={(e) => handleTeamSizeChange(e.target.value)}
                      min={1}
                    />
                    <FormHelperText color={hasValidTeamSize ? clusterHelperColor : 'gray.500'}>
                      {hasValidTeamSize
                        ? `Cohort size determines cluster tier: ${clusterDisplayName}.`
                        : 'Enter a cohort size to preview the cluster tier.'}
                    </FormHelperText>
                    {transitionHint ? (
                      <FormHelperText color="gray.500">Next tier transition: {transitionHint} users</FormHelperText>
                    ) : null}
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel display="flex" alignItems="center" gap={2}>
                      Cluster
                      <Tooltip label={clusterTooltipContent} placement="top" maxW="360px">
                        <InfoIcon color="gray.400" />
                      </Tooltip>
                    </FormLabel>
                    <InputGroup>
                      <Input
                        value={clusterDisplayName}
                        isReadOnly
                        placeholder="Auto-calculated from cohort size"
                      />
                      {isClusterAssigned ? (
                        <InputRightElement width="auto" mr={2}>
                          <Badge colorScheme={clusterTier.colorScheme} variant="subtle">
                            {clusterShortName}
                          </Badge>
                        </InputRightElement>
                      ) : null}
                    </InputGroup>
                    <FormHelperText color={isClusterAssigned ? clusterHelperColor : 'gray.600'}>
                      {clusterHelperText}
                    </FormHelperText>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl
                    isRequired
                    isInvalid={courseLimit > 0 && (form.courseAssignments?.length || 0) !== courseLimit}
                  >
                    <FormLabel>Program duration</FormLabel>
                    <Select
                      placeholder="Select duration"
                      value={form.programDuration?.toString() || ''}
                      onChange={(e) => updateField('programDuration', Number(e.target.value))}
                    >
                      {programDurations.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <FormErrorMessage>
                      {courseLimit > 0
                        ? `Assign ${courseLimit} course${courseLimit > 1 ? 's' : ''}`
                        : 'Select a duration to enable course assignments'}
                    </FormErrorMessage>
                  </FormControl>
                </GridItem>
                {isClusterBoundary ? (
                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      {boundaryAlertText}
                    </Alert>
                  </GridItem>
                ) : null}
                <GridItem>
                  <FormControl>
                    <FormLabel>Program start date</FormLabel>
                    <Input
                      type="date"
                      value={form.cohortStartDate ? String(form.cohortStartDate) : ''}
                      onChange={(e) => updateField('cohortStartDate', e.target.value)}
                    />
                  </FormControl>
                </GridItem>
                <GridItem colSpan={2}>
                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Textarea
                      value={(form as { description?: string }).description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                    />
                  </FormControl>
                </GridItem>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <Accordion allowToggle>
                    <AccordionItem borderWidth="1px" borderRadius="md" overflow="hidden">
                      <AccordionButton bg="gray.50">
                        <Box flex="1" textAlign="left" fontWeight="semibold">
                          Cluster tier reference guide
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel bg="gray.50">
                        <Table size="sm" variant="simple">
                          <Thead>
                            <Tr>
                              <Th>Cluster Name</Th>
                              <Th>Cohort Size Range</Th>
                              <Th>Color Badge</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {clusterTiers.map((tier) => (
                              <Tr key={tier.name} bg={tier.name === clusterDisplayName ? clusterHighlightBg : 'transparent'}>
                                <Td>
                                  {tier.shortName}
                                </Td>
                                <Td>{tier.rangeLabel} users</Td>
                                <Td>
                                  <Badge colorScheme={tier.colorScheme} variant="subtle">
                                    {tier.shortName}
                                  </Badge>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                        <Box mt={4}>
                          <Text fontSize="sm" fontWeight="semibold" mb={2}>
                            Cluster progression
                          </Text>
                          <Box position="relative" h="10px" bg="gray.200" borderRadius="full" overflow="hidden">
                            <Flex h="100%">
                              {clusterTiers.map((tier) => {
                                const rangeMax = tier.max ?? clusterProgressMax
                                const rangeStart = Math.max(tier.min, 1)
                                const cappedMax = Math.min(rangeMax, clusterProgressMax)
                                const widthPercent =
                                  ((cappedMax - rangeStart + 1) / clusterProgressMax) * 100
                                return (
                                  <Box
                                    key={tier.name}
                                    w={`${widthPercent}%`}
                                    bg={`${tier.colorScheme}.400`}
                                  />
                                )
                              })}
                            </Flex>
                            {clusterBoundaries.map((boundary) => {
                              const left = `${(boundary / clusterProgressMax) * 100}%`
                              const boundaryTierName =
                                clusterTiers.find((tier) => tier.min === boundary)?.shortName ?? 'New tier'
                              return (
                                <Tooltip
                                  key={boundary}
                                  label={`${boundary} users: ${boundaryTierName} begins`}
                                  placement="top"
                                >
                                  <Box
                                    position="absolute"
                                    top="-4px"
                                    left={left}
                                    transform="translateX(-50%)"
                                    w="2px"
                                    h="18px"
                                    bg="gray.600"
                                  />
                                </Tooltip>
                              )
                            })}
                            {hasValidTeamSize ? (
                              <Tooltip label={`${form.teamSize} users`} placement="top">
                                <Box
                                  position="absolute"
                                  top="-7px"
                                  left={`${clusterProgressPercent}%`}
                                  transform="translateX(-50%)"
                                  w="18px"
                                  h="18px"
                                  bg="white"
                                  borderWidth="2px"
                                  borderColor={`${clusterTier.colorScheme}.500`}
                                  borderRadius="full"
                                />
                              </Tooltip>
                            ) : null}
                          </Box>
                          <Grid templateColumns="repeat(5, 1fr)" mt={2} fontSize="xs" color="gray.600">
                            {clusterTiers.map((tier) => (
                              <Text key={tier.name} textAlign="center">
                                {tier.shortName}
                              </Text>
                            ))}
                          </Grid>
                          <HStack justify="space-between" mt={1} fontSize="xs" color="gray.500">
                            <Text>1-3</Text>
                            <Text>4</Text>
                            <Text>11</Text>
                            <Text>21</Text>
                            <Text>41+</Text>
                          </HStack>
                        </Box>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </GridItem>
              </Grid>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  Monthly course assignments
                </Text>
                {courseLimit === 0 ? (
                  <Text fontSize="sm" color="gray.600">
                    Select a program duration to enable course assignments.
                  </Text>
                ) : null}
                <Stack spacing={3}>
                  {Array.from({ length: courseLimit }, (_, index) => {
                    const monthNumber = index + 1
                    const monthKey = String(monthNumber)
                    const assignedCourse = monthlyAssignments[monthKey] || ''
                    const dateRange = cohortStartDate
                      ? (() => {
                          const { startDate, endDate } = getMonthDateRange(cohortStartDate, index)
                          return formatMonthRange(startDate, endDate)
                        })()
                      : undefined
                    const isEmpty = !assignedCourse
                    return (
                      <Box key={monthKey} borderWidth="1px" borderRadius="lg" p={3} bg="gray.50">
                        <Flex justify="space-between" align="center" mb={2}>
                          <HStack spacing={2}>
                            <Badge colorScheme={isEmpty ? 'red' : 'green'} borderRadius="full">
                              Month {monthNumber}
                            </Badge>
                            {dateRange && (
                              <Text fontSize="sm" color="gray.600">
                                {dateRange}
                              </Text>
                            )}
                          </HStack>
                          <HStack spacing={1}>
                            <IconButton
                              aria-label="Move course up"
                              size="sm"
                              icon={<ChevronUp size={16} />}
                              onClick={() => swapMonthlyAssignments(index, index - 1)}
                              isDisabled={index === 0}
                              variant="ghost"
                            />
                            <IconButton
                              aria-label="Move course down"
                              size="sm"
                              icon={<ChevronDown size={16} />}
                              onClick={() => swapMonthlyAssignments(index, index + 1)}
                              isDisabled={index === courseLimit - 1}
                              variant="ghost"
                            />
                          </HStack>
                        </Flex>
                        <Select
                          placeholder="Select course"
                          value={assignedCourse}
                          onChange={(e) => handleMonthlyAssignmentChange(monthKey, e.target.value)}
                          bg="white"
                        >
                          {sortedCourses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </Select>
                        {isEmpty && (
                          <Text fontSize="xs" color="red.500" mt={2}>
                            Course assignment required for this month.
                          </Text>
                        )}
                      </Box>
                    )
                  })}
                  {!courses.length && (
                    <Text fontSize="sm" color="gray.600">
                      No courses available yet.
                    </Text>
                  )}
                </Stack>
                <Text mt={2} fontSize="sm" color={remainingCourses > 0 ? 'gray.600' : 'green.500'}>
                  {courseLimit === 0
                    ? 'Select a program duration to assign courses'
                    : `${Math.max(remainingCourses, 0)} course(s) remaining to assign`}
                </Text>
                {duplicateCourses.length > 0 && (
                  <Alert status="warning" mt={3} borderRadius="md">
                    <AlertIcon />
                    Duplicate courses assigned for multiple months: {duplicateCourses.join(', ')}.
                  </Alert>
                )}
                {emptyMonths.length > 0 && courseLimit > 0 && (
                  <Alert status="error" mt={3} borderRadius="md">
                    <AlertIcon />
                    {emptyMonths.length} month(s) still need course assignments.
                  </Alert>
                )}
                {courseLimit > 0 && (
                  <Box mt={4} borderWidth="1px" borderRadius="lg" p={3} bg="white">
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="semibold">Monthly breakdown summary</Text>
                      <HStack spacing={2} color="purple.600">
                        <Eye size={16} />
                        <Text fontSize="sm">Admin preview</Text>
                      </HStack>
                    </HStack>
                    <Text fontSize="sm" color="gray.600" mb={3}>
                      Cluster assignment: {clusterDisplayName}
                    </Text>
                    <Stack spacing={2}>
                      {monthlySummary.map((entry) => (
                        <Flex key={entry.month} justify="space-between" align="center">
                          <Text fontWeight="medium">Month {entry.month}</Text>
                          <Text color={entry.courseId ? 'gray.700' : 'red.500'}>{entry.title}</Text>
                        </Flex>
                      ))}
                    </Stack>
                  </Box>
                )}
                {courseLimit > 0 && (
                  <Box mt={4} borderWidth="1px" borderRadius="lg" p={3} bg="gray.50">
                    <Text fontWeight="semibold" mb={2}>
                      Learner dashboard preview
                    </Text>
                    <Stack spacing={2}>
                      {Array.from({ length: courseLimit }, (_, index) => {
                        const monthNumber = index + 1
                        const courseId = monthlyAssignments[String(monthNumber)] || ''
                        const availability = getMonthAvailabilityStatus({
                          cohortStartDate,
                          currentDate: new Date(),
                          monthIndex: index,
                        })
                        const label =
                          availability === 'current'
                            ? 'Current month'
                            : availability === 'completed'
                              ? 'Completed'
                              : 'Locked'
                        return (
                          <Flex key={monthNumber} justify="space-between" align="center" p={2} bg="white" borderRadius="md">
                            <Text fontWeight="medium">Month {monthNumber}</Text>
                            <HStack spacing={2}>
                              <Badge colorScheme={availability === 'current' ? 'green' : availability === 'completed' ? 'purple' : 'gray'}>
                                {label}
                              </Badge>
                              <Text fontSize="sm" color="gray.600">
                                {courseId
                                  ? courses.find((course) => course.id === courseId)?.title || courseId
                                  : 'Unassigned'}
                              </Text>
                            </HStack>
                          </Flex>
                        )
                      })}
                    </Stack>
                  </Box>
                )}
              </Box>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                <GridItem>
                  <FormControl>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={form.status}
                      onChange={(e) => updateField('status', e.target.value as OrganizationRecord['status'])}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                      <option value="watch">Watch</option>
                    </Select>
                  </FormControl>
                </GridItem>
              </Grid>
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleSubmit} isLoading={isSubmitting} isDisabled={isLoading}>
            Save changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
