import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
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
  Stack,
  Textarea,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import { InfoIcon } from '@chakra-ui/icons'
import { fetchPartners } from '@/services/organizationService'
import { OrganizationLead, OrganizationRecord } from '@/types/admin'

type Mode = 'create' | 'edit'

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: OrganizationRecord | null
  onSubmit: (data: OrganizationRecord) => Promise<void>
  mode?: Mode
  partners?: OrganizationLead[]
}

const defaultOrg: OrganizationRecord = {
  name: '',
  code: '',
  status: 'pending',
  teamSize: 10,
  village: '',
  cluster: '',
  programStart: '',
  programEnd: '',
  assignmentCount: 0,
  transformationPartnerId: null,
}

export const OrganizationFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  mode = 'create',
  partners: partnersProp = [],
}) => {
  const [form, setForm] = useState<OrganizationRecord>(initialData || defaultOrg)
  const [isSubmitting, setSubmitting] = useState(false)
  const [partners, setPartners] = useState<OrganizationLead[]>(partnersProp)
  const [isLoadingPartners, setIsLoadingPartners] = useState(false)
  const [partnersError, setPartnersError] = useState<string | null>(null)
  const [partnerSearch, setPartnerSearch] = useState('')
  const toast = useToast()
  const codeLength = form.code.trim().length
  const isCodeValidLength = codeLength === 6

  useEffect(() => {
    setForm(initialData || defaultOrg)
  }, [initialData])

  useEffect(() => {
    setPartners(partnersProp)
  }, [partnersProp])

  useEffect(() => {
    if (!isOpen) return

    const loadPartners = async () => {
      setIsLoadingPartners(true)
      setPartnersError(null)
      try {
        const partnerOptions = await fetchPartners()
        setPartners(partnerOptions)
      } catch (error) {
        console.error(error)
        setPartnersError('Unable to load partners.')
        toast({ title: 'Unable to load partners', status: 'error' })
      } finally {
        setIsLoadingPartners(false)
      }
    }

    loadPartners()
  }, [isOpen, toast])

  const handleChange = (key: keyof OrganizationRecord, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const sortedPartners = useMemo(
    () => [...partners].sort((a, b) => a.name.localeCompare(b.name)),
    [partners],
  )

  const filteredPartners = useMemo(() => {
    const term = partnerSearch.trim().toLowerCase()
    if (!term) return sortedPartners
    return sortedPartners.filter((item) => {
      const email = item.email?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(term) || email.includes(term)
    })
  }, [partnerSearch, sortedPartners])

  const selectedPartnerId = form.transformationPartnerId || ''

  const buildPartnerLabel = (item: OrganizationLead) => {
    const emailSuffix = item.email ? ` — ${item.email}` : ''
    return `${item.name}${emailSuffix}`
  }

  const handleSubmit = async () => {
    if (!form.name || !form.code) {
      toast({ title: 'Name and code are required', status: 'warning' })
      return
    }
    if (!isCodeValidLength) {
      toast({ title: 'Organization code must be exactly 6 characters', status: 'warning' })
      return
    }

    try {
      setSubmitting(true)
      await onSubmit(form)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{mode === 'create' ? 'Create organization' : 'Edit organization'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <HStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Organization name</FormLabel>
                <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Acme Corp" />
              </FormControl>
              <FormControl isRequired isInvalid={codeLength > 0 && !isCodeValidLength}>
                <FormLabel display="flex" alignItems="center" gap={2}>
                  Organization code
                  <Tooltip label="6-character code: 2-letter prefix + 4 random characters." placement="top">
                    <InfoIcon color="text.muted" />
                  </Tooltip>
                </FormLabel>
                <Input
                  value={form.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="6-char code"
                  maxLength={6}
                  textTransform="uppercase"
                />
                <FormHelperText color={isCodeValidLength ? 'green.500' : 'gray.600'}>
                  {codeLength}/6 characters
                </FormHelperText>
                <FormErrorMessage>Organization code must be exactly 6 characters.</FormErrorMessage>
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Team size limit</FormLabel>
                <Input type="number" value={form.teamSize ?? 0} onChange={(e) => handleChange('teamSize', Number(e.target.value))} />
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="watch">Watch</option>
                </Select>
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Village</FormLabel>
                <Input value={form.village || ''} onChange={(e) => handleChange('village', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Cluster</FormLabel>
                <Input value={form.cluster || ''} onChange={(e) => handleChange('cluster', e.target.value)} />
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Program start</FormLabel>
                <Input type="date" value={form.programStart || ''} onChange={(e) => handleChange('programStart', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Program end</FormLabel>
                <Input type="date" value={form.programEnd || ''} onChange={(e) => handleChange('programEnd', e.target.value)} />
              </FormControl>
            </HStack>

            <FormControl>
              <FormLabel>Transformation partner</FormLabel>
              <Input
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                placeholder="Search partners"
                mb={2}
              />
              <Select
                value={selectedPartnerId}
                onChange={(e) => {
                  const selectedId = e.target.value
                  handleChange('transformationPartnerId', selectedId || null)
                }}
                placeholder="Select partner"
                isDisabled={isLoadingPartners}
              >
                <option value="">— No partner —</option>
                {filteredPartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {buildPartnerLabel(partner)}
                  </option>
                ))}
              </Select>
              {isLoadingPartners ? (
                <FormHelperText>Loading partners...</FormHelperText>
              ) : null}
              {partnersError ? <FormHelperText color="red.500">{partnersError}</FormHelperText> : null}
              {!isLoadingPartners && !partnersError && !filteredPartners.length ? (
                <FormHelperText color="gray.600">No partners available.</FormHelperText>
              ) : null}
            </FormControl>

            <FormControl>
              <FormLabel>Bulk email invite (CSV or manual)</FormLabel>
              <Stack spacing={2}>
                <Input type="file" accept=".csv" />
                <Textarea placeholder="email1@example.com, email2@example.com" rows={3} />
              </Stack>
            </FormControl>

            <Box fontSize="sm" color="gray.600">
              Add member emails now or upload later. Invites will be tracked in the admin activity log.
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleSubmit} isLoading={isSubmitting}>
            {mode === 'create' ? 'Create organization' : 'Save changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
