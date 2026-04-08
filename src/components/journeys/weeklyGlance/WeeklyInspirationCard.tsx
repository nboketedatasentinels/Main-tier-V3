import { Card, CardBody, HStack, Icon, Skeleton, Stack, Text } from '@chakra-ui/react'
import { Quote } from 'lucide-react'
import { InspirationQuote } from '@/types'

interface WeeklyInspirationCardProps {
  data: InspirationQuote | null
  loading: boolean
}

export const WeeklyInspirationCard = ({ data, loading }: WeeklyInspirationCardProps) => {
  // Kept as weekly inspiration to align with week-number keyed quote selection in useWeeklyGlanceData.
  return (
    <Card
      bgGradient="linear(to-r, #350e6f, #8b5a3c)"
      borderRadius="xl"
      boxShadow="md"
    >
      <CardBody>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align="flex-start" justify="space-between">
          <HStack spacing={2}>
            <Icon as={Quote} color="white" boxSize={6} />
            <Text fontWeight="semibold" fontSize="md" color="white" fontFamily="heading" letterSpacing="wide">
              Weekly Inspiration
            </Text>
          </HStack>
          <Stack spacing={3} flex="1">
            <Skeleton isLoaded={!loading} rounded="md">
              <Text fontSize="2xl" fontWeight="medium" color="white" fontFamily="heading" lineHeight="1.3">
                {data?.quote_text || 'Join the movement. Take one small step today toward your goal.'}
              </Text>
            </Skeleton>
            <Text fontSize="sm" color="whiteAlpha.800" fontFamily="body" fontStyle="italic">
              — {data?.author || 'T4L Community'}
            </Text>
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  )
}
