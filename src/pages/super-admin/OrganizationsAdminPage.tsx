import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
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
  useToast,
  VStack,
} from '@chakra-ui/react'
import {
  assignPartnerToOrg,
  createOrganization,
  listOrganizations,
  listPartnerCandidates,
  removePartnerFromOrg,
  type OrgRecord,
  type PartnerCandidate,
} from '@/services/supabaseOrgService'

export const OrganizationsAdminPage: React.FC = () => {
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const [orgs, setOrgs] = useState<OrgRecord[]>([])
  const [candidates, setCandidates] = useState<PartnerCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // create form
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  // assign modal
  const [activeOrg, setActiveOrg] = useState<OrgRecord | null>(null)
  const [selectedPartner, setSelectedPartner] = useState('')

  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates],
  )
  const orgCountByPartner = useMemo(() => {
    const m = new Map<string, number>()
    orgs.forEach((o) => {
      if (o.transformationPartnerId) {
        m.set(o.transformationPartnerId, (m.get(o.transformationPartnerId) ?? 0) + 1)
      }
    })
    return m
  }, [orgs])

  const refresh = async () => {
    setLoading(true)
    try {
      const [o, c] = await Promise.all([listOrganizations(), listPartnerCandidates()])
      setOrgs(o)
      setCandidates(c)
    } catch (error) {
      toast({ title: 'Failed to load', description: (error as Error).message, status: 'error', duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) {
      toast({ title: 'Name and code are required', status: 'warning', duration: 3000 })
      return
    }
    setBusy(true)
    try {
      await createOrganization({ name, code })
      toast({ title: 'Organization created', status: 'success', duration: 3000 })
      setName('')
      setCode('')
      await refresh()
    } catch (error) {
      toast({ title: 'Create failed', description: (error as Error).message, status: 'error', duration: 5000 })
    } finally {
      setBusy(false)
    }
  }

  const openAssign = (org: OrgRecord) => {
    setActiveOrg(org)
    setSelectedPartner(org.transformationPartnerId ?? '')
    onOpen()
  }

  const handleAssign = async () => {
    if (!activeOrg || !selectedPartner) return
    setBusy(true)
    try {
      await assignPartnerToOrg(activeOrg.id, selectedPartner)
      toast({ title: 'Partner assigned', status: 'success', duration: 3000 })
      onClose()
      await refresh()
    } catch (error) {
      toast({ title: 'Assignment failed', description: (error as Error).message, status: 'error', duration: 5000 })
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (org: OrgRecord) => {
    setBusy(true)
    try {
      await removePartnerFromOrg(org.id)
      toast({ title: 'Partner removed', status: 'info', duration: 2500 })
      await refresh()
    } catch (error) {
      toast({ title: 'Removal failed', description: (error as Error).message, status: 'error', duration: 5000 })
    } finally {
      setBusy(false)
    }
  }

  const partnerLabel = (uid: string | null): string => {
    if (!uid) return '-'
    const c = candidateById.get(uid)
    const base = c?.fullName || c?.email || uid
    const count = orgCountByPartner.get(uid) ?? 0
    return count > 1 ? `${base} (${count} orgs)` : base
  }

  if (loading) {
    return (
      <Center py={20}>
        <Spinner size="lg" color="purple.500" />
      </Center>
    )
  }

  return (
    <Box>
      <VStack align="stretch" spacing={6}>
        <Heading size="lg" color="brand.deepPlum">
          Organizations
        </Heading>

        {/* Create */}
        <Box bg="white" borderWidth="1px" borderRadius="xl" p={5}>
          <Heading size="sm" mb={3}>
            Create organization
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <FormControl>
              <FormLabel fontSize="sm">Name</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Code</FormLabel>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ACME2026" />
            </FormControl>
            <FormControl display="flex" alignItems="flex-end">
              <Button colorScheme="purple" onClick={handleCreate} isLoading={busy} w="full">
                Create
              </Button>
            </FormControl>
          </SimpleGrid>
        </Box>

        <Divider />

        {/* List */}
        <TableContainer bg="white" borderWidth="1px" borderRadius="xl">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Code</Th>
                <Th>Members</Th>
                <Th>Partner</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {orgs.map((org) => (
                <Tr key={org.id}>
                  <Td>{org.name ?? '-'}</Td>
                  <Td>
                    <Badge>{org.code ?? '-'}</Badge>
                  </Td>
                  <Td>{org.memberCount}</Td>
                  <Td>{partnerLabel(org.transformationPartnerId)}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button size="xs" colorScheme="purple" variant="outline" onClick={() => openAssign(org)}>
                        {org.transformationPartnerId ? 'Change partner' : 'Assign partner'}
                      </Button>
                      {org.transformationPartnerId && (
                        <Button size="xs" variant="ghost" colorScheme="red" onClick={() => handleRemove(org)} isDisabled={busy}>
                          Remove
                        </Button>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
              {orgs.length === 0 && (
                <Tr>
                  <Td colSpan={5}>
                    <Text textAlign="center" py={6} color="gray.400">
                      No organizations yet. Create one above.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </VStack>

      {/* Assign partner modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Assign partner to {activeOrg?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.500" mb={3}>
              The selected user becomes a partner (if not already) and this organization is added to the
              organizations they manage. A partner can manage one or many organizations.
            </Text>
            <Select
              placeholder="Select a user..."
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.fullName || c.email || c.id)}
                  {c.role ? ` - ${c.role}` : ''}
                </option>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleAssign} isLoading={busy} isDisabled={!selectedPartner}>
              Assign
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default OrganizationsAdminPage
