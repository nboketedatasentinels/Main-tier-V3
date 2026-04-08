import { Box, Button, Card, CardBody, HStack, Icon, Stack, Text, VStack } from '@chakra-ui/react'
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  onSeeMore?: () => void
}

const statusColorMap: Record<ActivityFeedStatus, string> = {
  complete: 'green.500',
  pending: 'yellow.500',
  attention: 'danger.DEFAULT',
}

const statusIconMap: Record<ActivityFeedStatus, typeof CheckCircle2> = {
  complete: CheckCircle2,
  pending: Clock3,
  attention: AlertTriangle,
}

export const ActivityFeedCard = ({ items, onSeeMore }: ActivityFeedCardProps) => {
  const [showAll, setShowAll] = useState(false)
  const openLoops = useMemo(() => items.filter(item => item.status !== 'complete').length, [items])
  const visibleItems = onSeeMore ? items.slice(0, 5) : showAll ? items : items.slice(0, 5)

  return (
    <Card h="100%" bg="white" borderWidth="1px" borderColor="indigo.400" borderRadius="xl">
      <CardBody p={5}>
        <Stack spacing={4}>
          {/* Header */}
          <HStack justify="space-between" align="center">
            <Text fontWeight="semibold" fontSize="md" color="gray.800" fontFamily="heading">Activity Feed</Text>
            {openLoops > 0 && (
              <Box bg="orange.100" px={3} py={1} borderRadius="full">
                <Text fontSize="xs" fontWeight="medium" color="orange.700" fontFamily="body">
                  {openLoops} pending
                </Text>
              </Box>
            )}
          </HStack>

          <VStack align="stretch" spacing={2}>
            {items.length === 0 ? (
              <Box bg="gray.50" p={4} rounded="lg" textAlign="center">
                <Text color="gray.500" fontSize="sm">No recent activity</Text>
              </Box>
            ) : (
              visibleItems.map((item) => (
                <HStack
                  key={item.id}
                  align="flex-start"
                  spacing={3}
                  p={3}
                  bg="gray.50"
                  rounded="lg"
                  _hover={{ bg: 'gray.100' }}
                  transition="background 0.2s"
                >
                  <Box
                    p={2}
                    bg={item.status === 'complete' ? 'green.100' : item.status === 'pending' ? 'yellow.100' : 'red.100'}
                    rounded="full"
                  >
                    <Icon
                      as={statusIconMap[item.status]}
                      color={statusColorMap[item.status]}
                      boxSize={4}
                    />
                  </Box>
                  <Box flex={1}>
                    <Text fontWeight="semibold" fontSize="sm" color="gray.800">{item.title}</Text>
                    <Text fontSize="sm" color="gray.600" noOfLines={1}>{item.description}</Text>
                    <Text fontSize="xs" color="gray.400" mt={1}>{item.timestamp}</Text>
                  </Box>
                </HStack>
              ))
            )}
          </VStack>

          {onSeeMore && items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              colorScheme="indigo"
              alignSelf="flex-start"
              onClick={onSeeMore}
            >
              See more
            </Button>
          )}

          {!onSeeMore && items.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              colorScheme="indigo"
              alignSelf="flex-start"
              onClick={() => setShowAll(prev => !prev)}
            >
              {showAll ? 'Show less' : `View all (${items.length})`}
            </Button>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
