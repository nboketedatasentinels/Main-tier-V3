import React, { useMemo } from 'react'
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { getDisplayName } from '@/utils/displayName'
import type { UserProfile } from '@/types'

type LearnerPointsRankingProps = {
  learners: UserProfile[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Eyebrow label shown above the list */
  title?: string
}

const formatPoints = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString() : '0'

/**
 * Roster ranked by totalPoints (highest first). Used beside coach/mentor profile panels.
 */
export const LearnerPointsRanking: React.FC<LearnerPointsRankingProps> = ({
  learners,
  selectedId,
  onSelect,
  title = 'Points ranking',
}) => {
  const ranked = useMemo(
    () =>
      [...learners].sort(
        (a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0) || getDisplayName(a).localeCompare(getDisplayName(b)),
      ),
    [learners],
  )

  return (
    <Box
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.200"
      p={4}
      h="fit-content"
      position={{ lg: 'sticky' }}
      top={{ lg: '96px' }}
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="0.12em"
        textTransform="uppercase"
        color="gray.500"
        mb={3}
      >
        {title}
      </Text>
      <Text fontSize="xs" color="gray.500" mb={4} lineHeight="1.5">
        Highest total points first
      </Text>

      {ranked.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          No learners to rank yet.
        </Text>
      ) : (
        <Stack spacing={1.5} maxH={{ base: '320px', lg: 'calc(100vh - 180px)' }} overflowY="auto">
          {ranked.map((learner, index) => {
            const id = learner.id ?? ''
            const active = Boolean(id && selectedId === id)
            const points = learner.totalPoints ?? 0
            const rank = index + 1

            return (
              <Box
                key={id || `${getDisplayName(learner)}-${rank}`}
                as={onSelect && id ? 'button' : 'div'}
                type={onSelect && id ? 'button' : undefined}
                onClick={onSelect && id ? () => onSelect(id) : undefined}
                w="full"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                px={2.5}
                py={2}
                borderRadius="lg"
                border="1px solid"
                borderColor={active ? '#350e6f' : 'transparent'}
                bg={active ? 'rgba(53,14,111,0.06)' : 'transparent'}
                _hover={
                  onSelect && id
                    ? { bg: active ? 'rgba(53,14,111,0.08)' : 'gray.50' }
                    : undefined
                }
                cursor={onSelect && id ? 'pointer' : 'default'}
                textAlign="left"
              >
                <HStack spacing={2.5} minW={0} flex={1}>
                  <Flex
                    w={7}
                    h={7}
                    flexShrink={0}
                    borderRadius="full"
                    align="center"
                    justify="center"
                    fontSize="xs"
                    fontWeight="bold"
                    bg={rank <= 3 ? '#350e6f' : 'gray.100'}
                    color={rank <= 3 ? 'white' : 'gray.600'}
                  >
                    {rank}
                  </Flex>
                  <Text fontSize="sm" fontWeight="600" color="gray.900" noOfLines={1}>
                    {getDisplayName(learner)}
                  </Text>
                </HStack>
                <Text fontSize="xs" fontWeight="semibold" color="gray.600" flexShrink={0}>
                  {formatPoints(points)}
                </Text>
              </Box>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

export default LearnerPointsRanking
