import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  Select,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { Send } from 'lucide-react'
import {
  AUDIENCE_LABELS,
  countAudience,
  sendAdminBroadcast,
  type MessageAudience,
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

  // Show how many people the chosen audience will reach.
  useEffect(() => {
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
  }, [audience])

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Add a title and a message', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSending(true)
    try {
      const { sent } = await sendAdminBroadcast({ audience, title, message, senderName: adminName })
      if (sent === 0) {
        toast({
          title: 'No recipients',
          description: `There are no ${AUDIENCE_LABELS[audience].toLowerCase()} to notify right now.`,
          status: 'info',
          duration: 5000,
          isClosable: true,
        })
      } else {
        toast({
          title: 'Message sent',
          description: `Notification delivered to ${sent} recipient${sent === 1 ? '' : 's'}.`,
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
          Send an in-app notification to partners or learners. It appears in each
          recipient&apos;s notification bell.
        </Text>
      </Box>

      <Card maxW="720px" borderRadius="2xl" boxShadow="card" border="1px solid" borderColor="border.card">
        <CardBody>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Send to</FormLabel>
              <Select value={audience} onChange={(e) => setAudience(e.target.value as MessageAudience)}>
                <option value="partners">All partners</option>
                <option value="learners">All learners</option>
                <option value="everyone">All partners &amp; learners</option>
              </Select>
              <Text fontSize="sm" color="text.secondary" mt={1}>
                {recipientCount === null
                  ? 'Counting recipients…'
                  : `${recipientCount} recipient${recipientCount === 1 ? '' : 's'} will receive this.`}
              </Text>
            </FormControl>

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
                isDisabled={recipientCount === 0}
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
