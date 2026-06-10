import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { listLiftAssessments, type LiftAssessmentRow } from '@/services/liftAssessmentService'
import { TIER_OWNERS, ITEMS, SCALE, INTAKE_FIELDS, PILLARS, type PillarKey } from '@/config/liftAssessment'

const tierColor: Record<string, string> = { A: 'red', B: 'purple', C: 'green' }

const intakeLabel = (fieldId: string, value: string | undefined): string => {
  if (!value) return '-'
  const field = INTAKE_FIELDS.find((f) => f.id === fieldId)
  return field?.options.find((o) => o.value === value)?.label ?? value
}

const AnswersModal: React.FC<{ row: LiftAssessmentRow | null; isOpen: boolean; onClose: () => void }> = ({
  row,
  isOpen,
  onClose,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isCentered>
    <ModalOverlay />
    <ModalContent>
      {row && (
        <>
          <ModalHeader color="brand.deepPlum">
            <Text>{row.fullName ?? row.email ?? 'Learner'}</Text>
            <HStack mt={1} spacing={2} flexWrap="wrap">
              <Badge colorScheme="purple">{row.archetype}</Badge>
              <Badge>LIFT {row.liftIndex}</Badge>
              <Badge colorScheme={tierColor[row.leadTier] ?? 'gray'}>
                Tier {row.leadTier} · {TIER_OWNERS[row.leadTier]}
              </Badge>
              {row.coachingTriggered && <Badge colorScheme="orange">Coaching flagged</Badge>}
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {/* Intake */}
            <Text fontSize="sm" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="0.06em" mb={2}>
              About them
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3} mb={5}>
              {INTAKE_FIELDS.map((f) => (
                <Box key={f.id} borderWidth="1px" borderRadius="lg" px={3} py={2}>
                  <Text fontSize="xs" color="gray.500">
                    {f.label}
                  </Text>
                  <Text fontSize="sm" fontWeight="medium">
                    {intakeLabel(f.id, row.intake[f.id])}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>

            <Divider mb={4} />

            {/* Answers grouped by pillar */}
            {PILLARS.map((pillar) => {
              const items = ITEMS.filter((i) => i.pillar === pillar.key)
              return (
                <Box key={pillar.key} mb={5}>
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="bold" color="brand.deepPlum">
                      {pillar.name}
                    </Text>
                    <Badge colorScheme="purple">{row.pillars[pillar.key as PillarKey]} / 100</Badge>
                  </HStack>
                  <VStack align="stretch" spacing={2}>
                    {items.map((item) => {
                      const score = row.itemScores[item.id]
                      const answer = typeof score === 'number' ? SCALE.labels[score] : '-'
                      return (
                        <HStack
                          key={item.id}
                          justify="space-between"
                          align="start"
                          borderWidth="1px"
                          borderRadius="md"
                          px={3}
                          py={2}
                          spacing={4}
                        >
                          <Text fontSize="sm">{item.text}</Text>
                          <Badge flexShrink={0} colorScheme={typeof score === 'number' && score >= 3 ? 'green' : score === 2 ? 'gray' : 'orange'}>
                            {answer}
                          </Badge>
                        </HStack>
                      )
                    })}
                  </VStack>
                </Box>
              )
            })}
          </ModalBody>
        </>
      )}
    </ModalContent>
  </Modal>
)

export const LiftAssessmentsAdminPage: React.FC = () => {
  const [rows, setRows] = useState<LiftAssessmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<LiftAssessmentRow | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

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

  const openAnswers = (row: LiftAssessmentRow) => {
    setSelected(row)
    onOpen()
  }

  const sorted = useMemo(() => rows, [rows])

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
                <Th>Category</Th>
                <Th isNumeric>LIFT</Th>
                <Th isNumeric>L</Th>
                <Th isNumeric>I</Th>
                <Th isNumeric>F</Th>
                <Th isNumeric>T</Th>
                <Th>Edge</Th>
                <Th>Tier (owner)</Th>
                <Th>Coaching</Th>
                <Th>Date</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {sorted.map((r) => (
                <Tr key={r.uid} _hover={{ bg: 'gray.50' }}>
                  <Td>{r.fullName ?? '-'}</Td>
                  <Td>{r.email ?? '-'}</Td>
                  <Td>
                    <Badge colorScheme="purple">{r.archetype}</Badge>
                  </Td>
                  <Td isNumeric fontWeight="bold">
                    {r.liftIndex}
                  </Td>
                  <Td isNumeric>{r.pillars.L}</Td>
                  <Td isNumeric>{r.pillars.I}</Td>
                  <Td isNumeric>{r.pillars.F}</Td>
                  <Td isNumeric>{r.pillars.T}</Td>
                  <Td>{r.developmentEdge ?? '-'}</Td>
                  <Td>
                    <Badge colorScheme={tierColor[r.leadTier] ?? 'gray'}>
                      {r.leadTier} · {TIER_OWNERS[r.leadTier]}
                    </Badge>
                  </Td>
                  <Td>{r.coachingTriggered ? 'Yes' : 'No'}</Td>
                  <Td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}</Td>
                  <Td>
                    <Button size="xs" variant="outline" colorScheme="purple" onClick={() => openAnswers(r)}>
                      View answers
                    </Button>
                  </Td>
                </Tr>
              ))}
              {rows.length === 0 && (
                <Tr>
                  <Td colSpan={13}>
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

      <AnswersModal row={selected} isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}

export default LiftAssessmentsAdminPage
