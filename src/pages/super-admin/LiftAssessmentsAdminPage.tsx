import React, { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  Center,
  Heading,
  HStack,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react'
import { listLiftAssessments, type LiftAssessmentRow } from '@/services/liftAssessmentService'
import { TIER_OWNERS } from '@/config/liftAssessment'

const tierColor: Record<string, string> = { A: 'red', B: 'purple', C: 'green' }

export const LiftAssessmentsAdminPage: React.FC = () => {
  const [rows, setRows] = useState<LiftAssessmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listLiftAssessments()
      .then((data) => active && setRows(data))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <Center py={20}>
        <Spinner size="lg" color="purple.500" />
      </Center>
    )
  }

  return (
    <Box>
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <Heading size="lg" color="brand.deepPlum">
            LIFT Assessments
          </Heading>
          <Badge fontSize="md" colorScheme="purple">
            {rows.length} completed
          </Badge>
        </HStack>

        {error && <Text color="red.500">{error}</Text>}

        <TableContainer bg="white" borderRadius="xl" borderWidth="1px">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th isNumeric>LIFT</Th>
                <Th isNumeric>L</Th>
                <Th isNumeric>I</Th>
                <Th isNumeric>F</Th>
                <Th isNumeric>T</Th>
                <Th>Archetype</Th>
                <Th>Edge</Th>
                <Th>Tier (owner)</Th>
                <Th>Coaching</Th>
                <Th>Date</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <Tr key={r.uid}>
                  <Td>{r.fullName ?? '-'}</Td>
                  <Td>{r.email ?? '-'}</Td>
                  <Td isNumeric fontWeight="bold">
                    {r.liftIndex}
                  </Td>
                  <Td isNumeric>{r.pillars.L}</Td>
                  <Td isNumeric>{r.pillars.I}</Td>
                  <Td isNumeric>{r.pillars.F}</Td>
                  <Td isNumeric>{r.pillars.T}</Td>
                  <Td>{r.archetype}</Td>
                  <Td>{r.developmentEdge ?? '-'}</Td>
                  <Td>
                    <Badge colorScheme={tierColor[r.leadTier] ?? 'gray'}>
                      {r.leadTier} · {TIER_OWNERS[r.leadTier]}
                    </Badge>
                  </Td>
                  <Td>{r.coachingTriggered ? 'Yes' : 'No'}</Td>
                  <Td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}</Td>
                </Tr>
              ))}
              {rows.length === 0 && (
                <Tr>
                  <Td colSpan={12}>
                    <Text textAlign="center" py={6} color="gray.400">
                      No assessments completed yet.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </VStack>
    </Box>
  )
}

export default LiftAssessmentsAdminPage
