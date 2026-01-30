import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Progress, Text } from '@chakra-ui/react'

type Props = {
  memberCount: number
  limit?: number
}

export const VillageCapacityAlert = ({ memberCount, limit = 10 }: Props) => {
  const percentage = Math.min(100, Math.round((memberCount / limit) * 100))
  const isNearLimit = memberCount >= limit - 2 && memberCount < limit
  const isFull = memberCount >= limit

  return (
    <Box>
      <Text fontSize="sm" color="brand.subtleText" mb={2}>
        Village capacity
      </Text>
      <Progress value={percentage} size="sm" borderRadius="full" colorScheme={isFull ? 'red' : 'purple'} />
      <Text fontSize="xs" color="brand.subtleText" mt={2}>
        {memberCount}/{limit} members
      </Text>
      {(isNearLimit || isFull) && (
        <Alert status={isFull ? 'error' : 'warning'} mt={3} borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle fontSize="sm">
              {isFull ? 'Village is at capacity' : 'Village nearing capacity'}
            </AlertTitle>
            <AlertDescription fontSize="xs">
              {isFull
                ? 'No additional members can join until someone leaves.'
                : 'Invite carefully to avoid reaching the 10-member limit.'}
            </AlertDescription>
          </Box>
        </Alert>
      )}
    </Box>
  )
}
