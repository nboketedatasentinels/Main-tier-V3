import { Button, Card, CardBody, HStack, Icon, Stack, Text } from '@chakra-ui/react'
import { Flag } from 'lucide-react'
import { MouseEventHandler } from 'react'

interface NextMilestoneCardProps {
  milestone: string
  daysRemaining: number
  onNavigate?: MouseEventHandler<HTMLButtonElement>
}

export const NextMilestoneCard = ({ milestone, daysRemaining, onNavigate }: NextMilestoneCardProps) => {
  return (
    <Card h="100%" bg="white" borderWidth="1px" borderColor="purple.800" borderRadius="xl">
      <CardBody p={5}>
        <Stack spacing={4}>
          {/* Header */}
          <HStack spacing={2}>
            <Icon as={Flag} color="purple.600" boxSize={5} />
            <Text fontWeight="semibold" fontSize="md" color="gray.800" fontFamily="heading">Next Milestone</Text>
          </HStack>

          {/* Milestone Info */}
          <Stack
            spacing={2}
            p={4}
            bg="purple.50"
            rounded="lg"
            borderLeftWidth="3px"
            borderLeftColor="purple.600"
          >
            <Text fontWeight="semibold" fontSize="md" color="gray.800">{milestone}</Text>
            <Text fontSize="sm" color="gray.600">
              Due in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
            </Text>
          </Stack>

          {/* Action Button */}
          <Button
            size="sm"
            bg="purple.800"
            color="white"
            _hover={{ bg: 'purple.700' }}
            alignSelf="flex-start"
            onClick={onNavigate}
          >
            Review checklist
          </Button>
        </Stack>
      </CardBody>
    </Card>
  )
}
