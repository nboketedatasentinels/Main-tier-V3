import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { Search, Send } from 'lucide-react'
import {
  AUDIENCE_LABELS,
  countAudience,
  searchRecipients,
  sendAdminBroadcast,
  type MessageAudience,
  type RecipientOption,
} from '@/services/adminMessagingService'

interface AdminMessagingPageProps {
  adminName?: string | null
}

export const AdminMessagingPage: React.FC<AdminMessagingPageProps> = ({ adminName }) => {
  const toast = useToast()
  const [audience, setAudience] = useState<MessageAudience>('partners')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)

  // "Specific person" mode state.
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<RecipientOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<RecipientOption | null>(null)

  const isIndividual = audience === 'individual'

  // Show how many people a group audience will reach.
  useEffect(() => {
    if (isIndividual) {
      setRecipientCount(null)
      return
    }
    let cancelled = false
    setRecipientCount(null)
    countAudience(audience)
      .then((count) => {
        if (!cancelled) setRecipientCount(count)
      })
      .catch(() => {
        if (!cancelled) setRecipientCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [audience, isIndividual])

  // Debounced recipient search for the "specific person" mode.
  useEffect(() => {
    if (!isIndividual) return
    let cancelled = false
    setSearching(true)
    const handle = setTimeout(() => {
      searchRecipients(search)
        .then((rows) => {
          if (!cancelled) setResults(rows)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [search, isIndividual])

  const roleLabel = (role: string) =>
    role === 'partner' ? 'Partner' : role === 'paid_member' ? 'Member' : 'Learner'

  const canSend = useMemo(() => {
    if (!title.trim() || !message.trim()) return false
    if (isIndividual) return Boolean(selected)
    return recipientCount !== 0
  }, [title, message, isIndividual, selected, recipientCount])

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Add a title and a message', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    if (isIndividual && !selected) {
      toast({ title: 'Choose who to message', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSending(true)
    try {
      const { sent } = await sendAdminBroadcast({
        audience,
        title,
        message,
        senderName: adminName,
        recipientId: selected?.id ?? null,
      })
      if (sent === 0) {
        toast({
          title: 'No recipients',
          description: isIndividual
            ? 'That person could not be reached.'
            : `There are no ${AUDIENCE_LABELS[audience].toLowerCase()} to notify right now.`,
          status: 'info',
          duration: 5000,
          isClosable: true,
        })
      } else {
        toast({
          title: 'Message sent',
          description: isIndividual
            ? `Notification delivered to ${selected?.name}.`
            : `Notification delivered to ${sent} recipient${sent === 1 ? '' : 's'}.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        })
        setTitle('')
        setMessage('')
      }
    } catch (err) {
      toast({
        title: 'Could not send',
        description: err instanceof Error ? err.message : 'Please try again.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Stack spacing={6}>
      <Box>
        <Heading size="lg">Messaging</Heading>
        <Text color="text.secondary">
          Send an in-app notification to partners, learners, or one specific person. It
          appears in each recipient&apos;s notification bell.
        </Text>
      </Box>

      <Card maxW="720px" borderRadius="2xl" boxShadow="card" border="1px solid" borderColor="border.card">
        <CardBody>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Send to</FormLabel>
              <Select
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value as MessageAudience)
                  setSelected(null)
                }}
              >
                <option value="partners">All partners</option>
                <option value="learners">All learners</option>
                <option value="everyone">All partners &amp; learners</option>
                <option value="individual">A specific person…</option>
              </Select>
              {!isIndividual && (
                <Text fontSize="sm" color="text.secondary" mt={1}>
                  {recipientCount === null
                    ? 'Counting recipients…'
                    : `${recipientCount} recipient${recipientCount === 1 ? '' : 's'} will receive this.`}
                </Text>
              )}
            </FormControl>

            {isIndividual && (
              <FormControl isRequired>
                <FormLabel>Recipient</FormLabel>
                {selected ? (
                  <Flex
                    align="center"
                    justify="space-between"
                    borderWidth="1px"
                    borderColor="border.card"
                    borderRadius="lg"
                    px={3}
                    py={2}
                  >
                    <HStack spacing={2} minW={0}>
                      <Text fontWeight="medium" noOfLines={1}>
                        {selected.name}
                      </Text>
                      <Badge colorScheme={selected.role === 'partner' ? 'purple' : 'blue'}>
                        {roleLabel(selected.role)}
                      </Badge>
                      {selected.email && (
                        <Text fontSize="sm" color="text.secondary" noOfLines={1}>
                          {selected.email}
                        </Text>
                      )}
                    </HStack>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                      Change
                    </Button>
                  </Flex>
                ) : (
                  <>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Search size={16} />
                      </InputLeftElement>
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search partners or learners by name or email…"
                      />
                    </InputGroup>
                    <Box
                      mt={2}
                      borderWidth="1px"
                      borderColor="border.card"
                      borderRadius="lg"
                      maxH="240px"
                      overflowY="auto"
                    >
                      {searching ? (
                        <HStack px={3} py={3} color="text.secondary">
                          <Spinner size="sm" />
                          <Text fontSize="sm">Searching…</Text>
                        </HStack>
                      ) : results.length === 0 ? (
                        <Text px={3} py={3} fontSize="sm" color="text.secondary">
                          No matching partners or learners.
                        </Text>
                      ) : (
                        results.map((r) => (
                          <Flex
                            key={r.id}
                            align="center"
                            justify="space-between"
                            px={3}
                            py={2}
                            cursor="pointer"
                            _hover={{ bg: 'brand.primaryMuted' }}
                            onClick={() => setSelected(r)}
                          >
                            <HStack spacing={2} minW={0}>
                              <Text fontWeight="medium" noOfLines={1}>
                                {r.name}
                              </Text>
                              {r.email && (
                                <Text fontSize="sm" color="text.secondary" noOfLines={1}>
                                  {r.email}
                                </Text>
                              )}
                            </HStack>
                            <Badge colorScheme={r.role === 'partner' ? 'purple' : 'blue'}>
                              {roleLabel(r.role)}
                            </Badge>
                          </Flex>
                        ))
                      )}
                    </Box>
                  </>
                )}
              </FormControl>
            )}

            <FormControl isRequired>
              <FormLabel>Title</FormLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Platform maintenance this weekend"
                maxLength={120}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Message</FormLabel>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the message your recipients will see…"
                rows={5}
                maxLength={1000}
              />
            </FormControl>

            <HStack justify="flex-end">
              <Button
                leftIcon={<Send size={16} />}
                colorScheme="purple"
                onClick={handleSend}
                isLoading={sending}
                loadingText="Sending"
                isDisabled={!canSend}
              >
                Send notification
              </Button>
            </HStack>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}

export default AdminMessagingPage
