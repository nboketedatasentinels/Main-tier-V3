import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  Spinner,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { fetchVillageById } from '@/services/villageService'
import {
  acceptVillageInvitation,
  fetchVillageInvitationByCode,
  rejectVillageInvitation,
  validateVillageCapacity,
} from '@/services/villageInvitationService'
import { updateUserVillageId } from '@/services/userProfileService'
import { VillageInvitationModal } from '@/components/villages/VillageInvitationModal'

const MEMBER_LIMIT = 10

export const AcceptVillageInvitePage = () => {
  const { invitationCode } = useParams()
  const { user, profile, isPaid } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invitationId, setInvitationId] = useState<string | null>(null)
  const [villageId, setVillageId] = useState<string | null>(null)
  const [villageName, setVillageName] = useState('')
  const [villageDescription, setVillageDescription] = useState<string | undefined>(undefined)
  const [memberCount, setMemberCount] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const availableSlots = useMemo(() => Math.max(0, MEMBER_LIMIT - memberCount), [memberCount])

  const loadInvitation = async () => {
    if (!invitationCode) return
    setLoading(true)
    try {
      const invitation = await fetchVillageInvitationByCode(invitationCode)
      if (!invitation) {
        setStatusMessage('Invitation not found or has expired.')
        return
      }
      if (invitation.status !== 'pending') {
        setStatusMessage('This invitation is no longer available.')
        return
      }
      setInvitationId(invitation.id)
      setVillageId(invitation.villageId)
      setVillageName(invitation.villageName)
      const village = await fetchVillageById(invitation.villageId)
      if (village) {
        setVillageDescription(village.description)
        setMemberCount(village.memberCount)
      }
      setModalOpen(true)
    } catch (error) {
      console.error('Failed to load invitation', error)
      setStatusMessage('Unable to load invitation details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvitation()
  }, [invitationCode])

  const handleAccept = async () => {
    if (!invitationId || !villageId || !user) return
    if (profile?.villageId) {
      toast({ title: 'You already belong to a village', status: 'warning' })
      return
    }
    if (isPaid) {
      toast({ title: 'Village invitations are available for free users only', status: 'warning' })
      return
    }
    setAccepting(true)
    try {
      const capacity = await validateVillageCapacity(villageId)
      if (capacity.isFull) {
        toast({ title: 'Village is at capacity', status: 'warning' })
        return
      }
      await acceptVillageInvitation({ invitationId, villageId, userId: user.uid })
      await updateUserVillageId(user.uid, villageId)
      toast({ title: 'Welcome to the village!', status: 'success' })
      navigate(`/app/profile`)
    } catch (error) {
      console.error('Failed to accept invitation', error)
      toast({ title: 'Unable to accept invitation', status: 'error' })
    } finally {
      setAccepting(false)
    }
  }

  const handleDecline = async () => {
    if (!invitationId) return
    try {
      await rejectVillageInvitation(invitationId)
      toast({ title: 'Invitation declined', status: 'info' })
      navigate('/app/profile')
    } catch (error) {
      console.error('Failed to decline invitation', error)
      toast({ title: 'Unable to decline invitation', status: 'error' })
    }
  }

  if (loading) {
    return (
      <HStack justify="center" py={20}>
        <Spinner />
      </HStack>
    )
  }

  return (
    <Box px={{ base: 4, md: 8 }} py={6}>
      <VStack align="stretch" spacing={6}>
        <Heading size="md">Village invitation</Heading>
        <Card borderColor="brand.border" boxShadow="card">
          <CardHeader>
            <Text fontWeight="semibold">Invitation details</Text>
          </CardHeader>
          <CardBody>
            {statusMessage ? (
              <Text fontSize="sm" color="brand.subtleText">{statusMessage}</Text>
            ) : (
              <VStack align="start" spacing={2}>
                <Text fontSize="sm">Village: {villageName}</Text>
                <Text fontSize="sm">Members: {memberCount}</Text>
                <Text fontSize="sm">Available slots: {availableSlots}</Text>
                <Button colorScheme="purple" onClick={() => setModalOpen(true)}>
                  Review invitation
                </Button>
              </VStack>
            )}
          </CardBody>
        </Card>
      </VStack>

      <VillageInvitationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAccept={handleAccept}
        onDecline={handleDecline}
        villageName={villageName}
        villageDescription={villageDescription}
        memberCount={memberCount}
        availableSlots={availableSlots}
        isLoading={accepting}
        isDisabled={availableSlots === 0}
      />
    </Box>
  )
}
