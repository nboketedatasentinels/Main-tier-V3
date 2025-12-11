import React from 'react'
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ArrowUpRight, Briefcase, CalendarDays, Coins, MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

const T4LEADER_EVENTS_URL = 'https://www.t4leader.com/event-list'
const WHATSAPP_JOB_BOARD_URL = 'https://chat.whatsapp.com'
const WHATSAPP_GRANTS_URL = 'https://chat.whatsapp.com'

const ExternalLinkButton: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <Button
    as="a"
    href={href}
    target="_blank"
    rel="noreferrer"
    colorScheme="brand"
    rightIcon={<ArrowUpRight size={16} />}
  >
    {label}
  </Button>
)

const AdminEventNotice: React.FC = () => (
  <Flex
    align="center"
    justify="space-between"
    p={4}
    border="1px solid"
    borderColor="brand.border"
    borderRadius="lg"
    bg="brand.primaryBg"
  >
    <Stack spacing={1}>
      <Heading size="sm" color="brand.text">
        Event management lives outside the app
      </Heading>
      <Text color="brand.subtleText">
        Admins can manage the T4Leader events calendar directly in the external portal.
      </Text>
    </Stack>
    <ExternalLinkButton href={T4LEADER_EVENTS_URL} label="Open event portal" />
  </Flex>
)

const WhatsAppCard: React.FC<{
  title: string
  description: string
  linkLabel: string
  linkUrl: string
  bullets: string[]
}> = ({ title, description, linkLabel, linkUrl, bullets }) => (
  <Box
    p={6}
    border="1px solid"
    borderColor="brand.border"
    borderRadius="xl"
    bg="white"
    boxShadow="sm"
  >
    <HStack spacing={3} mb={3}>
      <Icon as={MessageCircle} color="brand.gold" boxSize={5} />
      <Heading size="sm" color="brand.text">
        {title}
      </Heading>
    </HStack>
    <Text color="brand.subtleText" mb={4}>
      {description}
    </Text>
    <VStack align="stretch" spacing={2} mb={5}>
      {bullets.map((item) => (
        <HStack key={item} spacing={2} align="start">
          <Box as="span" color="brand.gold" fontWeight="bold">
            •
          </Box>
          <Text color="brand.text">{item}</Text>
        </HStack>
      ))}
    </VStack>
    <ExternalLinkButton href={linkUrl} label={linkLabel} />
  </Box>
)

export const AnnouncementsPage: React.FC = () => {
  const { hasAnyRole } = useAuth()
  const isAdmin = hasAnyRole([UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN])

  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" color="brand.text">
          Community Hub
        </Heading>
        <Text color="brand.subtleText">Explore events, job opportunities, and grants curated for the Village community.</Text>
      </Box>

      <Tabs colorScheme="brand" variant="enclosed" defaultIndex={0}>
        <TabList bg="white" border="1px solid" borderColor="brand.border" borderRadius="xl" overflow="hidden">
          <Tab gap={2} fontWeight="600">
            <Icon as={CalendarDays} boxSize={4} />
            Events
          </Tab>
          <Tab gap={2} fontWeight="600">
            <Icon as={Briefcase} boxSize={4} />
            Job Board
          </Tab>
          <Tab gap={2} fontWeight="600">
            <Icon as={Coins} boxSize={4} />
            Grants & Funding
          </Tab>
        </TabList>

        <TabPanels mt={4}>
          <TabPanel px={0}>
            <Stack spacing={4}>
              {isAdmin && <AdminEventNotice />}

              <Flex
                direction="column"
                align="center"
                justify="center"
                p={{ base: 6, md: 10 }}
                border="1px solid"
                borderColor="brand.border"
                borderRadius="xl"
                bg="white"
                boxShadow="sm"
                textAlign="center"
              >
                <Flex
                  align="center"
                  justify="center"
                  bg="brand.primaryBg"
                  color="brand.gold"
                  borderRadius="full"
                  boxSize={12}
                  mb={4}
                >
                  <Icon as={CalendarDays} boxSize={6} />
                </Flex>
                <Heading size="md" color="brand.text" mb={2}>
                  Experience what's happening next
                </Heading>
                <Text color="brand.subtleText" maxW="540px" mb={6}>
                  Visit the T4Leader events calendar to explore upcoming gatherings, workshops, and experiences hosted for
                  the Village community.
                </Text>
                <ExternalLinkButton href={T4LEADER_EVENTS_URL} label="View Events" />
              </Flex>
            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={4}>
              <Box
                p={4}
                border="1px solid"
                borderColor="brand.border"
                borderRadius="lg"
                bg="brand.primaryBg"
              >
                <Text color="brand.text" fontWeight="600">
                  Join the conversation on WhatsApp
                </Text>
                <Text color="brand.subtleText">
                  Share roles, referrals, and leads directly with the community in our dedicated WhatsApp space.
                </Text>
              </Box>

              <WhatsAppCard
                title="Village Job Board"
                description="Tap into the community to post and discover roles, referrals, and opportunities."
                linkLabel="Open WhatsApp community"
                linkUrl={WHATSAPP_JOB_BOARD_URL}
                bullets={['Post openings and referrals', 'Share hiring processes and tips', 'Network with community recruiters']}
              />
            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={4}>
              <Box
                p={4}
                border="1px solid"
                borderColor="brand.border"
                borderRadius="lg"
                bg="brand.primaryBg"
              >
                <Text color="brand.text" fontWeight="600">
                  Grants & funding made social
                </Text>
                <Text color="brand.subtleText">
                  Discover funding opportunities shared by the community and collaborate on applications via WhatsApp.
                </Text>
              </Box>

              <WhatsAppCard
                title="Grants & Funding"
                description="Stay updated on scholarships, grants, and sponsorships surfaced by fellow Villagers."
                linkLabel="Open WhatsApp community"
                linkUrl={WHATSAPP_GRANTS_URL}
                bullets={['Share open grant opportunities', 'Swap tips on applications and deadlines', 'Celebrate wins together']}
              />
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Stack>
  )
}
