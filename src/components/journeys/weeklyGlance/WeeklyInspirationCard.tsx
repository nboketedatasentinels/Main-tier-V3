import { Card, CardBody, HStack, Icon, Skeleton, Stack, Text } from '@chakra-ui/react'
import { Quote } from 'lucide-react'
import { InspirationQuote } from '@/hooks/useWeeklyGlanceData'

interface WeeklyInspirationCardProps {
  data: InspirationQuote | null
  loading: boolean
}

export const WeeklyInspirationCard = ({ data, loading }: WeeklyInspirationCardProps) => {
  return (
    <Card h="100%" variant="outline" borderColor="border.subtle" bg="tint.brandPrimary">
      <CardBody>
        <Stack spacing={3}>
          <HStack spacing={2}>
            <Icon as={Quote} />
            <Text fontWeight="bold">Weekly Inspiration</Text>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <Text fontSize="lg" fontWeight="semibold">
              {data?.quote_text || 'Join the movement. Take one small step today toward your goal.'}
            </Text>
          </Skeleton>
          <Text fontSize="sm" color="text.secondary">
            {data?.author || 'T4L Community'}
          </Text>
        </Stack>
      </CardBody>
    </Card>
  )
}
