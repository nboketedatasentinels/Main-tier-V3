import React, { useMemo } from 'react'
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { getDisplayName } from '@/utils/displayName'
import type { UserProfile } from '@/types'

type LearnerPointsRankingProps = {
  learners: UserProfile[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Eyebrow label shown above the list */
  title?: string
  /** When false, the card does not stick while scrolling (e.g. overview stack). */
  sticky?: boolean
  /** Cap visible rows (rest behind See more). */
  limit?: number
  /** Called when the user wants the full ranking (e.g. jump to mentees tab). */
  onSeeMore?: () => void
  seeMoreLabel?: string
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
  sticky = true,
  limit,
  onSeeMore,
  seeMoreLabel = 'See more',
}) => {
  const ranked = useMemo(
    () =>
      [...learners].sort(
        (a, b) =>
          (b.totalPoints ?? 0) - (a.totalPoints ?? 0) ||
          getDisplayName(a).localeCompare(getDisplayName(b)),
      ),
    [learners],
  )

  const visible =
    typeof limit === 'number' && limit > 0 ? ranked.slice(0, limit) : ranked
  const hiddenCount = Math.max(0, ranked.length - visible.length)

  return (
    <Box
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.200"
      p={4}
      h="fit-content"
      position={sticky ? { lg: 'sticky' } : undefined}
      top={sticky ? { lg: '96px' } : undefined}
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
        {ranked.length > 0 ? ` · ${ranked.length} learners` : ''}
      </Text>

      {ranked.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          No learners to rank yet.
        </Text>
      ) : (
        <Stack
          spacing={1.5}
          maxH={
            typeof limit === 'number'
              ? undefined
              : { base: '320px', lg: 'calc(100vh - 180px)' }
          }
          overflowY={typeof limit === 'number' ? 'visible' : 'auto'}
        >
          {visible.map((learner, index) => {
            const id = learner.id ?? ''
            const active = Boolean(id && selectedId === id)
            const points = learner.totalPoints ?? 0
            const rank = index + 1

            const row = (
              <>
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
              </>
            )

            const rowStyles = {
              w: 'full' as const,
              display: 'flex' as const,
              alignItems: 'center' as const,
              justifyContent: 'space-between' as const,
              gap: 2,
              px: 2.5,
              py: 2,
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: active ? '#350e6f' : 'transparent',
              bg: active ? 'rgba(53,14,111,0.06)' : 'transparent',
              textAlign: 'left' as const,
            }

            if (onSelect && id) {
              return (
                <Box
                  key={id || `${getDisplayName(learner)}-${rank}`}
                  as="button"
                  type="button"
                  onClick={() => onSelect(id)}
                  cursor="pointer"
                  _hover={{ bg: active ? 'rgba(53,14,111,0.08)' : 'gray.50' }}
                  {...rowStyles}
                >
                  {row}
                </Box>
              )
            }

            return (
              <Box key={id || `${getDisplayName(learner)}-${rank}`} {...rowStyles}>
                {row}
              </Box>
            )
          })}
        </Stack>
      )}

      {hiddenCount > 0 && onSeeMore ? (
        <Button mt={3} size="sm" variant="ghost" color="#350e6f" w="full" onClick={onSeeMore}>
          {seeMoreLabel} ({hiddenCount} more)
        </Button>
      ) : null}
    </Box>
  )
}

export default LearnerPointsRanking
