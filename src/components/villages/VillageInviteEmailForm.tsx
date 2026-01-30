import { Button, FormControl, FormLabel, HStack, Input } from '@chakra-ui/react'
import { useState } from 'react'

type Props = {
  onInvite: (email: string) => Promise<void>
  isDisabled?: boolean
  isLoading?: boolean
}

export const VillageInviteEmailForm = ({ onInvite, isDisabled, isLoading }: Props) => {
  const [email, setEmail] = useState('')

  const handleSubmit = async () => {
    const trimmed = email.trim()
    if (!trimmed) return
    await onInvite(trimmed)
    setEmail('')
  }

  return (
    <FormControl>
      <FormLabel fontSize="sm">Invite by email</FormLabel>
      <HStack>
        <Input
          placeholder="member@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          isDisabled={isDisabled}
        />
        <Button
          colorScheme="purple"
          onClick={handleSubmit}
          isDisabled={isDisabled || !email.trim()}
          isLoading={isLoading}
        >
          Send Invite
        </Button>
      </HStack>
    </FormControl>
  )
}
