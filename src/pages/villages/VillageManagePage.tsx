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
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { fetchVillageById, getVillageMembers, removeMemberFromVillage } from '@/services/villageService'
import { VillageCapacityAlert } from '@/components/villages/VillageCapacityAlert'
import { VillageMembersList } from '@/components/villages/VillageMembersList'
import { getDisplayName } from '@/utils/displayName'
import { RemoveMemberConfirmModal } from '@/components/villages/RemoveMemberConfirmModal'
import { useAuth } from '@/hooks/useAuth'

type Member = {
  id: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  avatarUrl?: string
  photoURL?: string
}

export const VillageManagePage = () => {
  const { villageId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [memberCount, setMemberCount] = useState(0)
  const [creatorId, setCreatorId] = useState<string | undefined>(undefined)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)

  const selectedMemberName = useMemo(
    () =>
      getDisplayName(selectedMember, 'member'),
    [selectedMember],
  )

  const isVillageCreator = Boolean(creatorId && profile?.id === creatorId)

  const loadMembers = async () => {
    if (!villageId) return
    setLoading(true)
    try {
      const village = await fetchVillageById(villageId)
      if (!village) {
        toast({ title: 'Village not found', status: 'error' })
        navigate('/app/profile')
        return
      }
      setMemberCount(village.memberCount)
      setCreatorId(village.creatorId)
      const list = await getVillageMembers(villageId)
      setMembers(list as Member[])
    } catch (error) {
      console.error('Failed to load members', error)
      toast({ title: 'Unable to load members', status: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMembers()
  }, [villageId])

  const handleRemoveMember = async (reason: string) => {
    if (!villageId || !selectedMember) return
    setRemoving(true)
    try {
      await removeMemberFromVillage({ villageId, userId: selectedMember.id })
      await Promise.all([
        updateDoc(doc(db, 'users', selectedMember.id), { villageId: null, updatedAt: serverTimestamp() }),
        updateDoc(doc(db, 'profiles', selectedMember.id), { villageId: null, updatedAt: serverTimestamp() }),
      ])
      toast({
        title: 'Member removed',
        description: reason ? `Reason: ${reason}` : undefined,
        status: 'success',
      })
      setSelectedMember(null)
      await loadMembers()
    } catch (error) {
      console.error('Failed to remove member', error)
      toast({ title: 'Unable to remove member', status: 'error' })
    } finally {
      setRemoving(false)
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
          <Heading size="md">Manage village</Heading>
          <Button variant="ghost" onClick={() => navigate('/app/profile')}>
            Back to profile
          </Button>
        </HStack>

        <Card borderColor="brand.border" boxShadow="card">
          <CardHeader>
            <Text fontWeight="semibold">Village capacity</Text>
          </CardHeader>
          <CardBody>
            <VillageCapacityAlert memberCount={memberCount} />
          </CardBody>
        </Card>

        <Card borderColor="brand.border" boxShadow="card">
          <CardHeader>
            <Text fontWeight="semibold">Members</Text>
          </CardHeader>
          <CardBody>
            <VillageMembersList
              members={members}
              creatorId={creatorId}
              canRemoveMembers={isVillageCreator}
              onRemove={isVillageCreator ? (member) => setSelectedMember(member) : undefined}
            />
          </CardBody>
        </Card>
      </VStack>

      {selectedMember && (
        <RemoveMemberConfirmModal
          isOpen={Boolean(selectedMember)}
          onClose={() => setSelectedMember(null)}
          onConfirm={handleRemoveMember}
          memberName={selectedMemberName}
          isLoading={removing}
        />
      )}
    </Box>
  )
}
