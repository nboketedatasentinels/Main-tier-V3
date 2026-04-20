import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  ButtonGroup,
  chakra,
  Checkbox,
  CheckboxGroup,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
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
  Stack,
  Switch,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Archive,
  Briefcase,
  CalendarDays,
  Coins,
  Inbox,
  Mail,
  MailOpen,
  Megaphone,
  Pencil,
  Plus,
  RefreshCcw,
  CalendarClock,
  CheckCircle2,
  Send,
  Trash2,
  User,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  useAnnouncements,
  type Announcement,
  type AnnouncementTier,
} from '@/hooks/useAnnouncements'
import { useEventsFeed } from '@/hooks/useEventsFeed'
import { WhatsAppCommunityCard } from '@/components/community/WhatsAppCommunityCard'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { UserRole } from '@/types'
import {
  type AdminAnnouncement,
  type AnnouncementDraftInput,
  archiveAnnouncementAdmin,
  createAnnouncement,
  deleteAnnouncementAdmin,
  publishAnnouncement,
  subscribeToAllAnnouncements,
  updateAnnouncement,
} from '@/services/announcementService'

const DEFAULT_TAB: TabKey = 'events'

type TabKey = 'announcements' | 'events' | 'jobs' | 'grants' | 'admin'

interface TabDescriptor {
  key: TabKey
  label: string
  description: string
  icon: React.ElementType
  hidden?: boolean
}

const baseTabs: TabDescriptor[] = [
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Platform-wide messages, updates, and required actions from the T4L team.',
    icon: Megaphone,
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Discover upcoming workshops, gatherings, and live experiences.',
    icon: CalendarDays,
  },
  {
    key: 'jobs',
    label: 'Job Board',
    description: 'Join the WhatsApp job board to share roles and get real-time referrals.',
    icon: Briefcase,
  },
  {
    key: 'grants',
    label: 'Grants & Funding',
    description: 'Access grants via the WhatsApp community for collaborative discovery.',
    icon: Coins,
  },
]

const ROLE_TARGET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'free_user', label: 'Free members' },
  { value: 'paid_member', label: 'Paid members' },
  { value: 'mentor', label: 'Mentors' },
  { value: 'ambassador', label: 'Ambassadors' },
  { value: 'partner', label: 'Partners' },
]

const buildSearchParams = (tab: TabKey) => {
  const params = new URLSearchParams()
  params.set('tab', tab)
  return params
}

const AnnouncementsHeader = () => (
  <Box bg="white" p={6} borderRadius="3xl" borderWidth={1} borderColor="brand.border" boxShadow="sm">
    <Stack spacing={2}>
      <Heading size="lg" color="brand.text">
        Community Hub
      </Heading>
      <Text color="brand.subtleText" fontSize="md">
        Platform announcements, events, and community spaces — all in one place.
      </Text>
    </Stack>
  </Box>
)

