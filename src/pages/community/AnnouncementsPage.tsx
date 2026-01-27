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
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Archive,
  Briefcase,
  CalendarDays,
  Coins,
  Inbox,
  Mail,
  MailOpen,
  RefreshCcw,
  CalendarClock,
  User,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import type { Announcement } from '@/hooks/useAnnouncements'
import { useEventsFeed } from '@/hooks/useEventsFeed'
import { WhatsAppCommunityCard } from '@/components/community/WhatsAppCommunityCard'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

const DEFAULT_TAB = 'events'

type TabKey = 'announcements' | 'events' | 'jobs' | 'grants'

const tabs: Array<{ key: TabKey; label: string; description: string; icon: React.ElementType; hidden?: boolean }> = [
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
        Explore events, job opportunities, and grants curated for the Village community.
      </Text>
    </Stack>
  </Box>
)

const TabNavigation: React.FC<{
  activeTab: TabKey
  onChange: (tab: TabKey) => void
  tabs: Array<{ key: TabKey; label: string; description: string; icon: React.ElementType; hidden?: boolean }>
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
  const indicatorColor = isUnread ? 'brand.primary' : 'border.subtle'
  const isArchived = announcement.isArchived

  return (
    <Box
      as="button"
      textAlign="left"
      width="100%"
      onClick={onOpen}
      borderWidth={1}
      borderColor={isUnread ? 'accent.purpleBorder' : 'border.subtle'}
      bg={isUnread ? 'accent.purpleSubtle' : 'surface.default'}
      boxShadow={isUnread ? 'md' : 'sm'}
      borderRadius="2xl"
      p={4}
      _hover={{ borderColor: 'purple.400', boxShadow: 'md' }}
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
              {isUnread && (
                <Badge colorScheme="purple" variant="solid" borderRadius="full">
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
            <IconButton
              aria-label={announcement.isArchived ? 'Restore announcement' : 'Archive announcement'}
              icon={<Icon as={announcement.isArchived ? RefreshCcw : Archive} boxSize={4} />}
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onToggleArchive()
              }}
            />
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
}> = ({ announcement, isOpen, onClose, onArchive, onRestore }) => {
  const isArchived = announcement.isArchived
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent borderRadius="2xl" overflow="hidden">
        <ModalHeader>
          <Stack spacing={1}>
            <Text fontSize="xs" fontWeight="bold" color="text.muted" letterSpacing="widest">
              ANNOUNCEMENT
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
        <ModalCloseButton rounded="full" mt={2} />
        <ModalBody>
          <Box borderWidth={1} borderColor="border.subtle" bg="surface.subtle" borderRadius="2xl" p={4}>
            <Text whiteSpace="pre-wrap" color="text.secondary" fontSize="md" lineHeight="tall">
              {announcement.message}
            </Text>
          </Box>
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
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const EventsTab: React.FC = () => {
  const { profile } = useAuth()
  const { events, loading: eventsLoading, error } = useEventsFeed()
  const isAdmin =
    profile?.role === UserRole.SUPER_ADMIN || profile?.role === UserRole.AMBASSADOR || profile?.role === UserRole.PARTNER

  const description = events.length
    ? 'All upcoming workshops, gatherings, learning sessions, and book club meetups now live on T4Leader. Head there to explore the full schedule and RSVP.'
    : "We've moved event discovery and book club updates to our dedicated T4Leader calendar. See what's coming up and reserve your spot."

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null)
  const { profile } = useAuth()
  const hasOrganization = Boolean(profile?.companyId || profile?.organizationId || profile?.companyCode)
  const hasPaidAccess = profile?.membershipStatus === 'paid' && hasOrganization
  const tabConfig = useMemo(
    () =>
      tabs.map((tab) =>
        !hasPaidAccess && (tab.key === 'jobs' || tab.key === 'grants') ? { ...tab, hidden: true } : tab,
      ),
    [hasPaidAccess],
  )

  const tabFromUrl = (searchParams.get('tab') as TabKey) || DEFAULT_TAB
  const activeTab: TabKey = tabConfig.some((tab) => tab.key === tabFromUrl && !tab.hidden) ? tabFromUrl : DEFAULT_TAB

  useEffect(() => {
    if (tabFromUrl !== activeTab) {
      setSearchParams(buildSearchParams(activeTab))
    }
  }, [activeTab, tabFromUrl, setSearchParams])

  useEffect(() => {
    setLoading(false)
    setError(null)
  }, [])

  const markAnnouncementAsRead = (id: string) => {
    setAnnouncements((prev) => prev.map((announcement) => (announcement.id === id ? { ...announcement, isRead: true } : announcement)))
  }

  const markAnnouncementAsUnread = (id: string) => {
    setAnnouncements((prev) => prev.map((announcement) => (announcement.id === id ? { ...announcement, isRead: false } : announcement)))
  }

  const archiveAnnouncement = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((announcement) =>
        announcement.id === id ? { ...announcement, isArchived: true, isRead: true } : announcement,
      ),
    )
  }

  const restoreAnnouncement = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((announcement) =>
        announcement.id === id ? { ...announcement, isArchived: false } : announcement,
      ),
    )
  }

  const openAnnouncement = (announcement: Announcement) => {
    setActiveAnnouncement(announcement)
    markAnnouncementAsRead(announcement.id)
    onOpen()
  }

  const closeAnnouncementModal = () => {
    setActiveAnnouncement(null)
    onClose()
  }

  const handleTabChange = (tab: TabKey) => {
    setSearchParams(buildSearchParams(tab))
  }

  const announcementDescription = useMemo(() => {
    const tabDetails = tabConfig.find((tab) => tab.key === activeTab)
    return tabDetails?.description || ''
  }, [activeTab, tabConfig])

  return (
    <Stack spacing={6} pb={10}>
      <AnnouncementsHeader />

      <Stack spacing={2}>
        <TabNavigation activeTab={activeTab} onChange={handleTabChange} tabs={tabConfig} />
        <Text color="text.secondary" fontSize="sm">
          {announcementDescription}
        </Text>
      </Stack>

      {activeTab === 'announcements' && (
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
                Loading content...
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
                      ? markAnnouncementAsUnread(announcement.id)
                      : markAnnouncementAsRead(announcement.id)
                  }
                  onToggleArchive={() =>
                    announcement.isArchived
                      ? restoreAnnouncement(announcement.id)
                      : archiveAnnouncement(announcement.id)
                  }
                />
              ))}
            </Grid>
          )}
        </Stack>
      )}

      {activeTab === 'events' && <EventsTab />}
      {activeTab === 'jobs' && <JobsTab />}
      {activeTab === 'grants' && <GrantsTab />}

      {activeAnnouncement && (
        <AnnouncementModal
          announcement={activeAnnouncement}
          isOpen={isOpen}
          onClose={closeAnnouncementModal}
          onArchive={() => archiveAnnouncement(activeAnnouncement.id)}
          onRestore={() => restoreAnnouncement(activeAnnouncement.id)}
        />
      )}
    </Stack>
  )
}
