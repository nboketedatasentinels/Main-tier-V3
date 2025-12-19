import React, { useEffect, useMemo } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  ButtonGroup,
  chakra,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  Coins,
} from 'lucide-react'
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
}> = ({ activeTab, onChange }) => {
  const visibleTabs = tabs.filter((tab) => !tab.hidden)
  return (
    <ButtonGroup spacing={3} flexWrap="wrap">
      {visibleTabs.map((tab) => (
        <Button
          key={tab.key}
          variant={activeTab === tab.key ? 'solid' : 'ghost'}
          colorScheme={activeTab === tab.key ? 'purple' : undefined}
          borderRadius="full"
          bg={activeTab === tab.key ? 'purple.600' : 'white'}
          color={activeTab === tab.key ? 'white' : 'gray.700'}
          borderWidth={1}
          borderColor={activeTab === tab.key ? 'purple.600' : 'gray.200'}
          boxShadow={activeTab === tab.key ? 'lg' : 'none'}
          leftIcon={<Icon as={tab.icon} boxSize={4} />}
          _hover={{ bg: activeTab === tab.key ? 'purple.700' : 'gray.50' }}
          _focus={{ boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.4)' }}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </Button>
      ))}
    </ButtonGroup>
  )
}



const EventsTab: React.FC = () => {
  const { profile } = useAuth()
  const { events, loading: eventsLoading, error } = useEventsFeed()
  const isAdmin =
    profile?.role === UserRole.SUPER_ADMIN || profile?.role === UserRole.AMBASSADOR || profile?.role === UserRole.COMPANY_ADMIN

  const description = events.length
    ? 'All upcoming workshops, gatherings, and learning sessions now live on our T4Leader events calendar. Head there to explore the full schedule and RSVP.'
    : "We've moved event discovery to our dedicated T4Leader events calendar. Visit the full schedule to see what's coming up and reserve your spot."

  return (
    <Stack spacing={4}>
      {error && (
        <Alert status="error" borderRadius="xl" borderWidth={1} borderColor="red.200" bg="red.50">
          <AlertIcon />
          <AlertDescription fontSize="sm">{error}</AlertDescription>
        </Alert>
      )}

      {isAdmin && (
        <Box borderWidth={1} borderColor="gray.200" bg="white" borderRadius="3xl" p={6} boxShadow="sm">
          <Stack spacing={2}>
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="widest">
              EXTERNAL MANAGEMENT
            </Text>
            <Heading size="md" color="gray.900">
              Events are managed in the external admin portal
            </Heading>
            <Text color="gray.600" fontSize="sm">
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
        borderColor="gray.200"
        borderStyle="dashed"
        bg="white"
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
          <Heading size="lg" color="gray.900">
            Experience what's happening next
          </Heading>
          <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            {description}
          </Text>
          <Button
            as={chakra.a}
            href="https://www.t4leader.com/event-list"
            target="_blank"
            rel="noopener noreferrer"
            colorScheme="purple"
            size="lg"
            rightIcon={<ArrowUpRight size={18} />}
          >
            View Events
          </Button>
          {eventsLoading && (
            <Text color="gray.400" fontSize="xs" letterSpacing="widest">
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
      link={import.meta.env.VITE_WHATSAPP_COMMUNITY_LINK || '#'}
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
      link={import.meta.env.VITE_WHATSAPP_COMMUNITY_LINK || '#'}
      ctaLabel="Open WhatsApp grants space"
      communityName="Grants & Funding"
    />
  </Stack>
)

export const AnnouncementsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const tabFromUrl = (searchParams.get('tab') as TabKey) || DEFAULT_TAB
  const activeTab: TabKey = tabs.some((tab) => tab.key === tabFromUrl) ? tabFromUrl : DEFAULT_TAB

  useEffect(() => {
    if (tabFromUrl === 'announcements') {
      setSearchParams(buildSearchParams('events'))
    }
  }, [tabFromUrl, setSearchParams])

  const handleTabChange = (tab: TabKey) => {
    setSearchParams(buildSearchParams(tab))
  }

  const announcementDescription = useMemo(() => {
    const tabDetails = tabs.find((tab) => tab.key === activeTab)
    return tabDetails?.description || ''
  }, [activeTab])

  return (
    <Stack spacing={6} pb={10}>
      <AnnouncementsHeader />

      <Stack spacing={2}>
        <TabNavigation activeTab={activeTab} onChange={handleTabChange} />
        <Text color="gray.600" fontSize="sm">
          {announcementDescription}
        </Text>
      </Stack>

      {activeTab === 'events' && <EventsTab />}
      {activeTab === 'jobs' && <JobsTab />}
      {activeTab === 'grants' && <GrantsTab />}
    </Stack>
  )
}
