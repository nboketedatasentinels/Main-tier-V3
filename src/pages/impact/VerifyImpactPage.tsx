import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import {
  approveImpactVerification,
  previewImpactVerification,
  rejectImpactVerification,
  type ImpactVerificationRecord,
} from '@/services/impactVerificationService'

/**
 * Public token page for impact-log verifiers (in or out of org).
 * Linked from the verification email - no login required.
 */
export function VerifyImpactPage() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') || '').trim()
  const decisionHint = (searchParams.get('decision') || '').toLowerCase()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verification, setVerification] = useState<ImpactVerificationRecord | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!token) {
        setError('Missing verification token.')
        setLoading(false)
        return
      }
      try {
        const preview = await previewImpactVerification(token)
        if (!active) return
        setVerification(preview)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Unable to load verification request.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [token])

  const summaryLines = useMemo(() => {
    const summary = verification?.impactSummary
    if (!summary || typeof summary !== 'object') return []
    return Object.entries(summary)
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([key, value]) => `${key}: ${String(value)}`)
  }, [verification])

  const alreadyDone = verification?.status === 'approved' || verification?.status === 'rejected'

  const handleApprove = async () => {
    if (!token || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await approveImpactVerification(token)
      setVerification((prev) =>
        prev
          ? { ...prev, status: 'approved' }
          : ((result?.verification as ImpactVerificationRecord) ?? null),
      )
      setResultMessage(
        result?.alreadyResolved
          ? 'This impact log was already resolved.'
          : 'Approved. The learner has been awarded their points.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!token || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await rejectImpactVerification(token, rejectionReason.trim() || undefined)
      setVerification((prev) =>
        prev
          ? { ...prev, status: 'rejected' }
          : ((result?.verification as ImpactVerificationRecord) ?? null),
      )
      setResultMessage(
        result?.alreadyResolved
          ? 'This impact log was already resolved.'
          : 'Rejected. The learner received zero points for this impact log.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box minH="100vh" bg="gray.50" py={{ base: 8, md: 14 }}>
      <Container maxW="lg">
        <VStack spacing={6} align="stretch">
          <Box>
            <Text fontSize="sm" color="gray.500" fontWeight="semibold" letterSpacing="0.06em" textTransform="uppercase">
              Transformation Leader
            </Text>
            <Heading size="lg" mt={1} color="#27062e">
              Verify impact log
            </Heading>
            <Text mt={2} color="gray.600">
              Review this impact entry and approve or reject it. Approval awards points; rejection awards none.
            </Text>
          </Box>

          {loading && (
            <HStack justify="center" py={10}>
              <Spinner color="#350e6f" />
              <Text>Loading request…</Text>
            </HStack>
          )}

          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Unable to continue</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Box>
            </Alert>
          )}

          {resultMessage && (
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              <AlertDescription>{resultMessage}</AlertDescription>
            </Alert>
          )}

          {!loading && verification && (
            <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="lg" p={6} shadow="sm">
              <Stack spacing={4}>
                <Box>
                  <Text fontSize="sm" color="gray.500">
                    Learner
                  </Text>
                  <Text fontWeight="semibold">{verification.learnerName || 'Learner'}</Text>
                  {verification.learnerEmail && (
                    <Text fontSize="sm" color="gray.600">
                      {verification.learnerEmail}
                    </Text>
                  )}
                </Box>

                <Box>
                  <Text fontSize="sm" color="gray.500">
                    Activity
                  </Text>
                  <Text fontWeight="semibold">{verification.activityTitle || 'Impact activity'}</Text>
                </Box>

                <Box>
                  <Text fontSize="sm" color="gray.500">
                    Your role
                  </Text>
                  <Text fontWeight="semibold" textTransform="capitalize">
                    {verification.verifierRole || 'verifier'}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {verification.verifierName} · {verification.verifierEmail}
                  </Text>
                </Box>

                {summaryLines.length > 0 && (
                  <Box>
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Details
                    </Text>
                    <Stack spacing={1}>
                      {summaryLines.map((line) => (
                        <Text key={line} fontSize="sm">
                          {line}
                        </Text>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Box>
                  <Text fontSize="sm" color="gray.500">
                    Status
                  </Text>
                  <Text fontWeight="semibold" textTransform="capitalize">
                    {verification.status}
                  </Text>
                </Box>

                {!alreadyDone && !resultMessage && (
                  <>
                    {(decisionHint === 'reject' || !decisionHint) && (
                      <Box>
                        <Text fontSize="sm" fontWeight="medium" mb={1}>
                          Rejection reason (optional)
                        </Text>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Optional note for the learner"
                          rows={3}
                        />
                      </Box>
                    )}
                    <HStack spacing={3} pt={2}>
                      <Button
                        colorScheme="green"
                        onClick={handleApprove}
                        isLoading={submitting}
                        flex={1}
                      >
                        Approve
                      </Button>
                      <Button
                        colorScheme="red"
                        variant="outline"
                        onClick={handleReject}
                        isLoading={submitting}
                        flex={1}
                      >
                        Reject
                      </Button>
                    </HStack>
                  </>
                )}
              </Stack>
            </Box>
          )}
        </VStack>
      </Container>
    </Box>
  )
}
