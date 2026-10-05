import { useEffect, useState } from 'react'
import { Box, Button, Flex, Skeleton, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { PILLARS, type PillarKey } from '@/config/liftAssessment'
import { useAuth } from '@/hooks/useAuth'
import { getOwnLiftAssessment, type LiftAssessmentRow } from '@/services/liftAssessmentService'

const PLUM = '#27062e'
const GOLD = '#eab130'
const INK = '#111827'
const BODY = '#374151'
const MUTE = '#6b7280'
const HAIR = '#e5e7eb'
const WASH = '#f8fafc'

const edgeLabel = (key: PillarKey | null) => {
  if (!key) return 'None. Each pillar is 70 or above, so there is no single weak area.'
  return PILLARS.find((pillar) => pillar.key === key)?.name ?? key
}

/**
 * The LIFT result email, shown on the member dashboard in place of the wide course row.
 */
export const LiftDashboardEmail = () => {
  const { user, profile } = useAuth()
  const [row, setRow] = useState<LiftAssessmentRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!user?.uid) {
      setLoading(false)
      return
    }
    setLoading(true)
    getOwnLiftAssessment(user.uid)
      .then((data) => {
        if (active) setRow(data)
      })
      .catch((error) => console.error('[LiftDashboardEmail] load failed', error))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.uid])

  const firstName =
    profile?.firstName?.trim() ||
    profile?.fullName?.trim().split(' ')[0] ||
    'there'

  if (loading) {
    return <Skeleton h="280px" rounded="xl" />
  }

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor={HAIR}
      borderRadius="xl"
      overflow="hidden"
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
    >
      <Box bg={PLUM} color="white" px={{ base: 5, md: 6 }} py={5}>
        <Text fontSize="11px" letterSpacing="0.1em" textTransform="uppercase" opacity={0.8}>
          Transformation Leader
        </Text>
        <Text fontSize="xl" fontWeight="bold" mt={1.5} color="white">
          Your LIFT Index result
        </Text>
        {row ? (
          <Box
            as="span"
            display="inline-block"
            mt={2.5}
            bg={GOLD}
            color={PLUM}
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="0.06em"
            textTransform="uppercase"
            px={2.5}
            py={1.5}
            borderRadius="full"
          >
            {row.archetype}
          </Box>
        ) : null}
      </Box>

      <Box px={{ base: 5, md: 6 }} py={5}>
        <Text color={INK} fontSize="md" fontWeight="semibold" mb={2}>
          Hi {firstName},
        </Text>
        {row ? (
          <>
            <Text color={BODY} fontSize="sm" lineHeight="1.55" mb={4}>
              Here is your LIFT Index profile. Your scores are out of 100. Keep this as a baseline
              for the next 90 days.
            </Text>
            <Box bg={WASH} border="1px solid" borderColor={HAIR} borderRadius="lg" px={4} py={3} mb={4}>
              <Text fontSize="xs" letterSpacing="0.08em" textTransform="uppercase" color={MUTE} fontWeight="bold">
                LIFT Index
              </Text>
              <Text fontSize="4xl" fontWeight="extrabold" color={PLUM} lineHeight="1.1" mt={1}>
                {row.liftIndex}
                <Text as="span" fontSize="md" fontWeight="semibold" color={MUTE}>
                  {' '}
                  / 100
                </Text>
              </Text>
              <Text mt={2} color={BODY} fontSize="sm">
                Growth edge:{' '}
                <Text as="span" fontWeight="bold" color={INK}>
                  {edgeLabel(row.developmentEdge)}
                </Text>
              </Text>
            </Box>
            <Box mb={4}>
              {PILLARS.map((pillar) => (
                <Flex
                  key={pillar.key}
                  justify="space-between"
                  align="center"
                  gap={3}
                  py={2.5}
                  borderBottom="1px solid"
                  borderColor={HAIR}
                >
                  <Text color={INK} fontSize="sm" fontWeight="semibold">
                    {pillar.name}
                  </Text>
                  <Text color={PLUM} fontSize="sm" fontWeight="bold" whiteSpace="nowrap">
                    {row.pillars[pillar.key]} / 100
                  </Text>
                </Flex>
              ))}
            </Box>
          </>
        ) : (
          <Text color={BODY} fontSize="sm" lineHeight="1.55" mb={4}>
            Your LIFT Index result will show here once the assessment is complete.
          </Text>
        )}
        <Button
          as={RouterLink}
          to="/app/lift-results"
          bg={PLUM}
          color="white"
          fontWeight="bold"
          fontSize="sm"
          px={4}
          borderRadius="lg"
          _hover={{ bg: '#3a0a42' }}
        >
          Open your results
        </Button>
      </Box>
    </Box>
  )
}
