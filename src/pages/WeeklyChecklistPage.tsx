import {
  Box,
  Grid,
  GridItem,
  HStack,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useWeeklyChecklistViewModel } from '@/hooks/useWeeklyChecklistViewModel'
import { WeeklyChecklistLayout } from './WeeklyChecklistLayout'

const ChecklistSkeletonLoader = () => (
  <Stack spacing={6}>
    {/* Journey Header Skeleton */}
    <Box bg="white" p={6} borderRadius="lg" shadow="sm">
      <HStack justify="space-between" mb={4}>
        <Skeleton height="28px" width="200px" />
        <HStack spacing={2}>
          <Skeleton height="32px" width="80px" borderRadius="full" />
          <Skeleton height="32px" width="80px" borderRadius="full" />
        </HStack>
      </HStack>
      <HStack spacing={4}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} height="40px" width="60px" borderRadius="md" />
        ))}
      </HStack>
    </Box>

    {/* Weekly Summary Skeleton */}
    <Box bg="white" p={6} borderRadius="lg" shadow="sm">
      <HStack justify="space-between">
        <Stack spacing={2}>
          <Skeleton height="20px" width="120px" />
          <Skeleton height="28px" width="180px" />
        </Stack>
        <HStack spacing={6}>
          <Stack align="center">
            <SkeletonCircle size="60px" />
            <Skeleton height="14px" width="60px" />
          </Stack>
          <Stack align="center">
            <Skeleton height="40px" width="100px" />
            <Skeleton height="14px" width="80px" />
          </Stack>
        </HStack>
      </HStack>
    </Box>

    {/* Main Content Grid Skeleton */}
    <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6} alignItems="start">
      <GridItem>
        <Box bg="white" p={6} borderRadius="lg" shadow="sm">
          <Skeleton height="24px" width="180px" mb={4} />
          <Stack spacing={4}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Box key={i} p={4} borderWidth="1px" borderRadius="md">
                <HStack spacing={4}>
                  <SkeletonCircle size="40px" />
                  <Stack flex={1} spacing={2}>
                    <Skeleton height="18px" width="60%" />
                    <SkeletonText noOfLines={2} spacing={2} skeletonHeight="12px" />
                  </Stack>
                  <Skeleton height="36px" width="100px" borderRadius="md" />
                </HStack>
              </Box>
            ))}
          </Stack>
        </Box>
      </GridItem>

      <GridItem>
        <Box bg="white" p={6} borderRadius="lg" shadow="sm">
          <Skeleton height="24px" width="140px" mb={4} />
          <Stack spacing={3}>
            {[1, 2, 3].map((i) => (
              <HStack key={i} justify="space-between">
                <Skeleton height="16px" width="100px" />
                <Skeleton height="16px" width="60px" />
              </HStack>
            ))}
          </Stack>
        </Box>
      </GridItem>
    </Grid>
  </Stack>
)

export const WeeklyChecklistPage = () => {
  const vm = useWeeklyChecklistViewModel()

  if (vm.loading) {
    return <ChecklistSkeletonLoader />
  }

  if (vm.error) {
    return <Text color="red.400">{vm.error}</Text>
  }

  return <WeeklyChecklistLayout vm={vm} />
}

export const WeeklyUpdatesPage = WeeklyChecklistPage

