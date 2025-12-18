import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Mail, MessageCircle } from 'lucide-react'
import { SupportAssignment } from '@/hooks/useWeeklyGlanceData'

interface SupportTeamCardProps {
  data: SupportAssignment | null
  loading: boolean
}

export const SupportTeamCard = ({ data, loading }: SupportTeamCardProps) => {
  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={4}>
          <Text fontWeight="bold">Support Team</Text>
          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={3}>
              <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                <HStack spacing={3} w="100%" justify="space-between">
                  <HStack spacing={2}>
                    <Avatar size="sm" name={data?.mentor_id || 'Mentor'} />
                    <VStack spacing={0} align="start">
                      <Text fontWeight="semibold">Mentor</Text>
                      <Text fontSize="sm" color="text.secondary">
                        {data?.mentor_id ? data.mentor_id : 'No mentor assigned'}
                      </Text>
                    </VStack>
                  </HStack>
                  {data?.mentor_id ? (
                    <Button size="sm" leftIcon={<Icon as={Mail} />}>Contact</Button>
                  ) : (
                    <Badge colorScheme="gray">Pending</Badge>
                  )}
                </HStack>
              </VStack>

              <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                <HStack spacing={3} w="100%" justify="space-between">
                  <HStack spacing={2}>
                    <Avatar size="sm" name={data?.ambassador_id || 'Ambassador'} />
                    <VStack spacing={0} align="start">
                      <Text fontWeight="semibold">Ambassador</Text>
                      <Text fontSize="sm" color="text.secondary">
                        {data?.ambassador_id ? data.ambassador_id : 'No ambassador assigned'}
                      </Text>
                    </VStack>
                  </HStack>
                  {data?.ambassador_id ? (
                    <Button size="sm" leftIcon={<Icon as={MessageCircle} />}>Message</Button>
                  ) : (
                    <Badge colorScheme="gray">Pending</Badge>
                  )}
                </HStack>
              </VStack>
            </Stack>
          </Skeleton>
        </Stack>
      </CardBody>
    </Card>
  )
}