const TabNavigation: React.FC<{
  activeTab: TabKey
  onChange: (tab: TabKey) => void
  tabs: TabDescriptor[]
}> = ({ activeTab, onChange, tabs }) => {
  const visibleTabs = tabs.filter((tab) => !tab.hidden)
  return (
    <ButtonGroup spacing={3} flexWrap="wrap">
      {visibleTabs.map((tab) => (
        <Button
          key={tab.key}
          variant={activeTab === tab.key ? 'solid' : 'ghost'}
          colorScheme={activeTab === tab.key ? 'purple' : undefined}
          borderRadius="full"
          bg={activeTab === tab.key ? 'purple.600' : 'surface.default'}
          color={activeTab === tab.key ? 'text.inverse' : 'text.primary'}
          borderWidth={1}
          borderColor={activeTab === tab.key ? 'purple.600' : 'border.subtle'}
          boxShadow={activeTab === tab.key ? 'lg' : 'none'}
          leftIcon={<Icon as={tab.icon} boxSize={4} />}
          _hover={{ bg: activeTab === tab.key ? 'purple.700' : 'surface.subtle' }}
          _focus={{ boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.4)' }}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </Button>
      ))}
    </ButtonGroup>
  )
}

const AnnouncementCard: React.FC<{
  announcement: Announcement
  onOpen: () => void
  onToggleRead: () => void
  onToggleArchive: () => void
}> = ({ announcement, onOpen, onToggleRead, onToggleArchive }) => {
  const isUnread = !announcement.isRead
  const isArchived = announcement.isArchived
  const mandatoryPending = announcement.isMandatory && !announcement.actionCompleted
  const indicatorColor = mandatoryPending
    ? 'red.400'
    : isUnread
      ? 'brand.primary'
      : 'border.subtle'
  const archiveBlockedReason = mandatoryPending
    ? 'Complete the required action before archiving.'
    : null

  return (
    <Box
      as="button"
      textAlign="left"
      width="100%"
      onClick={onOpen}
      borderWidth={mandatoryPending ? 2 : 1}
      borderColor={mandatoryPending ? 'red.300' : isUnread ? 'accent.purpleBorder' : 'border.subtle'}
      bg={mandatoryPending ? 'red.50' : isUnread ? 'accent.purpleSubtle' : 'surface.default'}
      boxShadow={isUnread ? 'md' : 'sm'}
      borderRadius="2xl"
      p={4}
      _hover={{ borderColor: mandatoryPending ? 'red.400' : 'purple.400', boxShadow: 'md' }}
      transition="all 0.2s ease"
    >
      <HStack align="start" spacing={4}>
        <Box mt={2} boxSize={3} borderRadius="full" bg={indicatorColor} aria-hidden />
        <Stack spacing={2} flex={1}>
          <HStack justify="space-between" align="start">
            <Stack spacing={1}>
              <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="semibold" color="text.primary">
                {announcement.title}
              </Text>
              <Text color="text.secondary" fontSize={{ base: 'sm', md: 'md' }}>
                {announcement.message.length > 240
                  ? `${announcement.message.slice(0, 240)}...`
                  : announcement.message}
              </Text>
            </Stack>
            <Stack direction={{ base: 'column', md: 'row' }} spacing={2} align="flex-end">
              {mandatoryPending && (
                <Badge colorScheme="red" borderRadius="full" display="inline-flex" gap={1} alignItems="center">
                  <Icon as={AlertTriangle} boxSize={3} />
                  Action required
                </Badge>
              )}
              {announcement.isMandatory && announcement.actionCompleted && (
                <Badge colorScheme="green" borderRadius="full" display="inline-flex" gap={1} alignItems="center">
                  <Icon as={CheckCircle2} boxSize={3} />
                  Completed
                </Badge>
              )}
              {!announcement.isMandatory && isUnread && (
                <Badge colorScheme="purple" borderRadius="full">
                  New
                </Badge>
              )}
              {isArchived && (
                <Badge colorScheme="gray" variant="subtle" borderRadius="full">
                  Archived
                </Badge>
              )}
              {announcement.createdAt && (
                <Text color="text.muted" fontSize="xs" textTransform="uppercase">
                  {formatDistanceToNow(announcement.createdAt, { addSuffix: true })}
                </Text>
              )}
            </Stack>
          </HStack>
          <HStack spacing={2}>
            <IconButton
              aria-label={announcement.isRead ? 'Mark as unread' : 'Mark as read'}
              icon={<Icon as={announcement.isRead ? MailOpen : Mail} boxSize={4} />}
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onToggleRead()
              }}
            />
            <Tooltip label={archiveBlockedReason ?? ''} isDisabled={!archiveBlockedReason}>
              <span>
                <IconButton
                  aria-label={
                    announcement.isArchived ? 'Restore announcement' : 'Archive announcement'
                  }
                  icon={<Icon as={announcement.isArchived ? RefreshCcw : Archive} boxSize={4} />}
                  size="sm"
                  variant="ghost"
                  isDisabled={Boolean(archiveBlockedReason) && !announcement.isArchived}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleArchive()
                  }}
                />
              </span>
            </Tooltip>
          </HStack>
        </Stack>
      </HStack>
    </Box>
  )
}

