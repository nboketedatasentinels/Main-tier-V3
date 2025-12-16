import { Card, CardBody, HStack, Icon, Skeleton, Stack, Text } from '@chakra-ui/react'
import { Quote } from 'lucide-react'
import { InspirationQuote } from '@/types'

interface WeeklyInspirationCardProps {
  data: InspirationQuote | null
  loading: boolean
}

export const WeeklyInspirationCard = ({ data, loading }: WeeklyInspirationCardProps) => {
  return (
    <Card h="100%" variant="outline" borderColor="brand.border" bg="brand.primaryMuted">
      <CardBody>
        <Stack spacing={3}>
          <HStack spacing={2}>
            <Icon as={Quote} />
            <Text fontWeight="bold" color="#5A6ACF">Weekly Inspiration</Text>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <Text fontSize="lg" fontWeight="semibold" color="#5A6ACF">
              {data?.quote_text || 'Join the movement. Take one small step today toward your goal.'}
            </Text>
          </Skeleton>
          <Text fontSize="sm" color="#5A6ACF">
            {data?.author || 'T4L Community'}
          </Text>
        </Stack>
      </CardBody>
    </Card>
  )
}
