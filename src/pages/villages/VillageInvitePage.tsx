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
import { fetchVillageById } from '@/services/villageService'
import {
  createVillageInvitation,
  listVillageInvitations,
  resendVillageInvitation,
  revokeVillageInvitation,
  type VillageInvitation,
} from '@/services/villageInvitationService'
import { VillageCapacityAlert } from '@/components/villages/VillageCapacityAlert'
import { VillageInviteEmailForm } from '@/components/villages/VillageInviteEmailForm'
import { PendingVillageInvitesList } from '@/components/villages/PendingVillageInvitesList'
import { VillageInviteCodeModal } from '@/components/villages/VillageInviteCodeModal'
import { useAuth } from '@/hooks/useAuth'
import { formatVillageInviteLink } from '@/config/app'

const MEMBER_LIMIT = 10

export const VillageInvitePage = () => {
  const { villageId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [memberCount, setMemberCount] = useState(0)
  const [invitations, setInvitations] = useState<VillageInvitation[]>([])
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false)

  const inviteLink = useMemo(() => {
    if (!inviteCode) return ''
    return formatVillageInviteLink(inviteCode)
  }, [inviteCode])

  const loadData = async () => {
    if (!villageId) return
    setLoading(true)
    try {
      const village = await fetchVillageById(villageId)
      if (!village) {
        toast({ title: 'Village not found', status: 'error' })
        navigate('/app/profile')
        return
      }
      setVillageName(village.name)
      setMemberCount(village.memberCount)
      const pendingInvites = await listVillageInvitations({ villageId, status: 'pending' })
      setInvitations(pendingInvites)
    } catch (error) {
      console.error('Failed to load invitations', error)
      toast({ title: 'Unable to load invitations', status: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [villageId])

  const handleInviteEmail = async (email: string) => {
    if (!villageId || !user || !profile) return
    if (memberCount >= MEMBER_LIMIT) {
      toast({ title: 'Village is at capacity', status: 'warning' })
      return
    }
    if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
      toast({ title: 'You cannot invite yourself', status: 'warning' })
      return
    }
    setInviting(true)
    try {
      await createVillageInvitation({
        villageId,
        villageName,
        invitedBy: user.uid,
        invitedByName: profile.fullName,
        email,
      })
      toast({ title: 'Invitation sent', status: 'success' })
      await loadData()
    } catch (error) {
      console.error('Failed to create invitation', error)
      toast({ title: 'Unable to send invitation', status: 'error' })
    } finally {
      setInviting(false)
    }
  }

  const handleGenerateCode = async () => {
    if (!villageId || !user || !profile) return
    if (memberCount >= MEMBER_LIMIT) {
      toast({ title: 'Village is at capacity', status: 'warning' })
      return
    }
    setInviting(true)
    try {
      const result = await createVillageInvitation({
        villageId,
        villageName,
        invitedBy: user.uid,
        invitedByName: profile.fullName,
      })
      setInviteCode(result.invitationCode)
      setIsCodeModalOpen(true)
      toast({ title: 'Invite code created', status: 'success' })
      await loadData()
    } catch (error) {
      console.error('Failed to generate invite code', error)
      toast({ title: 'Unable to create invite code', status: 'error' })
    } finally {
      setInviting(false)
    }
  }

  const handleResend = async (invite: VillageInvitation) => {
    try {
      await resendVillageInvitation(invite.id)
      toast({ title: 'Invitation resent', status: 'success' })
    } catch (error) {
      console.error('Failed to resend invitation', error)
      toast({ title: 'Unable to resend invitation', status: 'error' })
    }
  }

  const handleRevoke = async (invite: VillageInvitation) => {
    try {
      await revokeVillageInvitation(invite.id)
      toast({ title: 'Invitation revoked', status: 'success' })
      await loadData()
    } catch (error) {
      console.error('Failed to revoke invitation', error)
      toast({ title: 'Unable to revoke invitation', status: 'error' })
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
        <HStack justify="space-between">
          <Heading size="md">Invite members</Heading>
          <Button variant="ghost" onClick={() => navigate('/app/profile')}>Back to profile</Button>
        </HStack>

        <Card borderColor="brand.border" boxShadow="card">
          <CardHeader>
            <Text fontWeight="semibold">Village capacity</Text>
          </CardHeader>
          <CardBody>
            <VillageCapacityAlert memberCount={memberCount} limit={MEMBER_LIMIT} />
          </CardBody>
        </Card>

        <Card borderColor="brand.border" boxShadow="card">
          <CardHeader>
            <Text fontWeight="semibold">Send invitations</Text>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <VillageInviteEmailForm
                onInvite={handleInviteEmail}
                isDisabled={memberCount >= MEMBER_LIMIT}
                isLoading={inviting}
              />
              <Button
                variant="outline"
                onClick={handleGenerateCode}
                isDisabled={memberCount >= MEMBER_LIMIT}
                isLoading={inviting}
              >
                Generate shareable invite link
              </Button>
            </VStack>
          </CardBody>
        </Card>

        <Card borderColor="brand.border" boxShadow="card">
          <CardHeader>
            <Text fontWeight="semibold">Pending invitations</Text>
          </CardHeader>
          <CardBody>
            <PendingVillageInvitesList
              invitations={invitations}
              onResend={handleResend}
              onRevoke={handleRevoke}
            />
          </CardBody>
        </Card>
      </VStack>

      {inviteCode && (
        <VillageInviteCodeModal
          isOpen={isCodeModalOpen}
          onClose={() => setIsCodeModalOpen(false)}
          inviteLink={inviteLink}
        />
      )}
    </Box>
  )
}
