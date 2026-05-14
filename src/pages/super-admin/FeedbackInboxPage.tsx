import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Icon,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import {
  Bug,
  CheckCircle2,
  Eye,
  Heart,
  Inbox,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Mail,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeToFeedback,
  updateFeedbackStatus,
  type FeedbackCategory,
  type FeedbackRecord,
  type FeedbackStatus,
} from '@/services/feedbackService'

interface CategoryMeta {
  label: string
  icon: React.ElementType
  scheme: string
  iconBg: string
  iconShadow: string
  ornament: string
}

const CATEGORY_META: Record<FeedbackCategory, CategoryMeta> = {
  bug: {
    label: 'Bug report',
    icon: Bug,
    scheme: 'red',
    iconBg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    iconShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
    ornament: 'red.50',
  },
  feature_request: {
    label: 'Feature request',
    icon: Lightbulb,
    scheme: 'blue',
    iconBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    iconShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
    ornament: 'blue.50',
  },
  general: {
    label: 'General feedback',
    icon: MessageSquare,
    scheme: 'purple',
    iconBg: '#350e6f',
    iconShadow: '0 4px 12px rgba(53, 14, 111, 0.3)',
    ornament: 'purple.50',
  },
  appreciation: {
    label: 'Appreciation',
    icon: Heart,
    scheme: 'green',
    iconBg: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
    iconShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
    ornament: 'green.50',
  },
}

const STATUS_META: Record<FeedbackStatus, { label: string; scheme: string }> = {
  new: { label: 'New', scheme: 'orange' },
  reviewed: { label: 'Reviewed', scheme: 'purple' },
  resolved: { label: 'Resolved', scheme: 'green' },
}

const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | FeedbackStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New only' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
]

const CATEGORY_FILTER_OPTIONS: Array<{ value: 'all' | FeedbackCategory; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'bug', label: 'Bug reports' },
  { value: 'feature_request', label: 'Feature requests' },
  { value: 'general', label: 'General feedback' },
  { value: 'appreciation', label: 'Appreciation' },
]

interface KpiTileProps {
  label: string
  value: number
  icon: React.ElementType
  iconBg: string
  iconShadow: string
  ornament: string
}

const KpiTile: React.FC<KpiTileProps> = ({ label, value, icon, iconBg, iconShadow, ornament }) => (
  <Box
    bg="white"
    p={5}
    borderRadius="xl"
    boxShadow="0 2px 8px rgba(0,0,0,0.04)"
    transition="all 0.3s ease"
    position="relative"
    overflow="hidden"
  >
    <Box position="absolute" top={0} right={0} w="60px" h="60px" bg={ornament} borderRadius="0 0 0 100%" />
    <Flex
      w={10}
      h={10}
      bg={iconBg}
      borderRadius="xl"
      align="center"
      justify="center"
      mb={3}
      boxShadow={iconShadow}
    >
      <Icon as={icon} boxSize={5} color="white" />
    </Flex>
    <Text
      fontSize="xs"
      color="gray.500"
      fontWeight="semibold"
      textTransform="uppercase"
      letterSpacing="wide"
      mb={1}
    >
      {label}
    </Text>
    <Text fontWeight="bold" fontSize="3xl" color="gray.800" lineHeight="1" letterSpacing="-0.02em">
      {value}
    </Text>
  </Box>
)

