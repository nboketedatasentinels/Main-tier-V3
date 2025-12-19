import {
  Badge,
  Card,
  CardBody,
  Checkbox,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  VStack,
  Progress,
} from '@chakra-ui/react'
import { CheckCircle } from 'lucide-react'
import { WeeklyHabit } from '@/hooks/useWeeklyGlanceData'

interface WeeklyHabitsCardProps {
  habits: WeeklyHabit[]
  loading: boolean
  onToggleHabit: (habit: WeeklyHabit) => void
}

export const WeeklyHabitsCard = ({ habits, loading, onToggleHabit }: WeeklyHabitsCardProps) => {
  const completedCount = habits.filter(habit => habit.completed).length
  const progress = habits.length ? Math.round((completedCount / habits.length) * 100) : 0

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <Text fontWeight="bold">Weekly Habits</Text>
            <Badge colorScheme="blue">{completedCount} of {habits.length}</Badge>
          </HStack>
          <Progress value={progress} colorScheme="green" rounded="full" />
          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              {habits.length === 0 && <Text color="text.secondary">No habits added yet.</Text>}
              {habits.map(habit => (
                <HStack
                  key={habit.id}
                  justify="space-between"
                  p={2}
                  borderWidth="1px"
                  borderColor="border.subtle"
                  rounded="md"
                  _hover={{ bg: 'tint.brandPrimary', cursor: 'pointer' }}
                  onClick={() => onToggleHabit(habit)}
                >
                  <HStack spacing={2}>
                    <Checkbox isChecked={habit.completed} pointerEvents="none" />
                    <Text>{habit.title}</Text>
                  </HStack>
                  {habit.completed && <Icon as={CheckCircle} color="green.500" />}
                </HStack>
              ))}
            </VStack>
          </Skeleton>
        </Stack>
      </CardBody>
    </Card>
  )
}
