import React from 'react'
import type { BadgeProps } from '@chakra-ui/react'
import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import type { OrganizationMemberStats, OrganizationRecord } from '@/types/admin'
import { getProgramDurationLabel, getProgramSegmentLabel, resolveProgramCadence } from '@/utils/monthlyCourseAssignments'

type Props = {
  isOpen: boolean
  onClose: () => void
  organization?: OrganizationRecord | null
  memberStats?: OrganizationMemberStats | null
  isLoadingStats?: boolean
  onEdit?: () => void
}

const formatDateTime = (value?: OrganizationRecord['createdAt']) => {
  if (!value) return '—'
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toLocaleString()
  const asDate = value?.toDate?.()
  return asDate ? asDate.toLocaleString() : '—'
}

const formatDate = (value?: OrganizationRecord['createdAt']) => {
  if (!value) return '—'
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toLocaleDateString()
  const asDate = value?.toDate?.()
  return asDate ? asDate.toLocaleDateString() : '—'
}

const statusColors: Record<string, BadgeProps['colorScheme']> = {
  active: 'green',
  pending: 'orange',
  inactive: 'gray',
  suspended: 'red',
  watch: 'yellow',
}

const InfoItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Stack spacing={1}>
    <Text fontSize="sm" color="brand.subtleText">
      {label}
    </Text>
    <Text fontWeight="semibold" color="brand.text">
      {value}
    </Text>
  </Stack>
)

export const OrganizationDetailsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  organization,
  memberStats,
  isLoadingStats,
  onEdit,
}) => {
  if (!organization) return null

  const statusColor = statusColors[organization.status] || 'gray'
  const memberCountContent = isLoadingStats ? <Spinner size="xs" /> : memberStats?.totalMembers ?? '—'
  const activeMemberContent = isLoadingStats ? <Spinner size="xs" /> : memberStats?.activeMembers ?? '—'
  const paidMemberContent = isLoadingStats ? <Spinner size="xs" /> : memberStats?.paidMembers ?? '—'
  const courseAssignments = organization.courseAssignments || []
  const monthlyAssignments = organization.monthlyCourseAssignments || {}
  const programStartDate = organization.cohortStartDate || organization.programStart
  const programCadence = resolveProgramCadence(organization.programDuration)
  const programDurationLabel = getProgramDurationLabel(organization.programDuration) || '—'

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Organization details</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={6}>
            <Box>
              <HStack justify="space-between" align="flex-start" spacing={4}>
                <Box>
                  <Text fontSize="xl" fontWeight="bold" color="brand.text">
                    {organization.name || 'Unnamed organization'}
                  </Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Code: {organization.code || '—'}
                  </Text>
                </Box>
                <Badge colorScheme={statusColor} textTransform="capitalize">
                  {organization.status || 'unknown'}
                </Badge>
              </HStack>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Organization details
                  </Text>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <InfoItem label="Organization name" value={organization.name || '—'} />
                    <InfoItem label="Organization code" value={organization.code || '—'} />
                    <InfoItem label="Status" value={organization.status || '—'} />
                    <InfoItem label="Village" value={organization.village || '—'} />
                    <InfoItem label="Cluster" value={organization.cluster || '—'} />
                  </SimpleGrid>
                </Stack>
              </Box>

              <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Program information
                  </Text>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <InfoItem label="Cohort size" value={organization.teamSize ?? '—'} />
                    <InfoItem
                      label="Program duration"
                      value={programDurationLabel}
                    />
                    <InfoItem label="Program start" value={formatDate(programStartDate)} />
                    <InfoItem
                      label="Course assignments"
                      value={Object.keys(monthlyAssignments).length || courseAssignments.length || '—'}
                    />
                    <InfoItem
                      label="Assignment structure"
                      value={organization.courseAssignmentStructure || (Object.keys(monthlyAssignments).length ? 'monthly' : 'array')}
                    />
                  </SimpleGrid>
                  <Box>
                    <Text fontSize="sm" color="brand.subtleText" mb={2}>
                      Assigned courses
                    </Text>
                    {Object.keys(monthlyAssignments).length ? (
                      <Wrap>
                        {Object.entries(monthlyAssignments).map(([month, courseId]) => (
                          <WrapItem key={`${month}-${courseId}`}>
                            <Badge variant="subtle">
                              {getProgramSegmentLabel(Number(month), programCadence)}: {courseId || 'Unassigned'}
                            </Badge>
                          </WrapItem>
                        ))}
                      </Wrap>
                    ) : courseAssignments.length ? (
                      <Wrap>
                        {courseAssignments.map((courseId, idx) => (
                          <WrapItem key={`${courseId}-${idx}`}>
                            <Badge variant="subtle">{courseId}</Badge>
                          </WrapItem>
                        ))}
                      </Wrap>
                    ) : (
                      <Text fontSize="sm" color="brand.subtleText">
                        No course assignments yet.
                      </Text>
                    )}
                  </Box>
                </Stack>
              </Box>

              <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Leadership team
                  </Text>
                  <InfoItem label="Transformation partner" value={organization.assignedPartnerName || '—'} />
                  <InfoItem label="Partner email" value={organization.assignedPartnerEmail || '—'} />
                  <InfoItem label="Mentor" value={organization.assignedMentorName || organization.assignedMentorEmail || '—'} />
                  <InfoItem label="Mentor email" value={organization.assignedMentorEmail || '—'} />
                  <InfoItem
                    label="Ambassador"
                    value={organization.assignedAmbassadorName || organization.assignedAmbassadorEmail || '—'}
                  />
                  <InfoItem label="Ambassador email" value={organization.assignedAmbassadorEmail || '—'} />
                </Stack>
              </Box>

              <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Organization statistics
                  </Text>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <InfoItem label="Current members" value={memberCountContent} />
                    <InfoItem label="Active members" value={activeMemberContent} />
                    <InfoItem label="Paid members" value={paidMemberContent} />
                    <InfoItem label="Created on" value={formatDateTime(organization.createdAt)} />
                    <InfoItem label="Updated on" value={formatDateTime(organization.updatedAt)} />
                  </SimpleGrid>
                </Stack>
              </Box>
            </SimpleGrid>

            <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
              <Stack spacing={3}>
                <Text fontWeight="bold" color="brand.text">
                  Organization description
                </Text>
                <Text color="brand.text">{organization.description || 'No description provided yet.'}</Text>
              </Stack>
            </Box>

            <Divider />

            <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
              <Stack spacing={3}>
                <Text fontWeight="bold" color="brand.text">
                  Audit log
                </Text>
                <Text color="brand.subtleText" fontSize="sm">
                  View edit history in the admin activity log for a full record of changes and actions.
                </Text>
              </Stack>
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Close
          </Button>
          {onEdit && (
            <Button colorScheme="purple" onClick={onEdit}>
              Edit organization
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
