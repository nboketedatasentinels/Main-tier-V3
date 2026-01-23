import { Box, Button, Card, CardBody, HStack, Icon, Stack, Text, VStack } from '@chakra-ui/react'
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
  complete: 'green.500',
  pending: 'yellow.500',
  attention: 'gray.400',
}

const statusIconMap: Record<ActivityFeedStatus, typeof CheckCircle2> = {
  complete: CheckCircle2,
  pending: Clock3,
  attention: AlertTriangle,
}

export const ActivityFeedCard = ({ items }: ActivityFeedCardProps) => {
  const visibleItems = items.slice(0, 5)

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody p={6}>
        <Stack spacing={4}>
          <HStack justify="space-between">
            <Text fontWeight="bold" fontSize="md">Activity feed</Text>
          </HStack>

          <VStack align="stretch" spacing={3}>
            {items.length === 0 && (
              <Text color="text.secondary" fontSize="sm">
                No updates yet. Keep logging activity to see your feed.
              </Text>
            )}
            {visibleItems.map((item) => (
              <HStack
                key={item.id}
                align="flex-start"
                spacing={3}
                p={3}
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="md"
              >
                <Box pt={1}>
                  <Icon as={statusIconMap[item.status]} color={statusColorMap[item.status]} />
                </Box>
                <Box flex={1}>
                  <Text fontWeight="semibold">{item.title}</Text>
                  <Text fontSize="sm" color="text.secondary" mt={1} noOfLines={1}>
                    {item.description}
                  </Text>
                  <Text fontSize="xs" color="text.muted" mt={2}>
                    {item.timestamp}
                  </Text>
                </Box>
              </HStack>
            ))}
          </VStack>

          {items.length > 5 && (
            <Button variant="link" size="sm" alignSelf="flex-start" color="brand.primary">
              View all activity
            </Button>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
