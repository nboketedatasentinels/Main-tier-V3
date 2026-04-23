import React from 'react'
import {
  Box,
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
} from '@chakra-ui/react'
import { Briefcase, BookMarked, Coins, MessageCircle, Sparkles } from 'lucide-react'
import { WhatsAppCommunityCard } from '@/components/community/WhatsAppCommunityCard'
import { JoinUs as BookClubJoinUs } from '@/components/dashboard/bookClub/JoinUs'
import { GrantsTab, JobsTab } from '@/pages/community/AnnouncementsPage'

const WHATSAPP_SHAMELESS_LINK = 'https://chat.whatsapp.com/GU834qw8x6JHYgrzDBUT5i?mode=ems_copy_t'

const ShamelessCircleTab = () => (
  <Stack spacing={4}>
    <WhatsAppCommunityCard
      title="Join the Shameless Circle WhatsApp community"
      description="An exclusive hub for Shameless Tuesday podcast enthusiasts — go deeper on episodes, share 'aha!' moments, and connect with fellow listeners worldwide."
      highlights={[
        'Exclusive discussions about each episode',
        'Network with like-minded listeners around the globe',
        'Instant updates, bonus content, and Q&A opportunities',
        'Suggested reading and listening schedules to stay on track',
      ]}
      guidelines={[
        'Keep conversations respectful and on-topic to each episode',
        'Share timestamps when referencing specific moments',
        'Credit fellow members when building on their insights',
        'Use threads to keep parallel conversations organized',
      ]}
      link={WHATSAPP_SHAMELESS_LINK}
      ctaLabel="Open Shameless Circle on WhatsApp"
      communityName="Shameless Circle"
    />
  </Stack>
)

const JobsAndGrantsTab = () => (
  <Stack spacing={6}>
    <JobsTab />
    <GrantsTab />
  </Stack>
)

export const WhatsAppAccessPage: React.FC = () => {
  return (
    <Stack spacing={6} pb={10}>
      <Box bg="white" p={6} borderRadius="3xl" borderWidth={1} borderColor="brand.border" boxShadow="sm">
        <Stack spacing={2}>
          <HStack spacing={2} color="green.600">
            <Icon as={MessageCircle} boxSize={5} />
            <Text fontSize="xs" fontWeight="bold" letterSpacing="widest">
              WHATSAPP ACCESS
            </Text>
          </HStack>
          <Heading size="lg" color="brand.text">
            WhatsApp Access
          </Heading>
          <Text color="brand.subtleText" fontSize="md">
            Jump into the WhatsApp communities where T4L conversations happen in real time — reading
            circles, podcast discussions, jobs, and grants.
          </Text>
        </Stack>
      </Box>

      <Tabs variant="soft-rounded" colorScheme="purple" isLazy>
        <TabList flexWrap="wrap" gap={2}>
          <Tab>
            <HStack spacing={2}>
              <Icon as={BookMarked} boxSize={4} />
              <Text>Book Club</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Icon as={Sparkles} boxSize={4} />
              <Text>Shameless Circle</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Icon as={Briefcase} boxSize={4} />
              <Icon as={Coins} boxSize={4} />
              <Text>Jobs &amp; Grants</Text>
            </HStack>
          </Tab>
        </TabList>
        <TabPanels mt={4}>
          <TabPanel px={0}>
            <BookClubJoinUs />
          </TabPanel>
          <TabPanel px={0}>
            <ShamelessCircleTab />
          </TabPanel>
          <TabPanel px={0}>
            <JobsAndGrantsTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Stack>
  )
}

export default WhatsAppAccessPage
