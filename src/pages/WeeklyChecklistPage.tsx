import { Center, CircularProgress, Stack, Text } from '@chakra-ui/react'
import { useWeeklyChecklistViewModel } from '@/hooks/useWeeklyChecklistViewModel'
import { WeeklyChecklistLayout } from './WeeklyChecklistLayout'

export const WeeklyChecklistPage = () => {
  const vm = useWeeklyChecklistViewModel()

  if (vm.loading) {
    return (
      <Center py={16}>
        <Stack spacing={3} align="center">
          <CircularProgress isIndeterminate />
          <Text>Loading weekly checklist...</Text>
        </Stack>
      </Center>
    )
  }

  if (vm.error) {
    return <Text color="red.400">{vm.error}</Text>
  }

  return <WeeklyChecklistLayout vm={vm} />
}

export const WeeklyUpdatesPage = WeeklyChecklistPage

