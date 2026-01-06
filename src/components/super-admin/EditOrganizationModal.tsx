import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  GridItem,
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
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import {
  CourseOption,
  OrganizationLead,
  OrganizationRecord,
  ProgramDurationOption,
} from '@/types/admin'
import {
  determineClusterFromTeamSize,
  fetchAmbassadors,
  fetchAvailableCourses,
  fetchMentors,
  fetchOrganizationAssignments,
  fetchOrganizationDetails,
  fetchPartners,
} from '@/services/organizationService'
import { updateOrganization } from '@/services/superAdminService'

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
  const [mentors, setMentors] = useState<OrganizationLead[]>([])
  const [ambassadors, setAmbassadors] = useState<OrganizationLead[]>([])
  const [partners, setPartners] = useState<OrganizationLead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const courseLimit = useMemo(() => {
    const option = programDurations.find((duration) => duration.value === form.programDuration)
    return option?.courseCount ?? 0
  }, [form.programDuration])

  const remainingCourses = courseLimit - (form.courseAssignments?.length || 0)

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyOrganization)
      setCourses([])
      setMentors([])
      setAmbassadors([])
      setPartners([])
      return
    }

    if (organization) {
      setForm({ ...emptyOrganization, ...organization })
    }

    const fetchData = async () => {
      if (!organization?.id) return
      setIsLoading(true)
      try {
        const [
          courseOptions,
          mentorOptions,
          ambassadorOptions,
          partnerOptions,
          organizationDetails,
          assignments,
        ] = await Promise.all([
          fetchAvailableCourses(),
          fetchMentors(),
          fetchAmbassadors(),
          fetchPartners(),
          fetchOrganizationDetails(organization.id),
          fetchOrganizationAssignments(organization.id),
        ])

        setCourses(courseOptions)
        setMentors(mentorOptions)
        setAmbassadors(ambassadorOptions)
        setPartners(partnerOptions)

        if (organizationDetails) {
          setForm({
            ...emptyOrganization,
            ...organizationDetails,
            courseAssignments: assignments.length
              ? assignments
              : organizationDetails.courseAssignments || [],
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

  if (!organization) return null

  const updateField = (key: keyof OrganizationRecord, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleTeamSizeChange = (value: string) => {
    const parsed = Number(value)
    const cluster = determineClusterFromTeamSize(parsed)
    setForm((prev) => ({ ...prev, teamSize: parsed, cluster }))
  }

  const handleCourseToggle = (courseId: string) => {
    setForm((prev) => {
      const assignments = prev.courseAssignments || []
      const exists = assignments.includes(courseId)
      if (!exists && courseLimit && assignments.length >= courseLimit) {
        toast({ title: 'Course limit reached for selected duration', status: 'warning' })
        return prev
      }
      const nextAssignments = exists
        ? assignments.filter((id) => id !== courseId)
        : [...assignments, courseId]
      return { ...prev, courseAssignments: nextAssignments }
    })
  }

  const handleSubmit = async () => {
    if (!organization.id) return

    try {
      if (!form.name || form.name.length < 3) throw new Error('Organization name must be at least 3 characters')
      if (!form.code) throw new Error('Organization code is required')
      if (!form.programDuration) throw new Error('Program duration is required')
      if (!form.teamSize || form.teamSize <= 0) throw new Error('Cohort size must be greater than 0')
      if (courseLimit && (form.courseAssignments?.length || 0) !== courseLimit) {
        throw new Error(`Please assign exactly ${courseLimit} course(s) for the selected duration`)
      }

      setIsSubmitting(true)
      const { id: _id, ...payload } = form
      await updateOrganization(organization.id, {
        ...payload,
        code: form.code.toUpperCase(),
        courseAssignments: form.courseAssignments || [],
      })
      toast({ title: 'Organization updated successfully', status: 'success' })
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
                  Update organization details, program configuration, and leadership assignments.
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
                  <FormControl isRequired>
                    <FormLabel>Organization code</FormLabel>
                    <InputGroup>
                      <InputLeftAddon>Code</InputLeftAddon>
                      <Input value={form.code} isReadOnly />
                    </InputGroup>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Village</FormLabel>
                    <Input value={form.village} onChange={(e) => updateField('village', e.target.value)} />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Cluster</FormLabel>
                    <Input value={form.cluster} isReadOnly placeholder="Auto-calculated" />
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
                <GridItem>
                  <FormControl>
                    <FormLabel>Transformation partner</FormLabel>
                    <Select
                      placeholder="Select partner"
                      value={form.assignedPartnerId || ''}
                      onChange={(e) => {
                        const partner = partners.find((item) => item.id === e.target.value)
                        updateField('assignedPartnerId', e.target.value || null)
                        updateField('assignedPartnerName', partner?.name || null)
                        updateField('assignedPartnerEmail', partner?.email || null)
                      }}
                    >
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                    </Select>
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
              </Grid>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  Course assignments
                </Text>
                {courseLimit === 0 ? (
                  <Text fontSize="sm" color="gray.600">
                    Select a program duration to enable course assignments.
                  </Text>
                ) : null}
                <Stack
                  maxH="200px"
                  overflowY="auto"
                  borderWidth="1px"
                  borderRadius="md"
                  p={3}
                  spacing={2}
                >
                  {courses.map((course) => (
                    <Checkbox
                      key={course.id}
                      isChecked={form.courseAssignments?.includes(course.id)}
                      onChange={() => handleCourseToggle(course.id)}
                    >
                      {course.title}
                    </Checkbox>
                  ))}
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
              </Box>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
                <GridItem>
                  <FormControl>
                    <FormLabel>Mentor</FormLabel>
                    <Select
                      placeholder="Select mentor"
                      value={form.assignedMentorId || ''}
                      onChange={(e) => {
                        const mentor = mentors.find((m) => m.id === e.target.value)
                        updateField('assignedMentorId', mentor?.id || null)
                        updateField('assignedMentorName', mentor?.name || null)
                        updateField('assignedMentorEmail', mentor?.email || null)
                      }}
                    >
                      {mentors.map((mentor) => (
                        <option key={mentor.id} value={mentor.id}>
                          {mentor.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Ambassador</FormLabel>
                    <Select
                      placeholder="Select ambassador"
                      value={form.assignedAmbassadorId || ''}
                      onChange={(e) => {
                        const ambassador = ambassadors.find((m) => m.id === e.target.value)
                        updateField('assignedAmbassadorId', ambassador?.id || null)
                        updateField('assignedAmbassadorName', ambassador?.name || null)
                        updateField('assignedAmbassadorEmail', ambassador?.email || null)
                      }}
                    >
                      {ambassadors.map((ambassador) => (
                        <option key={ambassador.id} value={ambassador.id}>
                          {ambassador.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </GridItem>
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
