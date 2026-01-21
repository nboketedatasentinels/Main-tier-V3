import { Badge, Box, Card, CardBody, HStack, Icon, Stack, Text, VStack } from '@chakra-ui/react'
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'

export type ActivityFeedStatus = 'complete' | 'pending' | 'attention'

export interface ActivityFeedItem {
  id: string
  title: string
  description: string
  timestamp: string
  status: ActivityFeedStatus
}

interface ActivityFeedCardProps {
  items: ActivityFeedItem[]
}

const statusColorMap: Record<ActivityFeedStatus, string> = {
  complete: 'green',
  pending: 'yellow',
  attention: 'red',
}

const statusIconMap: Record<ActivityFeedStatus, typeof CheckCircle2> = {
  complete: CheckCircle2,
  pending: Clock3,
  attention: AlertTriangle,
}

export const ActivityFeedCard = ({ items }: ActivityFeedCardProps) => {
  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <Text fontWeight="bold">Activity feed</Text>
            <Badge colorScheme="purple" variant="subtle">
              {items.length} updates
            </Badge>
          </HStack>

          <VStack align="stretch" spacing={3}>
            {items.length === 0 && (
              <Text color="text.secondary" fontSize="sm">
                No updates yet. Keep logging activity to see your feed.
              </Text>
            )}
            {items.map((item) => (
              <HStack
                key={item.id}
                align="flex-start"
                spacing={3}
                p={3}
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="md"
                bg="surface.subtle"
              >
                <Box pt={1}>
                  <Icon as={statusIconMap[item.status]} color={`${statusColorMap[item.status]}.500`} />
                </Box>
                <Box flex={1}>
                  <HStack justify="space-between" align="flex-start">
                    <Text fontWeight="semibold">{item.title}</Text>
                    <Badge colorScheme={statusColorMap[item.status]} variant="subtle">
                      {item.status}
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="text.secondary" mt={1}>
                    {item.description}
                  </Text>
                  <Text fontSize="xs" color="text.muted" mt={2}>
                    {item.timestamp}
                  </Text>
                </Box>
              </HStack>
            ))}
          </VStack>
        </Stack>
      </CardBody>
    </Card>
  )
}
