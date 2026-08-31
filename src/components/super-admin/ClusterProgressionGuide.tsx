import React from 'react'
import {
  Badge,
  Box,
  Flex,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react'
import {
  clusterBoundaries,
  clusterTiers,
  getClusterDisplayName,
  getClusterTierByName,
  type ClusterTier,
} from '@/utils/clusterTiers'

/** Visual scale for the progression bar. Must stay in sync with thumb math. */
export const CLUSTER_PROGRESS_MAX = 50

type SegmentLayout = {
  leftPercent: number
  widthPercent: number
  centerPercent: number
}

/**
 * Map a cohort size onto the 0 - CLUSTER_PROGRESS_MAX bar.
 * Tier N occupies ((min-1) / max) → (tierMax / max) so a size of 40 sits at
 * the end of Sahel (80%), and 41 begins Serengeti.
 */
export const getClusterSegmentLayout = (
  tier: ClusterTier,
  progressMax = CLUSTER_PROGRESS_MAX,
): SegmentLayout => {
  const rangeStart = Math.max(tier.min, 1)
  const rangeEnd = Math.min(tier.max ?? progressMax, progressMax)
  const leftPercent = ((rangeStart - 1) / progressMax) * 100
  const widthPercent = Math.max(((rangeEnd - (rangeStart - 1)) / progressMax) * 100, 0)
  return {
    leftPercent,
    widthPercent,
    centerPercent: leftPercent + widthPercent / 2,
  }
}

export const getClusterProgressPercent = (
  teamSize: number,
  progressMax = CLUSTER_PROGRESS_MAX,
) => {
  if (!teamSize || teamSize < 1) return 0
  return (Math.min(teamSize, progressMax) / progressMax) * 100
}

type Props = {
  teamSize: number
  clusterName?: string
}

/**
 * Cluster reference table + progression bar. Labels/markers/thumb all share the
 * same cohort-size scale so a size of 40 clearly lands in Sahel (21-40).
 */
export const ClusterProgressionGuide: React.FC<Props> = ({ teamSize, clusterName }) => {
  const displayName = getClusterDisplayName(clusterName)
  const activeTier = getClusterTierByName(clusterName)
  const highlightBg = `${activeTier.colorScheme}.50`
  const hasValidTeamSize = teamSize > 0
  const progressPercent = getClusterProgressPercent(teamSize)

  return (
    <Box>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Cluster Name</Th>
            <Th>Cohort Size Range</Th>
            <Th>Color Badge</Th>
          </Tr>
        </Thead>
        <Tbody>
          {clusterTiers.map((tier) => (
            <Tr key={tier.name} bg={tier.name === displayName ? highlightBg : 'transparent'}>
              <Td>{tier.shortName}</Td>
              <Td>{tier.rangeLabel} users</Td>
              <Td>
                <Badge colorScheme={tier.colorScheme} variant="subtle">
                  {tier.shortName}
                </Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Box mt={4}>
        <HStack justify="space-between" mb={2} align="center">
          <Text fontSize="sm" fontWeight="semibold">
            Cluster progression
          </Text>
          {hasValidTeamSize ? (
            <Badge colorScheme={activeTier.colorScheme} variant="subtle">
              {teamSize} users · {activeTier.shortName}
            </Badge>
          ) : null}
        </HStack>

        <Box position="relative" h="10px" bg="gray.200" borderRadius="full" mb="28px">
          <Flex h="100%" borderRadius="full" overflow="hidden">
            {clusterTiers.map((tier) => {
              const { widthPercent } = getClusterSegmentLayout(tier)
              return (
                <Box
                  key={tier.name}
                  w={`${widthPercent}%`}
                  bg={`${tier.colorScheme}.400`}
                  opacity={tier.name === displayName ? 1 : 0.55}
                />
              )
            })}
          </Flex>

          {clusterBoundaries.map((boundary) => {
            // Boundary marks where that tier begins: user N sits at N/max.
            const left = `${(boundary / CLUSTER_PROGRESS_MAX) * 100}%`
            const boundaryTierName =
              clusterTiers.find((tier) => tier.min === boundary)?.shortName ?? 'New tier'
            return (
              <Tooltip
                key={boundary}
                label={`${boundary} users: ${boundaryTierName} begins`}
                placement="top"
              >
                <Box
                  position="absolute"
                  top="-4px"
                  left={left}
                  transform="translateX(-50%)"
                  w="2px"
                  h="18px"
                  bg="gray.600"
                />
              </Tooltip>
            )
          })}

          {hasValidTeamSize ? (
            <Tooltip label={`${teamSize} users · ${activeTier.shortName}`} placement="top">
              <Box
                position="absolute"
                top="-7px"
                left={`${progressPercent}%`}
                transform="translateX(-50%)"
                w="18px"
                h="18px"
                bg="white"
                borderWidth="2px"
                borderColor={`${activeTier.colorScheme}.500`}
                borderRadius="full"
                zIndex={1}
              />
            </Tooltip>
          ) : null}

          {clusterTiers.map((tier) => {
            const { centerPercent } = getClusterSegmentLayout(tier)
            const isActive = tier.name === displayName
            return (
              <Text
                key={`label-${tier.name}`}
                position="absolute"
                top="16px"
                left={`${centerPercent}%`}
                transform="translateX(-50%)"
                fontSize="xs"
                fontWeight={isActive ? 'bold' : 'normal'}
                color={isActive ? `${tier.colorScheme}.700` : 'gray.600'}
                whiteSpace="nowrap"
              >
                {tier.shortName}
              </Text>
            )
          })}
        </Box>

        <Box position="relative" h="16px" fontSize="xs" color="gray.500" mt={6}>
          <Text position="absolute" left="0">
            1
          </Text>
          {clusterBoundaries.map((boundary) => (
            <Text
              key={`mark-${boundary}`}
              position="absolute"
              left={`${(boundary / CLUSTER_PROGRESS_MAX) * 100}%`}
              transform="translateX(-50%)"
            >
              {boundary === 41 ? '41+' : boundary}
            </Text>
          ))}
          <Text position="absolute" right="0">
            {CLUSTER_PROGRESS_MAX}+
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
