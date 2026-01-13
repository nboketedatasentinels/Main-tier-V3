import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { InfoIcon } from '@chakra-ui/icons'
import { ChevronDown, ChevronUp, Eye } from 'lucide-react'
import {
  BulkInvitationResult,
  CourseOption,
  OrganizationRecord,
  ProgramDurationOption,
} from '@/types/admin'
import {
  createOrganizationWithInvitations,
  fetchAvailableCourses,
  generateOrganizationCode,
  validateOrganizationCodeUnique,
} from '@/services/organizationService'
import { InvitationResultsModal } from './InvitationResultsModal'
import {
  MonthlyCourseAssignments,
  buildMonthlyAssignmentsFromArray,
  buildMonthlyAssignmentsSummary,
  formatMonthRange,
  getAssignedCourseIdsFromMonthlyAssignments,
  getMonthAvailabilityStatus,
  getMonthDateRange,
} from '@/utils/monthlyCourseAssignments'

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (organization: OrganizationRecord) => void
  adminName?: string
  adminId?: string
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
  courseAssignments: [],
  programDuration: undefined,
  monthlyCourseAssignments: {},
  courseAssignmentStructure: 'monthly',
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  adminId,
  adminName,
}) => {
  const toast = useToast()
  const [form, setForm] = useState<OrganizationRecord>(emptyOrganization)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [results, setResults] = useState<BulkInvitationResult | null>(null)
  const [monthlyAssignments, setMonthlyAssignments] = useState<MonthlyCourseAssignments>({})
  const resultsModal = useDisclosure()

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

  useEffect(() => {
    if (form.name && !form.code) {
      setForm((prev) => ({ ...prev, code: generateOrganizationCode(form.name) }))
    }
  }, [form.name, form.code])

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyOrganization)
      setCourses([])
      setResults(null)
      setMonthlyAssignments({})
      return
    }

    const fetchData = async () => {
      try {
        const [courseOptions] = await Promise.all([fetchAvailableCourses()])
        setCourses(courseOptions)
      } catch (error) {
        console.error(error)
        toast({ title: 'Unable to load form data', status: 'error' })
      }
    }

    fetchData()
  }, [isOpen, toast])

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

  const updateField = (key: keyof OrganizationRecord, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
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
    try {
      if (!form.name || form.name.length < 3) throw new Error('Organization name must be at least 3 characters')
      if (!form.code) throw new Error('Organization code is required')
      if (!isCodeValidLength) throw new Error('Organization code must be exactly 6 characters')
      const isUnique = await validateOrganizationCodeUnique(form.code)
      if (!isUnique) throw new Error('Organization code is already in use')
      if (!form.programDuration) throw new Error('Program duration is required')
      if (courseLimit && emptyMonths.length) {
        throw new Error(`Please assign a course for each of the ${courseLimit} month(s)`)
      }

      setIsSubmitting(true)
      const assignmentArray = getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, courseLimit)
      const organizationPayload: OrganizationRecord = {
        ...form,
        code: form.code.toUpperCase(),
        courseAssignments: assignmentArray,
        monthlyCourseAssignments: monthlyAssignments,
        courseAssignmentStructure: 'monthly',
        cohortStartDate: form.cohortStartDate,
        programDuration: form.programDuration,
      }

      const { organizationId, invitationResult } = await createOrganizationWithInvitations(
        organizationPayload,
        [],
        { adminId, adminName },
      )

      const organizationWithId = { ...organizationPayload, id: organizationId }
      if (onCreated) {
        await onCreated(organizationWithId)
      }
      if (invitationResult) {
        setResults(invitationResult)
        resultsModal.onOpen()
      }
      toast({ title: 'Organization created successfully', status: 'success' })
      onClose()
    } catch (error) {
      toast({
        title: 'Unable to create organization',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create organization</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={8}>
              <Box>
                <Text fontWeight="bold">Organization details</Text>
                <Text color="gray.600" fontSize="sm">
                  Configure the organization profile and program duration details.
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
                  <FormControl isRequired>
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
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleSubmit} isLoading={isSubmitting}>
              Create organization
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <InvitationResultsModal isOpen={resultsModal.isOpen} onClose={resultsModal.onClose} result={results} />
    </>
  )
}
