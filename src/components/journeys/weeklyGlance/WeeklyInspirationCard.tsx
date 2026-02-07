import { Card, CardBody, HStack, Icon, Skeleton, Stack, Text } from '@chakra-ui/react'
import { Quote } from 'lucide-react'
import { InspirationQuote } from '@/types'

interface WeeklyInspirationCardProps {
  data: InspirationQuote | null
  loading: boolean
}

export const WeeklyInspirationCard = ({ data, loading }: WeeklyInspirationCardProps) => {
  return (
    <Card bg="brand.primaryMuted" border="1px" borderColor="brand.border">
      <CardBody>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align="flex-start" justify="space-between">
          <HStack spacing={2}>
            <Icon as={Quote} color="text.primary" />
            <Text fontWeight="bold" color="text.primary">Weekly Inspiration</Text>
          </HStack>
          <Stack spacing={2} flex="1">
            <Skeleton isLoaded={!loading} rounded="md">
              <Text fontSize="lg" fontWeight="semibold" color="text.primary">
                {data?.quote_text || 'Join the movement. Take one small step today toward your goal.'}
              </Text>
            </Skeleton>
            <Text fontSize="sm" color="text.secondary">
              {data?.author || 'T4L Community'}
            </Text>
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  )
}
