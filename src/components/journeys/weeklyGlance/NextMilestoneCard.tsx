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
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody p={6}>
        <Stack spacing={4}>
          <HStack spacing={2}>
            <Icon as={Flag} color="brand.primary" />
            <Text fontWeight="bold" fontSize="md" color="#273240">
              Next Milestone
            </Text>
          </HStack>
          <Stack spacing={2}>
            <Text fontWeight="semibold">{milestone}</Text>
            <Text fontSize="sm" color="text.secondary">
              Due in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}.
            </Text>
          </Stack>
          <Button size="sm" colorScheme="purple" alignSelf="flex-start" onClick={onNavigate}>
            Review weekly checklist
          </Button>
        </Stack>
      </CardBody>
    </Card>
  )
}
