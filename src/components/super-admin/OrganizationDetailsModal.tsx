import React from 'react'
import type { BadgeProps } from '@chakra-ui/react'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
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
} from '@chakra-ui/react'
import type { OrganizationMemberStats, OrganizationRecord } from '@/types/admin'

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
                    Organization overview
                  </Text>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <InfoItem label="Team size limit" value={organization.teamSize ?? '—'} />
                    <InfoItem label="Current members" value={memberCountContent} />
                    <InfoItem label="Village" value={organization.village || '—'} />
                    <InfoItem label="Cluster" value={organization.cluster || '—'} />
                  </SimpleGrid>
                </Stack>
              </Box>

              <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Program details
                  </Text>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <InfoItem label="Program start" value={organization.programStart || '—'} />
                    <InfoItem label="Program end" value={organization.programEnd || '—'} />
                    <InfoItem label="Active members" value={activeMemberContent} />
                    <InfoItem label="Paid members" value={paidMemberContent} />
                  </SimpleGrid>
                </Stack>
              </Box>

              <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Transformation partner
                  </Text>
                  <InfoItem label="Partner name" value={organization.transformationPartner || organization.assignedPartnerName || '—'} />
                  <InfoItem label="Partner email" value={organization.assignedPartnerEmail || '—'} />
                </Stack>
              </Box>

              <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4}>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Assigned team
                  </Text>
                  <InfoItem label="Mentor" value={organization.assignedMentorName || organization.assignedMentorEmail || '—'} />
                  <InfoItem label="Ambassador" value={organization.assignedAmbassadorName || organization.assignedAmbassadorEmail || '—'} />
                  <InfoItem label="Partner" value={organization.assignedPartnerName || organization.assignedPartnerEmail || '—'} />
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

            <Flex gap={6} wrap="wrap">
              <InfoItem label="Created" value={formatDateTime(organization.createdAt)} />
              <InfoItem label="Last updated" value={formatDateTime(organization.updatedAt)} />
            </Flex>
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