const AnnouncementModal: React.FC<{
  announcement: Announcement
  isOpen: boolean
  onClose: () => void
  onArchive: () => void
  onRestore: () => void
  onCompleteAction: () => Promise<void> | void
}> = ({ announcement, isOpen, onClose, onArchive, onRestore, onCompleteAction }) => {
  const isArchived = announcement.isArchived
  const mandatoryPending = announcement.isMandatory && !announcement.actionCompleted

  const handleCompleteAction = async () => {
    if (announcement.actionUrl) {
      window.open(announcement.actionUrl, '_blank', 'noopener,noreferrer')
    }
    await onCompleteAction()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      isCentered
      closeOnOverlayClick={!mandatoryPending}
      closeOnEsc={!mandatoryPending}
    >
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent borderRadius="2xl" overflow="hidden">
        <ModalHeader>
          <Stack spacing={1}>
            <Text
              fontSize="xs"
              fontWeight="bold"
              color={mandatoryPending ? 'red.500' : 'text.muted'}
              letterSpacing="widest"
            >
              {mandatoryPending ? 'ACTION REQUIRED' : 'ANNOUNCEMENT'}
            </Text>
            <Heading size="lg" color="text.primary">
              {announcement.title}
            </Heading>
            <HStack spacing={2} flexWrap="wrap">
              {announcement.createdAt && (
                <Badge bg="surface.subtle" color="text.secondary" px={3} py={1} borderRadius="full" display="inline-flex" gap={2}>
                  <Icon as={CalendarClock} boxSize={4} />
                  {format(announcement.createdAt, 'MMMM d, yyyy • h:mm a')}
                </Badge>
              )}
              {announcement.author && (
                <Badge bg="surface.subtle" color="text.secondary" px={3} py={1} borderRadius="full" display="inline-flex" gap={2}>
                  <Icon as={User} boxSize={4} />
                  {announcement.author}
                </Badge>
              )}
              {announcement.source && (
                <Badge bg="surface.subtle" color="text.secondary" px={3} py={1} borderRadius="full" display="inline-flex" gap={2}>
                  <Icon as={Inbox} boxSize={4} />
                  {announcement.source}
                </Badge>
              )}
            </HStack>
          </Stack>
        </ModalHeader>
        {!mandatoryPending && <ModalCloseButton rounded="full" mt={2} />}
        <ModalBody>
          <Stack spacing={4}>
            {mandatoryPending && (
              <Alert status="warning" borderRadius="xl">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  This announcement requires an action before you can close it.
                </AlertDescription>
              </Alert>
            )}
            <Box borderWidth={1} borderColor="border.subtle" bg="surface.subtle" borderRadius="2xl" p={4}>
              <Text whiteSpace="pre-wrap" color="text.secondary" fontSize="md" lineHeight="tall">
                {announcement.message}
              </Text>
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter justifyContent="space-between" alignItems="center">
          <HStack spacing={3} color="text.secondary" fontSize="sm" textTransform="uppercase" fontWeight="semibold">
            {isArchived ? (
              <HStack spacing={2}>
                <Icon as={Archive} boxSize={4} />
                <Text>Archived</Text>
              </HStack>
            ) : announcement.isRead ? (
              <HStack spacing={2}>
                <Icon as={MailOpen} boxSize={4} />
                <Text>Read</Text>
              </HStack>
            ) : (
              <HStack spacing={2}>
                <Icon as={Mail} boxSize={4} />
                <Text>Unread</Text>
              </HStack>
            )}
          </HStack>
          <HStack spacing={3}>
            {announcement.isMandatory && !announcement.actionCompleted && (
              <Button
                colorScheme="red"
                leftIcon={<Icon as={CheckCircle2} boxSize={4} />}
                rightIcon={announcement.actionUrl ? <Icon as={ArrowUpRight} boxSize={4} /> : undefined}
                onClick={handleCompleteAction}
              >
                {announcement.actionLabel || 'Confirm I have taken action'}
              </Button>
            )}
            {!mandatoryPending && (
              <>
                {isArchived ? (
                  <Button variant="outline" leftIcon={<RefreshCcw size={18} />} onClick={onRestore}>
                    Restore
                  </Button>
                ) : (
                  <Button variant="outline" leftIcon={<Archive size={18} />} onClick={onArchive}>
                    Archive
                  </Button>
                )}
                <Button colorScheme="purple" onClick={onClose}>
                  Close
                </Button>
              </>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

interface ComposerState {
  title: string
  message: string
  isMandatory: boolean
  actionLabel: string
  actionUrl: string
  targetRoles: string[]
  tier: AnnouncementTier
  orgCode: string
  orgCodes: string[]
  status: 'draft' | 'published'
}

const emptyComposer = (): ComposerState => ({
  title: '',
  message: '',
  isMandatory: false,
  actionLabel: '',
  actionUrl: '',
  targetRoles: [],
  tier: 'global',
  orgCode: '',
  orgCodes: [],
  status: 'published',
})

const TIER_OPTIONS: Array<{ value: AnnouncementTier; label: string; description: string }> = [
  { value: 'global', label: 'Global', description: 'Everyone on the platform' },
  { value: 'org_wide', label: 'Org-wide', description: 'Learners across selected organisations' },
  { value: 'org_specific', label: 'Org-specific', description: 'One organisation only' },
]

const tierLabel = (tier?: AnnouncementTier | null) =>
  TIER_OPTIONS.find((option) => option.value === tier)?.label ?? 'Global'

const AnnouncementComposer: React.FC<{
  initialValue?: AdminAnnouncement | null
  onCancel: () => void
  onSaved: () => void
  authorName: string | null
}> = ({ initialValue, onCancel, onSaved, authorName }) => {
  const toast = useToast()
  const [state, setState] = useState<ComposerState>(emptyComposer())
  const [saving, setSaving] = useState(false)

  const { organizations } = usePartnerOrganizations()
  const orgOptions = useMemo(
    () =>
      organizations
        .filter((org) => Boolean(org.code))
        .map((org) => ({ code: org.code, name: org.name || org.code })),
    [organizations],
  )

  useEffect(() => {
    if (initialValue) {
      const existingTier: AnnouncementTier = initialValue.tier ?? 'global'
      setState({
        title: initialValue.title,
        message: initialValue.message,
        isMandatory: initialValue.isMandatory,
        actionLabel: initialValue.actionLabel ?? '',
        actionUrl: initialValue.actionUrl ?? '',
        targetRoles: initialValue.targeting?.targetRoles ?? [],
        tier: existingTier,
        orgCode: initialValue.targeting?.companyCode ?? '',
        orgCodes: initialValue.targeting?.companyCodes ?? [],
        status: initialValue.status === 'draft' ? 'draft' : 'published',
      })
    } else {
      setState(emptyComposer())
    }
    // Only resync when the target record id changes; snapshot re-emits keep edits in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue?.id])

  const isValid = state.title.trim().length > 0 && state.message.trim().length > 0
  const mandatoryMissingLabel = state.isMandatory && !state.actionLabel.trim()
  const tierMissingOrgs =
    (state.tier === 'org_specific' && !state.orgCode) ||
    (state.tier === 'org_wide' && state.orgCodes.length === 0)

  const handleSubmit = async (override?: Partial<ComposerState>) => {
    if (!isValid || mandatoryMissingLabel || tierMissingOrgs) return
    setSaving(true)
    const next = { ...state, ...override }
    const targetingPayload: NonNullable<AnnouncementDraftInput['targeting']> = {}
    if (next.targetRoles.length) targetingPayload.targetRoles = next.targetRoles
    if (next.tier === 'org_specific' && next.orgCode) {
      targetingPayload.companyCode = next.orgCode
    }
    if (next.tier === 'org_wide' && next.orgCodes.length) {
      targetingPayload.companyCodes = next.orgCodes
    }
    const hasTargeting = Object.keys(targetingPayload).length > 0
    const payload: AnnouncementDraftInput = {
      title: next.title,
      message: next.message,
      isMandatory: next.isMandatory,
      actionLabel: next.actionLabel || null,
      actionUrl: next.actionUrl || null,
      targeting: hasTargeting ? targetingPayload : null,
      status: next.status,
      tier: next.tier,
      author: authorName,
      source: 'T4L Team',
    }
    try {
      if (initialValue) {
        await updateAnnouncement(initialValue.id, payload)
        toast({ title: 'Announcement updated', status: 'success', duration: 2500 })
      } else {
        await createAnnouncement(payload)
        toast({ title: 'Announcement published', status: 'success', duration: 2500 })
      }
      onSaved()
    } catch (error) {
      console.error('Failed to save announcement', error)
      toast({
        title: 'Unable to save announcement',
        description: error instanceof Error ? error.message : 'Please try again.',
        status: 'error',
        duration: 4000,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box
      borderWidth={1}
      borderColor="border.subtle"
      bg="surface.default"
      borderRadius="3xl"
      p={6}
      boxShadow="sm"
    >
      <Stack spacing={5}>
        <Stack spacing={1}>
          <Text fontSize="xs" fontWeight="bold" color="text.muted" letterSpacing="widest">
            {initialValue ? 'EDIT ANNOUNCEMENT' : 'NEW ANNOUNCEMENT'}
          </Text>
          <Heading size="md" color="text.primary">
            {initialValue ? 'Update the announcement' : 'Send a platform-wide message'}
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            Mandatory announcements appear as a blocking pop-up until the learner confirms the required action.
          </Text>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Title</FormLabel>
            <Input
              placeholder="e.g., Complete your Q2 profile update"
              value={state.title}
              onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
              maxLength={120}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Status</FormLabel>
            <Select
              value={state.status}
              onChange={(e) =>
                setState((prev) => ({ ...prev, status: e.target.value as ComposerState['status'] }))
              }
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </Select>
            <FormHelperText>Drafts stay hidden from learners until published.</FormHelperText>
          </FormControl>
        </SimpleGrid>

        <FormControl isRequired>
          <FormLabel fontSize="sm">Message</FormLabel>
          <Textarea
            minH="140px"
            placeholder="Share the details learners need. Plain text only."
            value={state.message}
            onChange={(e) => setState((prev) => ({ ...prev, message: e.target.value }))}
          />
        </FormControl>

        <FormControl display="flex" alignItems="center" gap={3}>
          <Switch
            id="announcement-mandatory"
            colorScheme="red"
            isChecked={state.isMandatory}
            onChange={(e) => setState((prev) => ({ ...prev, isMandatory: e.target.checked }))}
          />
          <Stack spacing={0}>
            <FormLabel htmlFor="announcement-mandatory" mb={0} fontSize="sm">
              Mandatory action required
            </FormLabel>
            <Text fontSize="xs" color="text.muted">
              Learners will see a blocking modal on first login until they confirm the action.
            </Text>
          </Stack>
        </FormControl>

        {state.isMandatory && (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl isRequired isInvalid={mandatoryMissingLabel}>
              <FormLabel fontSize="sm">Action button label</FormLabel>
              <Input
                placeholder="e.g., Update my profile"
                value={state.actionLabel}
                onChange={(e) => setState((prev) => ({ ...prev, actionLabel: e.target.value }))}
              />
              {mandatoryMissingLabel && (
                <FormHelperText color="red.500">Required for mandatory announcements.</FormHelperText>
              )}
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Action URL (optional)</FormLabel>
              <Input
                placeholder="https://… or leave blank for a confirm-only action"
                value={state.actionUrl}
                onChange={(e) => setState((prev) => ({ ...prev, actionUrl: e.target.value }))}
              />
            </FormControl>
          </SimpleGrid>
        )}

        <FormControl>
          <FormLabel fontSize="sm">Announcement scope</FormLabel>
          <Select
            value={state.tier}
            onChange={(e) => {
              const nextTier = e.target.value as AnnouncementTier
              setState((prev) => ({
                ...prev,
                tier: nextTier,
                orgCode: nextTier === 'org_specific' ? prev.orgCode : '',
                orgCodes: nextTier === 'org_wide' ? prev.orgCodes : [],
              }))
            }}
          >
            {TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.description}
              </option>
            ))}
          </Select>
        </FormControl>

        {state.tier === 'org_specific' && (
          <FormControl isRequired isInvalid={tierMissingOrgs}>
            <FormLabel fontSize="sm">Target organisation</FormLabel>
            <Select
              placeholder="Select an organisation"
              value={state.orgCode}
              onChange={(e) => setState((prev) => ({ ...prev, orgCode: e.target.value }))}
            >
              {orgOptions.map((org) => (
                <option key={org.code} value={org.code}>
                  {org.name} ({org.code})
                </option>
              ))}
            </Select>
            {tierMissingOrgs && (
              <FormHelperText color="red.500">
                Pick one organisation for an org-specific announcement.
              </FormHelperText>
            )}
          </FormControl>
        )}

        {state.tier === 'org_wide' && (
          <FormControl isRequired isInvalid={tierMissingOrgs}>
            <FormLabel fontSize="sm">Target organisations</FormLabel>
            <CheckboxGroup
              value={state.orgCodes}
              onChange={(value) =>
                setState((prev) => ({ ...prev, orgCodes: value as string[] }))
              }
            >
              <Stack direction="column" spacing={2} maxH="200px" overflowY="auto" p={2} borderWidth={1} borderColor="border.subtle" borderRadius="md">
                {orgOptions.length === 0 ? (
                  <Text fontSize="sm" color="text.muted">
                    No organisations available.
                  </Text>
                ) : (
                  orgOptions.map((org) => (
                    <Checkbox key={org.code} value={org.code}>
                      {org.name} ({org.code})
                    </Checkbox>
                  ))
                )}
              </Stack>
            </CheckboxGroup>
            {tierMissingOrgs && (
              <FormHelperText color="red.500">
                Pick at least one organisation for an org-wide announcement.
              </FormHelperText>
            )}
          </FormControl>
        )}

        <FormControl>
          <FormLabel fontSize="sm">Who should see this? (leave empty for everyone)</FormLabel>
          <CheckboxGroup
            value={state.targetRoles}
            onChange={(value) =>
              setState((prev) => ({ ...prev, targetRoles: value as string[] }))
            }
          >
            <Stack direction={{ base: 'column', md: 'row' }} spacing={4} flexWrap="wrap">
              {ROLE_TARGET_OPTIONS.map((option) => (
                <Checkbox key={option.value} value={option.value}>
                  {option.label}
                </Checkbox>
              ))}
            </Stack>
          </CheckboxGroup>
          <FormHelperText>Admins always see all announcements regardless of targeting.</FormHelperText>
        </FormControl>

        <HStack justify="flex-end" spacing={3} pt={2}>
          <Button variant="ghost" onClick={onCancel} isDisabled={saving}>
            Cancel
          </Button>
          {initialValue ? (
            <Button
              colorScheme="purple"
              leftIcon={<Pencil size={16} />}
              isLoading={saving}
              isDisabled={!isValid || mandatoryMissingLabel || tierMissingOrgs}
              onClick={() => handleSubmit()}
            >
              Save changes
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                isDisabled={!isValid || mandatoryMissingLabel || tierMissingOrgs || saving}
                onClick={() => handleSubmit({ status: 'draft' })}
              >
                Save as draft
              </Button>
              <Button
                colorScheme="purple"
                leftIcon={<Send size={16} />}
                isLoading={saving}
                isDisabled={!isValid || mandatoryMissingLabel || tierMissingOrgs}
                onClick={() => handleSubmit({ status: 'published' })}
              >
                Publish now
              </Button>
            </>
          )}
        </HStack>
      </Stack>
    </Box>
  )
}

const AdminAnnouncementRow: React.FC<{
  announcement: AdminAnnouncement
  onEdit: () => void
  onTogglePublish: () => void
  onArchive: () => void
  onDelete: () => void
  busy: boolean
}> = ({ announcement, onEdit, onTogglePublish, onArchive, onDelete, busy }) => {
  const statusColor =
    announcement.status === 'published'
      ? 'green'
      : announcement.status === 'draft'
        ? 'yellow'
        : 'gray'
  return (
    <Box borderWidth={1} borderColor="border.subtle" borderRadius="2xl" bg="surface.default" p={4}>
      <Stack spacing={2}>
        <HStack justify="space-between" align="start" flexWrap="wrap" spacing={3}>
          <Stack spacing={1} flex={1} minW="220px">
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme={statusColor} borderRadius="full" textTransform="capitalize">
                {announcement.status}
              </Badge>
              {announcement.isMandatory && (
                <Badge colorScheme="red" borderRadius="full" display="inline-flex" gap={1} alignItems="center">
                  <Icon as={AlertTriangle} boxSize={3} /> Mandatory
                </Badge>
              )}
              <Badge colorScheme="blue" borderRadius="full">
                {tierLabel(announcement.tier)}
              </Badge>
              {announcement.targeting?.companyCode && (
                <Badge colorScheme="teal" borderRadius="full">
                  {announcement.targeting.companyCode}
                </Badge>
              )}
              {announcement.targeting?.companyCodes?.length ? (
                <Badge colorScheme="teal" borderRadius="full">
                  {announcement.targeting.companyCodes.length} org
                  {announcement.targeting.companyCodes.length === 1 ? '' : 's'}
                </Badge>
              ) : null}
              {announcement.targeting?.targetRoles?.length ? (
                <Badge colorScheme="purple" borderRadius="full">
                  {announcement.targeting.targetRoles.length} role
                  {announcement.targeting.targetRoles.length === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </HStack>
            <Text fontWeight="semibold" color="text.primary">
              {announcement.title}
            </Text>
            <Text color="text.secondary" fontSize="sm" noOfLines={2}>
              {announcement.message}
            </Text>
            <Text color="text.muted" fontSize="xs">
              {announcement.createdAt
                ? `Created ${format(announcement.createdAt, 'MMM d, yyyy')}`
                : 'Draft'}
            </Text>
          </Stack>
          <HStack spacing={2}>
            <IconButton
              aria-label="Edit announcement"
              icon={<Pencil size={16} />}
              size="sm"
              variant="outline"
              onClick={onEdit}
              isDisabled={busy}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={onTogglePublish}
              isDisabled={busy}
            >
              {announcement.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
            <IconButton
              aria-label="Archive announcement"
              icon={<Archive size={16} />}
              size="sm"
              variant="outline"
              onClick={onArchive}
              isDisabled={busy || announcement.status === 'archived'}
            />
            <IconButton
              aria-label="Delete announcement"
              icon={<Trash2 size={16} />}
              size="sm"
              variant="outline"
              colorScheme="red"
              onClick={onDelete}
              isDisabled={busy}
            />
          </HStack>
        </HStack>
      </Stack>
    </Box>
  )
}

const AdminTab: React.FC<{ authorName: string | null }> = ({ authorName }) => {
  const toast = useToast()
  const [items, setItems] = useState<AdminAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToAllAnnouncements(
      (next) => {
        setItems(next)
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError('Unable to load announcements right now.')
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  const handleEdit = (announcement: AdminAnnouncement) => {
    setEditing(announcement)
    setComposerOpen(true)
  }

  const handleSaved = () => {
    setComposerOpen(false)
    setEditing(null)
  }

  const handleTogglePublish = async (announcement: AdminAnnouncement) => {
    setBusyId(announcement.id)
    try {
      if (announcement.status === 'published') {
        await updateAnnouncement(announcement.id, { status: 'draft' })
      } else {
        await publishAnnouncement(announcement.id)
      }
    } catch (err) {
      toast({ title: 'Unable to update', status: 'error', duration: 3000 })
      console.error(err)
    } finally {
      setBusyId(null)
    }
  }

  const handleArchive = async (announcement: AdminAnnouncement) => {
    setBusyId(announcement.id)
    try {
      await archiveAnnouncementAdmin(announcement.id)
    } catch (err) {
      toast({ title: 'Unable to archive', status: 'error', duration: 3000 })
      console.error(err)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (announcement: AdminAnnouncement) => {
    if (!window.confirm('Delete this announcement? This cannot be undone.')) return
    setBusyId(announcement.id)
    try {
      await deleteAnnouncementAdmin(announcement.id)
      toast({ title: 'Announcement deleted', status: 'success', duration: 2500 })
    } catch (err) {
      toast({ title: 'Unable to delete', status: 'error', duration: 3000 })
      console.error(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Stack spacing={4}>
      {error && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription fontSize="sm">{error}</AlertDescription>
        </Alert>
      )}

      <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
        <Stack spacing={0}>
          <Heading size="md" color="text.primary">
            Announcement management
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            Create, edit, and publish announcements visible to learners.
          </Text>
        </Stack>
        {!composerOpen && (
          <Button
            leftIcon={<Plus size={16} />}
            colorScheme="purple"
            onClick={() => {
              setEditing(null)
              setComposerOpen(true)
            }}
          >
            New announcement
          </Button>
        )}
      </HStack>

      {composerOpen && (
        <AnnouncementComposer
          initialValue={editing}
          authorName={authorName}
          onCancel={() => {
            setComposerOpen(false)
            setEditing(null)
          }}
          onSaved={handleSaved}
        />
      )}

      <Divider />

      {loading ? (
        <VStack borderWidth={1} borderColor="border.subtle" borderRadius="2xl" bg="surface.default" p={8} spacing={3}>
          <Spinner color="purple.500" size="md" />
          <Text color="text.secondary">Loading announcements...</Text>
        </VStack>
      ) : items.length === 0 ? (
        <VStack
          borderWidth={1}
          borderStyle="dashed"
          borderColor="border.subtle"
          borderRadius="2xl"
          bg="surface.default"
          p={8}
          spacing={3}
        >
          <Icon as={Inbox} boxSize={10} color="text.muted" />
          <Heading size="sm" color="text.primary">
            No announcements yet
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            Publish one to share updates with learners.
          </Text>
        </VStack>
      ) : (
        <Stack spacing={3}>
          {items.map((item) => (
            <AdminAnnouncementRow
              key={item.id}
              announcement={item}
              busy={busyId === item.id}
              onEdit={() => handleEdit(item)}
              onTogglePublish={() => handleTogglePublish(item)}
              onArchive={() => handleArchive(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

const AnnouncementsTab: React.FC = () => {
  const {
    announcements,
    loading,
    error,
    markAnnouncementAsRead,
    markAnnouncementAsUnread,
    markActionCompleted,
    archiveAnnouncement,
    restoreAnnouncement,
  } = useAnnouncements()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [activeAnnouncementId, setActiveAnnouncementId] = useState<string | null>(null)

  const activeAnnouncement = useMemo(
    () => (activeAnnouncementId ? announcements.find((item) => item.id === activeAnnouncementId) ?? null : null),
    [activeAnnouncementId, announcements],
  )

  const openAnnouncement = (announcement: Announcement) => {
    setActiveAnnouncementId(announcement.id)
    if (!announcement.isRead) {
      void markAnnouncementAsRead(announcement.id)
    }
    onOpen()
  }

  const closeAnnouncementModal = () => {
    setActiveAnnouncementId(null)
    onClose()
  }

  return (
    <Stack spacing={4}>
      {error && (
        <Alert status="error" borderRadius="xl" borderWidth={1} borderColor="red.200" bg="red.50">
          <AlertIcon />
          <AlertDescription fontSize="sm">{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <VStack
          borderWidth={1}
          borderColor="border.subtle"
          borderRadius="2xl"
          bg="surface.default"
          p={10}
          spacing={3}
          boxShadow="sm"
        >
          <Spinner color="purple.500" size="lg" />
          <Text color="text.secondary" fontWeight="medium">
            Loading announcements...
          </Text>
        </VStack>
      ) : announcements.length === 0 ? (
        <VStack
          borderWidth={1}
          borderStyle="dashed"
          borderColor="border.subtle"
          borderRadius="2xl"
          bg="surface.default"
          p={10}
          spacing={3}
          boxShadow="sm"
        >
          <Icon as={Inbox} boxSize={12} color="text.muted" />
          <Heading size="sm" color="text.primary">
            No announcements available
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            Check back soon for new updates and community announcements.
          </Text>
        </VStack>
      ) : (
        <Grid templateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={4}>
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onOpen={() => openAnnouncement(announcement)}
              onToggleRead={() =>
                announcement.isRead
                  ? void markAnnouncementAsUnread(announcement.id)
                  : void markAnnouncementAsRead(announcement.id)
              }
              onToggleArchive={() =>
                announcement.isArchived
                  ? void restoreAnnouncement(announcement.id)
                  : void archiveAnnouncement(announcement.id)
              }
            />
          ))}
        </Grid>
      )}

      {activeAnnouncement && (
        <AnnouncementModal
          announcement={activeAnnouncement}
          isOpen={isOpen}
          onClose={closeAnnouncementModal}
          onArchive={() => void archiveAnnouncement(activeAnnouncement.id)}
          onRestore={() => void restoreAnnouncement(activeAnnouncement.id)}
          onCompleteAction={() => markActionCompleted(activeAnnouncement.id)}
        />
      )}
    </Stack>
  )
}

const EventsTab: React.FC = () => {
  const { profile } = useAuth()
  const { events, loading: eventsLoading, error } = useEventsFeed()
  const isAdmin =
    profile?.role === UserRole.SUPER_ADMIN || profile?.role === UserRole.AMBASSADOR || profile?.role === UserRole.PARTNER

  const description = events.length
    ? 'All upcoming workshops, gatherings, learning sessions, and book club meetups now live on T4Leader. Head there to explore the full schedule and RSVP.'
    : "See what's coming up and reserve your spot."

  return (
    <Stack spacing={4}>
      {error && (
        <Alert status="error" borderRadius="xl" borderWidth={1} borderColor="red.200" bg="red.50">
          <AlertIcon />
          <AlertDescription fontSize="sm">{error}</AlertDescription>
        </Alert>
      )}

      {isAdmin && (
        <Box borderWidth={1} borderColor="border.subtle" bg="surface.default" borderRadius="3xl" p={6} boxShadow="sm">
          <Stack spacing={2}>
            <Text fontSize="xs" fontWeight="bold" color="text.muted" letterSpacing="widest">
              EXTERNAL MANAGEMENT
            </Text>
            <Heading size="md" color="text.primary">
              Events are managed in the external admin portal
            </Heading>
            <Text color="text.secondary" fontSize="sm">
              Use the dedicated events management site to create, update, or archive events. Updates made there will appear here
              for everyone once published.
            </Text>
            <Button
              as={chakra.a}
              href={import.meta.env.VITE_EXTERNAL_EVENTS_MANAGEMENT_URL || '#'}
              target="_blank"
              rel="noopener noreferrer"
              colorScheme="purple"
              rightIcon={<ArrowUpRight size={18} />}
              alignSelf={{ base: 'stretch', md: 'flex-start' }}
            >
              Open events management
            </Button>
          </Stack>
        </Box>
      )}

      <Box
        borderWidth={1}
        borderColor="border.subtle"
        borderStyle="dashed"
        bg="surface.default"
        borderRadius="3xl"
        p={{ base: 8, md: 16 }}
        minH="320px"
        textAlign="center"
        boxShadow="sm"
      >
        <VStack spacing={4} maxW="3xl" mx="auto">
          <Box
            w="64px"
            h="64px"
            borderRadius="full"
            bg="purple.50"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={CalendarDays} boxSize={8} color="purple.600" />
          </Box>
          <Heading size="lg" color="text.primary">
            Experience what's happening next
          </Heading>
          <Text color="text.secondary" fontSize={{ base: 'sm', md: 'md' }}>
            {description}
          </Text>
          <HStack spacing={4} flexDirection={{ base: 'column', md: 'row' }} align="center" justify="center">
            <Button
              as={chakra.a}
              href="https://www.t4leader.com/event"
              target="_blank"
              rel="noopener noreferrer"
              colorScheme="purple"
              size="lg"
              rightIcon={<ArrowUpRight size={18} />}
              width={{ base: 'full', md: 'auto' }}
            >
              View Events
            </Button>
          </HStack>
          {eventsLoading && (
            <Text color="text.muted" fontSize="xs" letterSpacing="widest">
              Refreshing events feed...
            </Text>
          )}
        </VStack>
      </Box>
    </Stack>
  )
}

const JobsTab = () => (
  <Stack spacing={4}>
    <Alert status="success" borderRadius="xl" borderWidth={1} borderColor="green.100" bg="green.50">
      <AlertIcon />
      <AlertDescription fontSize="sm" color="green.800">
        Job opportunities now live in our WhatsApp community. Join the external space to share roles and get referrals.
      </AlertDescription>
    </Alert>

    <WhatsAppCommunityCard
      title="Job board is now on WhatsApp"
      description="We've moved job sharing into our WhatsApp community so opportunities reach the right people faster. Join to post openings, share leads, and collaborate with peers in real time."
      highlights={[
        'Peer-vetted opportunities shared directly by community members',
        'Instant updates when new roles are posted',
        'Regional and role-specific threads to keep conversations focused',
        'A supportive network that can refer and amplify your openings',
      ]}
      guidelines={[
        'Include clear titles, locations (or remote), and application links',
        'Note seniority level and required skills so members can self-select',
        'Tag posts with #hiring, #referral, or #remote for quick scanning',
        'Keep follow-up conversations in-thread so everyone benefits',
        'Avoid duplicate posts—refresh previous listings with updates instead',
      ]}
      link="https://chat.whatsapp.com/ImFRIflsS7pGOoHtpTOJy9"
      ctaLabel="Open WhatsApp job board"
      communityName="WhatsApp Job Board"
    />
  </Stack>
)

const GrantsTab = () => (
  <Stack spacing={4}>
    <Alert status="success" borderRadius="xl" borderWidth={1} borderColor="green.100" bg="green.50">
      <AlertIcon />
      <AlertDescription fontSize="sm" color="green.800">
        Grants and funding opportunities now flow through the WhatsApp community for faster sharing and peer support.
      </AlertDescription>
    </Alert>

    <WhatsAppCommunityCard
      title="Grants & funding now live in WhatsApp"
      description="Grant discovery is now community-driven. Join the WhatsApp space to share opportunities, compare application notes, and get reminders ahead of deadlines."
      highlights={[
        'Member-curated grant drops with quick context',
        'Deadline reminders and readiness checklists',
        'Examples of successful pitches from peers',
        'Space to ask eligibility questions before applying',
      ]}
      guidelines={[
        'Add deadlines, focus areas, and geographic eligibility in every post',
        'Share application links plus any templates or tips you found helpful',
        'Use tags like #grant, #funding, and #deadline to keep threads searchable',
        'Keep discussions respectful and consolidate updates in the original thread',
        'Do not share sensitive personal data—link to official forms instead',
      ]}
      link="https://chat.whatsapp.com/FAmTJ4AX7fk3CvrWWteDx8"
      ctaLabel="Open WhatsApp grants space"
      communityName="Grants & Funding"
    />
  </Stack>
)

export const AnnouncementsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile, isSuperAdmin } = useAuth()
  const hasOrganization = Boolean(profile?.companyId || profile?.organizationId || profile?.companyCode)
  const hasPaidAccess = profile?.membershipStatus === 'paid' && hasOrganization

  const tabConfig = useMemo<TabDescriptor[]>(
    () => {
      const withPaidHiding = baseTabs.map((tab) =>
        !hasPaidAccess && (tab.key === 'jobs' || tab.key === 'grants') ? { ...tab, hidden: true } : tab,
      )
      if (!isSuperAdmin) return withPaidHiding
      return [
        ...withPaidHiding,
        {
          key: 'admin',
          label: 'Manage',
          description: 'Create and manage platform-wide announcements.',
          icon: Pencil,
        },
      ]
    },
    [hasPaidAccess, isSuperAdmin],
  )

  const tabFromUrl = (searchParams.get('tab') as TabKey) || DEFAULT_TAB
  const activeTab: TabKey = tabConfig.some((tab) => tab.key === tabFromUrl && !tab.hidden)
    ? tabFromUrl
    : DEFAULT_TAB

  useEffect(() => {
    if (tabFromUrl !== activeTab) {
      setSearchParams(buildSearchParams(activeTab))
    }
  }, [activeTab, tabFromUrl, setSearchParams])

  const handleTabChange = (tab: TabKey) => {
    setSearchParams(buildSearchParams(tab))
  }

  const tabDescription = useMemo(() => {
    const details = tabConfig.find((tab) => tab.key === activeTab)
    return details?.description || ''
  }, [activeTab, tabConfig])

  return (
    <Stack spacing={6} pb={10}>
      <AnnouncementsHeader />

      <Stack spacing={2}>
        <TabNavigation activeTab={activeTab} onChange={handleTabChange} tabs={tabConfig} />
        <Text color="text.secondary" fontSize="sm">
          {tabDescription}
        </Text>
      </Stack>

      {activeTab === 'announcements' && <AnnouncementsTab />}
      {activeTab === 'events' && <EventsTab />}
      {activeTab === 'jobs' && <JobsTab />}
      {activeTab === 'grants' && <GrantsTab />}
      {activeTab === 'admin' && isSuperAdmin && (
        <AdminTab authorName={profile?.fullName || profile?.firstName || 'T4L Team'} />
      )}
    </Stack>
  )
}
