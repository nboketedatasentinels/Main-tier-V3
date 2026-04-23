import React, { useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Center,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Select,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { CheckCircle2, MessageSquare, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { submitFeedback, type FeedbackCategory } from '@/services/feedbackService'
import { getDisplayName } from '@/utils/displayName'

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string; helper: string }> = [
  { value: 'general', label: 'General feedback', helper: 'A thought, idea, or observation.' },
  { value: 'bug', label: 'Report a bug', helper: 'Something looks or behaves wrong.' },
  { value: 'feature_request', label: 'Feature request', helper: "Something you'd love to see." },
  { value: 'appreciation', label: 'Appreciation', helper: 'Tell us what you love.' },
]

export const FeedbackPage: React.FC = () => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null)

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed) {
      toast({ title: 'Add a short message before sending', status: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      await submitFeedback({
        userId: user?.uid ?? null,
        userEmail: profile?.email ?? null,
        userName: profile ? getDisplayName(profile, 'Learner') : null,
        category,
        message: trimmed,
        pageContext: typeof window !== 'undefined' ? window.location.pathname : null,
      })
      setSubmittedAt(new Date())
      setMessage('')
      setCategory('general')
      toast({ title: 'Thanks — feedback received', status: 'success' })
    } catch (err) {
      console.error('[FeedbackPage] submit failed', err)
      toast({
        title: 'Could not send feedback',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        status: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack spacing={6} pb={10} maxW="2xl">
      <Box bg="white" p={6} borderRadius="3xl" borderWidth={1} borderColor="brand.border" boxShadow="sm">
        <Stack spacing={2}>
          <HStack spacing={2} color="purple.600">
            <Icon as={MessageSquare} boxSize={5} />
            <Text fontSize="xs" fontWeight="bold" letterSpacing="widest">
              FEEDBACK
            </Text>
          </HStack>
          <Heading size="lg" color="brand.text">
            Tell us what you think
          </Heading>
          <Text color="brand.subtleText" fontSize="md">
            Every note helps us shape the platform. Bugs, wishlist items, or kind words — all
            welcome.
          </Text>
        </Stack>
      </Box>

      {submittedAt && (
        <Alert status="success" borderRadius="xl" borderWidth={1} borderColor="green.100" bg="green.50">
          <AlertIcon as={CheckCircle2} />
          <AlertDescription fontSize="sm" color="green.800">
            Feedback sent. You can send another any time.
          </AlertDescription>
        </Alert>
      )}

      <Box borderWidth={1} borderColor="border.subtle" bg="surface.default" borderRadius="3xl" p={{ base: 5, md: 6 }} boxShadow="sm">
        <Stack spacing={4}>
          <FormControl>
            <FormLabel fontSize="sm">Category</FormLabel>
            <Select value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <FormHelperText>
              {CATEGORY_OPTIONS.find((option) => option.value === category)?.helper}
            </FormHelperText>
          </FormControl>

          <FormControl isRequired>
            <FormLabel fontSize="sm">Message</FormLabel>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind — what worked, what didn't, what you'd love to see next."
              rows={6}
              resize="vertical"
            />
          </FormControl>

          <Center justifyContent="flex-end">
            <Button
              colorScheme="purple"
              leftIcon={<Icon as={Send} boxSize={4} />}
              onClick={handleSubmit}
              isLoading={submitting}
              isDisabled={!message.trim()}
            >
              Send feedback
            </Button>
          </Center>
        </Stack>
      </Box>
    </Stack>
  )
}

export default FeedbackPage
