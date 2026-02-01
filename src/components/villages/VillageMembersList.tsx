import { Avatar, Button, HStack, List, ListItem, Text, VStack } from '@chakra-ui/react'
import { getDisplayName } from '@/utils/displayName'

type Member = {
  id: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  avatarUrl?: string
  photoURL?: string
  createdAt?: string
}

type Props = {
  members: Member[]
  creatorId?: string
  onRemove: (member: Member) => void
}

export const VillageMembersList = ({ members, creatorId, onRemove }: Props) => {
  if (members.length === 0) {
    return <Text fontSize="sm" color="brand.subtleText">No members found.</Text>
  }

  return (
    <List spacing={3}>
      {members.map((member) => {
        const isCreator = creatorId && member.id === creatorId
        const memberName = getDisplayName(member, 'Member')
        return (
          <ListItem key={member.id} borderWidth="1px" borderColor="brand.border" borderRadius="md" p={3}>
            <HStack justify="space-between" spacing={4}>
              <HStack spacing={3}>
                <Avatar size="sm" src={member.avatarUrl || member.photoURL} name={memberName} />
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="semibold">{memberName}</Text>
                  <Text fontSize="xs" color="brand.subtleText">{member.email}</Text>
                </VStack>
              </HStack>
              {!isCreator && (
                <Button size="xs" variant="outline" colorScheme="red" onClick={() => onRemove(member)}>
                  Remove
                </Button>
              )}
              {isCreator && (
                <Text fontSize="xs" color="purple.500" fontWeight="semibold">
                  Founder
                </Text>
              )}
            </HStack>
          </ListItem>
        )
      })}
    </List>
  )
}
