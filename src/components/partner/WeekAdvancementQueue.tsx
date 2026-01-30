import React, { useState, useMemo } from 'react'
import {
  Box,
  Stack,
  HStack,
  Text,
  Badge,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Icon,
  Select,
  Skeleton,
  Alert,
  AlertIcon,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Textarea
} from '@chakra-ui/react'
import { CheckCircle, Clock, Lock, AlertTriangle } from 'lucide-react'
import { UserProfile } from '@/types'
import { AdvancementEligibility } from '@/services/weekAdvancementService'

export interface UserAdvancementStatus {
  profile: UserProfile
  eligibility: AdvancementEligibility
  loading: boolean
}

export interface WeekAdvancementQueueProps {
  users: UserAdvancementStatus[]
  loading: boolean
  onAdvanceUser: (userId: string, reason?: string) => Promise<void>
  onAdvanceUserOverride: (userId: string, reason: string) => Promise<void>
}

type FilterType = 'all' | 'ready' | 'blocked' | 'in_progress'

/**
 * Partner dashboard component showing users eligible for week advancement.
 *
 * Features:
 * - Filterable table: Ready / Blocked / In Progress / All
 * - User advancement actions
 * - Override capability for manual advancement
 * - Eligibility status display
 *
 * @param users - Array of users with their advancement status
 * @param loading - Loading state
 * @param onAdvanceUser - Callback to advance a user (checks eligibility)
 * @param onAdvanceUserOverride - Callback to force advance a user (bypasses eligibility)
 */