const FeedbackItem: React.FC<{
  record: FeedbackRecord
  onUpdateStatus: (status: FeedbackStatus) => void
  updating: boolean
}> = ({ record, onUpdateStatus, updating }) => {
  const meta = CATEGORY_META[record.category]
  const statusMeta = STATUS_META[record.status]
  const submittedLabel = record.createdAt
    ? formatDistanceToNow(record.createdAt, { addSuffix: true })
    : 'Just now'

  return (
    <Box
      bg="white"
      p={{ base: 5, md: 6 }}
      borderRadius="xl"
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
      transition="all 0.2s"
      position="relative"
      overflow="hidden"
      _hover={{ boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}
    >
      <Box
        position="absolute"
        top={0}
        right={0}
        w="80px"
        h="80px"
        bg={meta.ornament}
        borderRadius="0 0 0 100%"
      />
      <Stack spacing={4} position="relative" zIndex={1}>
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          gap={3}
        >
          <HStack spacing={3} align="center">
            <Flex
              w={10}
              h={10}
              bg={meta.iconBg}
              borderRadius="xl"
              align="center"
              justify="center"
              boxShadow={meta.iconShadow}
              flexShrink={0}
            >
              <Icon as={meta.icon} boxSize={5} color="white" />
            </Flex>
            <Stack spacing={0}>
              <HStack spacing={2}>
                <Badge colorScheme={meta.scheme} variant="subtle" fontSize="xs" rounded="full">
                  {meta.label}
                </Badge>
                <Badge colorScheme={statusMeta.scheme} variant="solid" fontSize="xs" rounded="full">
                  {statusMeta.label}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="gray.500" mt={1}>
                {record.userName || record.userEmail || 'Anonymous user'}
                {record.userEmail && record.userName ? ` · ${record.userEmail}` : ''}
              </Text>
            </Stack>
          </HStack>
          <Text fontSize="xs" color="gray.400" whiteSpace="nowrap">
            {submittedLabel}
          </Text>
        </Flex>

        <Box bg="gray.50" border="1px solid" borderColor="gray.100" rounded="lg" p={4}>
          <Text fontSize="sm" color="gray.800" whiteSpace="pre-wrap" lineHeight="1.6">
            {record.message}
          </Text>
        </Box>

        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <HStack spacing={3} color="gray.500" fontSize="xs" flexWrap="wrap">
            {record.pageContext && (
              <HStack spacing={1}>
                <Text fontWeight="medium">From:</Text>
                <Text as="code" bg="gray.100" px={2} py={0.5} rounded="md" color="gray.700">
                  {record.pageContext}
                </Text>
              </HStack>
            )}
            {record.userEmail && (
              <HStack
                spacing={1}
                as="a"
                href={`mailto:${record.userEmail}`}
                _hover={{ color: 'purple.600' }}
              >
                <Icon as={Mail} boxSize={3} />
                <Text>Reply</Text>
              </HStack>
            )}
          </HStack>

          <HStack spacing={2}>
            {record.status !== 'reviewed' && record.status !== 'resolved' && (
              <Button
                size="sm"
                variant="outline"
                colorScheme="purple"
                leftIcon={<Icon as={Eye} boxSize={3.5} />}
                isLoading={updating}
                onClick={() => onUpdateStatus('reviewed')}
              >
                Mark reviewed
              </Button>
            )}
            {record.status !== 'resolved' && (
              <Button
                size="sm"
                colorScheme="green"
                leftIcon={<Icon as={CheckCircle2} boxSize={3.5} />}
                isLoading={updating}
                onClick={() => onUpdateStatus('resolved')}
              >
                Resolve
              </Button>
            )}
            {record.status === 'resolved' && (
              <Button
                size="sm"
                variant="ghost"
                colorScheme="gray"
                onClick={() => onUpdateStatus('new')}
                isLoading={updating}
              >
                Reopen
              </Button>
            )}
          </HStack>
        </Flex>
      </Stack>
    </Box>
  )
}

export const FeedbackInboxPage: React.FC = () => {
  const { profile } = useAuth()
  const toast = useToast()
  const [records, setRecords] = useState<FeedbackRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeedbackCategory>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToFeedback(
      (next) => {
        setRecords(next)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message || 'Could not load feedback')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  const stats = useMemo(() => {
    let total = 0
    let newCount = 0
    let bugs = 0
    let appreciation = 0
    records.forEach((r) => {
      total += 1
      if (r.status === 'new') newCount += 1
      if (r.category === 'bug') bugs += 1
      if (r.category === 'appreciation') appreciation += 1
    })
    return { total, newCount, bugs, appreciation }
  }, [records])

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        return true
      }),
    [records, categoryFilter, statusFilter]
  )

  const handleUpdateStatus = async (id: string, status: FeedbackStatus) => {
    setUpdatingId(id)
    try {
      await updateFeedbackStatus(id, status, profile?.id ?? null)
      toast({
        title:
          status === 'resolved'
            ? 'Marked as resolved'
            : status === 'reviewed'
              ? 'Marked as reviewed'
              : 'Reopened',
        status: 'success',
        duration: 2000,
      })
    } catch (err) {
      console.error('[FeedbackInboxPage] status update failed', err)
      toast({
        title: 'Could not update status',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        status: 'error',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Stack spacing={6}>
      {/* Header */}
      <Box
        bg="white"
        p={6}
        borderRadius="xl"
        boxShadow="0 2px 8px rgba(0,0,0,0.04)"
        position="relative"
        overflow="hidden"
      >
        <Box position="absolute" top={0} right={0} w="90px" h="90px" bg="purple.50" borderRadius="0 0 0 100%" />
        <Stack spacing={2} position="relative" zIndex={1}>
          <HStack spacing={3} align="center">
            <Flex
              w={10}
              h={10}
              bg="#350e6f"
              borderRadius="xl"
              align="center"
              justify="center"
              boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
              flexShrink={0}
            >
              <Icon as={Inbox} boxSize={5} color="white" />
            </Flex>
            <Stack spacing={0}>
              <Heading size="md" color="gray.800">
                Feedback Inbox
              </Heading>
              <Text color="gray.500" fontSize="sm">
                Every note submitted from `/app/feedback`. Updates in real time.
              </Text>
            </Stack>
          </HStack>
        </Stack>
      </Box>

      {/* KPI strip */}
      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={4}>
        <KpiTile
          label="Total feedback"
          value={stats.total}
          icon={MessageSquare}
          iconBg="#350e6f"
          iconShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
          ornament="purple.50"
        />
        <KpiTile
          label="New / Unread"
          value={stats.newCount}
          icon={Sparkles}
          iconBg="linear-gradient(135deg, #f4540c 0%, #c2410c 100%)"
          iconShadow="0 4px 12px rgba(244, 84, 12, 0.3)"
          ornament="orange.50"
        />
        <KpiTile
          label="Bug reports"
          value={stats.bugs}
          icon={Bug}
          iconBg="linear-gradient(135deg, #dc2626 0%, #991b1b 100%)"
          iconShadow="0 4px 12px rgba(220, 38, 38, 0.3)"
          ornament="red.50"
        />
        <KpiTile
          label="Appreciation"
          value={stats.appreciation}
          icon={Heart}
          iconBg="linear-gradient(135deg, #047857 0%, #065f46 100%)"
          iconShadow="0 4px 12px rgba(4, 120, 87, 0.3)"
          ornament="green.50"
        />
      </SimpleGrid>

      {/* Filters */}
      <HStack spacing={3} flexWrap="wrap">
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | FeedbackCategory)}
          maxW="240px"
          bg="white"
        >
          {CATEGORY_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | FeedbackStatus)}
          maxW="200px"
          bg="white"
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Text fontSize="sm" color="gray.500" ml={1}>
          {filtered.length} of {records.length} shown
        </Text>
      </HStack>

      {/* Feedback list */}
      {loading ? (
        <Center py={16}>
          <Spinner size="lg" color="purple.500" thickness="3px" />
        </Center>
      ) : error ? (
        <Box bg="red.50" border="1px solid" borderColor="red.200" rounded="xl" p={5}>
          <Text color="red.700" fontWeight="medium">
            Couldn't load feedback.
          </Text>
          <Text color="red.600" fontSize="sm" mt={1}>
            {error}
          </Text>
        </Box>
      ) : filtered.length === 0 ? (
        <Center
          py={16}
          bg="white"
          rounded="xl"
          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
          flexDirection="column"
          gap={3}
        >
          <Icon as={Inbox} boxSize={10} color="gray.300" />
          <Text color="gray.500" fontWeight="medium">
            No feedback to show
          </Text>
          <Text color="gray.400" fontSize="sm">
            Adjust filters or wait for new submissions to arrive.
          </Text>
        </Center>
      ) : (
        <Stack spacing={4}>
          {filtered.map((record) => (
            <FeedbackItem
              key={record.id}
              record={record}
              updating={updatingId === record.id}
              onUpdateStatus={(status) => handleUpdateStatus(record.id, status)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export default FeedbackInboxPage
