import { Badge, Button, HStack, List, ListItem, Text, VStack } from '@chakra-ui/react'
import type { VillageInvitation } from '@/services/villageInvitationService'

type Props = {
  invitations: VillageInvitation[]
  onResend: (invite: VillageInvitation) => Promise<void>
  onRevoke: (invite: VillageInvitation) => Promise<void>
}

const statusColorMap: Record<string, string> = {
  pending: 'orange',
  accepted: 'green',
  declined: 'gray',
  revoked: 'red',
}

export const PendingVillageInvitesList = ({ invitations, onResend, onRevoke }: Props) => {
  if (invitations.length === 0) {
    return <Text fontSize="sm" color="brand.subtleText">No invitations yet.</Text>
  }

  return (
    <List spacing={3}>
      {invitations.map((invite) => (
        <ListItem key={invite.id} borderWidth="1px" borderColor="brand.border" borderRadius="md" p={3}>
          <HStack justify="space-between" align="flex-start" spacing={4}>
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" fontWeight="semibold">{invite.email || 'Shareable code'}</Text>
              <Text fontSize="xs" color="brand.subtleText">
                Code: {invite.invitationCode}
              </Text>
              <HStack spacing={2}>
                <Badge colorScheme={statusColorMap[invite.status] || 'gray'}>{invite.status}</Badge>
                {invite.createdAt && (
                  <Text fontSize="xs" color="brand.subtleText">
                    Sent {new Date(invite.createdAt).toLocaleDateString()}
                  </Text>
                )}
              </HStack>
            </VStack>
            <HStack spacing={2}>
              {invite.status === 'pending' && (
                <>
                  <Button size="xs" variant="outline" onClick={() => onResend(invite)}>
                    Resend
                  </Button>
                  <Button size="xs" colorScheme="red" variant="outline" onClick={() => onRevoke(invite)}>
                    Revoke
                  </Button>
                </>
              )}
            </HStack>
          </HStack>
        </ListItem>
      ))}
    </List>
  )
}