export const WeekAdvancementQueue: React.FC<WeekAdvancementQueueProps> = ({
  users,
  loading,
  onAdvanceUser,
  onAdvanceUserOverride
}) => {
  const [filter, setFilter] = useState<FilterType>('ready')
  const [advancingUserId, setAdvancingUserId] = useState<string | null>(null)
  const [overrideModal, setOverrideModal] = useState<{ isOpen: boolean; userId: string; userName: string }>({
    isOpen: false,
    userId: '',
    userName: ''
  })
  const [overrideReason, setOverrideReason] = useState('')
  const toast = useToast()

  // Filter users based on selected filter
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (user.loading) return false

      const { eligibility } = user

      if (!eligibility) return false

      switch (filter) {
        case 'ready':
          return eligibility.isEligible
        case 'blocked':
          return !eligibility.isEligible && eligibility.pendingApprovals.length > 0
        case 'in_progress':
          return !eligibility.isEligible && eligibility.pendingApprovals.length === 0
        case 'all':
        default:
          return true
      }
    })
  }, [users, filter])

  const getStatusConfig = (eligibility: AdvancementEligibility) => {
    if (eligibility.isEligible) {
      return {
        label: 'Ready',
        colorScheme: 'green',
        icon: CheckCircle
      }
    }

    const hasPendingApprovals = eligibility.pendingApprovals.length > 0

    if (hasPendingApprovals) {
      return {
        label: 'Blocked',
        colorScheme: 'red',
        icon: Lock
      }
    }

    return {
      label: 'In Progress',
      colorScheme: 'yellow',
      icon: Clock
    }
  }

  const handleAdvance = async (userId: string) => {
    setAdvancingUserId(userId)
    try {
      await onAdvanceUser(userId)
      toast({
        title: 'User advanced',
        description: 'User has been advanced to the next week.',
        status: 'success',
        duration: 3000,
        isClosable: true
      })
    } catch (error) {
      toast({
        title: 'Failed to advance user',
        description: error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setAdvancingUserId(null)
    }
  }

  const handleOverrideAdvance = async () => {
    if (!overrideReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for manual override',
        status: 'warning',
        duration: 3000,
        isClosable: true
      })
      return
    }

    const userId = overrideModal.userId
    setAdvancingUserId(userId)
    setOverrideModal({ isOpen: false, userId: '', userName: '' })

    try {
      await onAdvanceUserOverride(userId, overrideReason)
      toast({
        title: 'User advanced (override)',
        description: 'User has been manually advanced to the next week.',
        status: 'success',
        duration: 3000,
        isClosable: true
      })
      setOverrideReason('')
    } catch (error) {
      toast({
        title: 'Failed to advance user',
        description: error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setAdvancingUserId(null)
    }
  }

  const openOverrideModal = (userId: string, userName: string) => {
    setOverrideModal({ isOpen: true, userId, userName })
    setOverrideReason('')
  }

  if (loading && users.length === 0) {
    return (
      <Stack spacing={3}>
        <Skeleton height="40px" />
        <Skeleton height="200px" />
      </Stack>
    )
  }

  return (
    <Box>
      <Stack spacing={4}>
        {/* Header with Filter */}
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="bold" color="text.primary">
            Week Advancement Queue
          </Text>
          <HStack spacing={3}>
            <Text fontSize="sm" color="text.secondary">
              Filter:
            </Text>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              size="sm"
              w="150px"
            >
              <option value="ready">Ready ({users.filter(u => u.eligibility?.isEligible).length})</option>
              <option value="blocked">
                Blocked ({users.filter(u => !u.eligibility?.isEligible && (u.eligibility?.pendingApprovals.length ?? 0) > 0).length})
              </option>
              <option value="in_progress">
                In Progress ({users.filter(u => !u.eligibility?.isEligible && (u.eligibility?.pendingApprovals.length ?? 0) === 0).length})
              </option>
              <option value="all">All ({users.length})</option>
            </Select>
          </HStack>
        </HStack>

        {/* Table */}
        {filteredUsers.length === 0 ? (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">
              {filter === 'ready' && 'No users ready to advance at this time.'}
              {filter === 'blocked' && 'No users blocked by pending approvals.'}
              {filter === 'in_progress' && 'No users in progress.'}
              {filter === 'all' && 'No users found.'}
            </Text>
          </Alert>
        ) : (
          <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
            <Table size="sm">
              <Thead bg="gray.50">
                <Tr>
                  <Th>User</Th>
                  <Th>Current Week</Th>
                  <Th>Progress</Th>
                  <Th>Status</Th>
                  <Th>Blockers</Th>
                  <Th textAlign="right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredUsers.map(({ profile, eligibility }) => {
                  const status = getStatusConfig(eligibility)
                  const isAdvancing = advancingUserId === profile.id

                  return (
                    <Tr key={profile.id}>
                      <Td>
                        <Stack spacing={0}>
                          <Text fontWeight="medium" fontSize="sm">
                            {profile.fullName || `${profile.firstName} ${profile.lastName}`}
                          </Text>
                          <Text fontSize="xs" color="text.secondary">
                            {profile.email}
                          </Text>
                        </Stack>
                      </Td>
                      <Td>
                        <Text fontSize="sm">
                          Week {eligibility.currentWeek} → {eligibility.nextWeek}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" fontWeight="medium">
                          {eligibility.progressPercentage}%
                        </Text>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={status.colorScheme}
                          variant="subtle"
                          display="flex"
                          alignItems="center"
                          gap={1}
                          w="fit-content"
                        >
                          <Icon as={status.icon} boxSize={3} />
                          {status.label}
                        </Badge>
                      </Td>
                      <Td>
                        {eligibility.blockers.length > 0 ? (
                          <Stack spacing={0}>
                            {eligibility.blockers.slice(0, 2).map((blocker, idx) => (
                              <Text key={idx} fontSize="xs" color="text.secondary">
                                • {blocker}
                              </Text>
                            ))}
                            {eligibility.blockers.length > 2 && (
                              <Text fontSize="xs" color="text.secondary" fontStyle="italic">
                                +{eligibility.blockers.length - 2} more
                              </Text>
                            )}
                          </Stack>
                        ) : (
                          <Text fontSize="xs" color="green.600">
                            None
                          </Text>
                        )}
                      </Td>
                      <Td textAlign="right">
                        <HStack spacing={2} justify="flex-end">
                          {eligibility.isEligible ? (
                            <Button
                              size="xs"
                              colorScheme="green"
                              onClick={() => handleAdvance(profile.id)}
                              isLoading={isAdvancing}
                            >
                              Advance
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="outline"
                              colorScheme="orange"
                              leftIcon={<Icon as={AlertTriangle} boxSize={3} />}
                              onClick={() => openOverrideModal(profile.id, profile.fullName || profile.firstName)}
                              isLoading={isAdvancing}
                            >
                              Override
                            </Button>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </Stack>

      {/* Override Modal */}
      <Modal isOpen={overrideModal.isOpen} onClose={() => setOverrideModal({ isOpen: false, userId: '', userName: '' })} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Manual Week Advancement</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Alert status="warning" borderRadius="md" fontSize="sm">
                <AlertIcon />
                <Text>
                  You are about to manually advance <strong>{overrideModal.userName}</strong> without meeting eligibility criteria.
                  Please provide a reason for this override.
                </Text>
              </Alert>
              <Textarea
                placeholder="Reason for manual advancement (required)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={4}
              />
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setOverrideModal({ isOpen: false, userId: '', userName: '' })}>
              Cancel
            </Button>
            <Button colorScheme="orange" onClick={handleOverrideAdvance}>
              Override & Advance
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
