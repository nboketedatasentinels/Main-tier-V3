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
 * Public token page for impact verifiers (in or out of org).
 * Linked from the verification email - no login required.
 * Handles both activity-log points verification and improvement-claim confirmation.
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

 const summary = verification?.impactSummary
 const isClaim =
 (summary &&
 typeof summary === 'object' &&
 (summary as { kind?: string }).kind === 'improvement_claim') ||
 verification?.verifierRole === 'measure_owner' ||
 verification?.verifierRole === 'finance'

 const roleLabel =
 verification?.verifierRole === 'finance'
 ? 'Finance validator'
 : verification?.verifierRole === 'measure_owner'
 ? 'Measure owner'
 : verification?.verifierRole || 'Verifier'

 const summaryRows = useMemo(() => {
 if (!summary || typeof summary !== 'object') return []
 const s = summary as Record<string, unknown>
 const preferred = [
 ['valueLabel', 'Indicative value'],
 ['net', 'Net / period'],
 ['bucket', 'Bucket'],
 ['band', 'Value band'],
 ['window', 'Measurement window'],
 ['source', 'Source'],
 ['evidence', 'Evidence'],
 ['needsFinance', 'Finance required after owner'],
 ] as const
 const rows: { label: string; value: string }[] = []
 for (const [key, label] of preferred) {
 const raw = s[key]
 if (raw == null || String(raw).trim() === '') continue
 let value = String(raw)
 if (key === 'needsFinance') value = raw === true || raw === 'true' ? 'Yes' : 'No'
 if (key === 'net' && typeof raw === 'number') value = `$${Math.round(raw).toLocaleString()}`
 rows.push({ label, value })
 }
 return rows
 }, [summary])

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
 if (result?.alreadyResolved) {
 setResultMessage('This request was already resolved.')
 } else if (result?.claimConfirmation) {
 if (result.recognized) {
 setResultMessage(
 'Confirmed. The claim is recognized and the value can appear on the Impact Log dashboard.',
 )
 } else if (result.financeEmailed) {
 setResultMessage(
 'Measure owner confirmation recorded. Finance has been emailed to validate next.',
 )
 } else {
 setResultMessage(
 `Confirmation recorded${result.claimStatus ? ` · ${result.claimStatus}` : ''}.`,
 )
 }
 } else {
 setResultMessage('Approved. The learner has been awarded their points.')
 }
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
 if (result?.alreadyResolved) {
 setResultMessage('This request was already resolved.')
 } else if (result?.claimConfirmation || isClaim) {
 setResultMessage('Sent back. The learner was notified to revise the claim. No headline value was added.')
 } else {
 setResultMessage('Rejected. The learner received zero points for this impact log.')
 }
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
 <Text
 fontSize="sm"
 color="gray.500"
 fontWeight="semibold"
 letterSpacing="0.06em"
 textTransform="uppercase"
 >
 Transformation Leader
 </Text>
 <Heading size="lg" mt={1} color="#27062e">
 {isClaim ? 'Confirm improvement claim' : 'Verify impact log'}
 </Heading>
 <Text mt={2} color="gray.600">
 {isClaim
 ? 'Review this improvement claim and confirm or send it back. Confirmation updates the Impact Log value journey - it does not award journey points.'
 : 'Review this impact entry and approve or reject it. Approval awards points; rejection awards none.'}
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
 {isClaim ? 'Claim' : 'Activity'}
 </Text>
 <Text fontWeight="semibold">
 {verification.activityTitle || (isClaim ? 'Improvement claim' : 'Impact activity')}
 </Text>
 </Box>

 <Box>
 <Text fontSize="sm" color="gray.500">
 Your role
 </Text>
 <Text fontWeight="semibold">{roleLabel}</Text>
 <Text fontSize="sm" color="gray.600">
 {verification.verifierName} · {verification.verifierEmail}
 </Text>
 </Box>

 {summaryRows.length > 0 && (
 <Box>
 <Text fontSize="sm" color="gray.500" mb={1}>
 Details
 </Text>
 <Stack spacing={1}>
 {summaryRows.map((row) => (
 <Text key={row.label} fontSize="sm">
 <Text as="span" color="gray.500">
 {row.label}:{' '}
 </Text>
 {row.value}
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
 {isClaim ? 'Reason if sending back (optional)' : 'Rejection reason (optional)'}
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
 onClick={() => void handleApprove()}
 isLoading={submitting}
 flex={1}
 >
 {isClaim ? 'Confirm' : 'Approve'}
 </Button>
 <Button
 colorScheme="red"
 variant="outline"
 onClick={() => void handleReject()}
 isLoading={submitting}
 flex={1}
 >
 {isClaim ? 'Send back' : 'Reject'}
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
