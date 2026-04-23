import React from 'react'
import {
  Box,
  Button,
  chakra,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { ExternalLink, Hammer, Music2, Wrench } from 'lucide-react'

const TIKTOK_URL = 'https://www.tiktok.com/@t4leaders'
const T4L_TOOLS_URL = 'https://www.t4leader.com/tools'

const ExternalCard: React.FC<{
  title: string
  description: string
  ctaLabel: string
  href: string
  icon: React.ElementType
  accent: string
}> = ({ title, description, ctaLabel, href, icon, accent }) => (
  <Box
    borderWidth={1}
    borderColor="border.subtle"
    bg="surface.default"
    borderRadius="2xl"
    p={{ base: 5, md: 6 }}
    boxShadow="sm"
  >
    <Stack spacing={3}>
      <HStack spacing={3} color={accent}>
        <Icon as={icon} boxSize={5} />
        <Text fontSize="xs" fontWeight="bold" letterSpacing="widest">
          {title.toUpperCase()}
        </Text>
      </HStack>
      <Heading size="sm" color="text.primary">
        {title}
      </Heading>
      <Text color="text.secondary" fontSize="sm">
        {description}
      </Text>
      <Button
        as={chakra.a}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        colorScheme="purple"
        rightIcon={<Icon as={ExternalLink} boxSize={4} />}
        alignSelf="flex-start"
      >
        {ctaLabel}
      </Button>
    </Stack>
  </Box>
)

const TikTokTab = () => (
  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
    <ExternalCard
      title="T4L on TikTok"
      description="Bite-sized leadership drops, behind-the-scenes moments, and reels you can share with your ecosystem."
      ctaLabel="Open TikTok"
      href={TIKTOK_URL}
      icon={Music2}
      accent="pink.500"
    />
    <Box
      borderWidth={1}
      borderColor="border.subtle"
      bg="surface.subtle"
      borderRadius="2xl"
      p={{ base: 5, md: 6 }}
    >
      <Stack spacing={3}>
        <Heading size="sm" color="text.primary">
          How to use it
        </Heading>
        <Text color="text.secondary" fontSize="sm">
          Follow the TikTok to stay on top of the moments we can't fit into a full episode.
          Drop reactions, duet what resonates, and tag a peer who needs the reminder.
        </Text>
      </Stack>
    </Box>
  </SimpleGrid>
)

const T4LToolsTab = () => (
  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
    <ExternalCard
      title="T4L Tools library"
      description="Our living toolkit of frameworks, worksheets, and exercises used across journeys. Downloadable and ready to bring into your team."
      ctaLabel="Open tools library"
      href={T4L_TOOLS_URL}
      icon={Wrench}
      accent="purple.500"
    />
    <Box
      borderWidth={1}
      borderColor="border.subtle"
      bg="surface.subtle"
      borderRadius="2xl"
      p={{ base: 5, md: 6 }}
    >
      <Stack spacing={3}>
        <Heading size="sm" color="text.primary">
          What's inside
        </Heading>
        <Text color="text.secondary" fontSize="sm">
          Reflection prompts, decision frameworks, facilitation guides, and printable
          worksheets — versioned so you always pull the latest.
        </Text>
      </Stack>
    </Box>
  </SimpleGrid>
)

export const ToolsPage: React.FC = () => (
  <Stack spacing={6} pb={10}>
    <Box bg="white" p={6} borderRadius="3xl" borderWidth={1} borderColor="brand.border" boxShadow="sm">
      <Stack spacing={2}>
        <HStack spacing={2} color="purple.600">
          <Icon as={Hammer} boxSize={5} />
          <Text fontSize="xs" fontWeight="bold" letterSpacing="widest">
            TOOLS
          </Text>
        </HStack>
        <Heading size="lg" color="brand.text">
          Tools
        </Heading>
        <Text color="brand.subtleText" fontSize="md">
          Short-form content and hands-on resources you can take into your week.
        </Text>
      </Stack>
    </Box>

    <Tabs variant="soft-rounded" colorScheme="purple" isLazy>
      <TabList flexWrap="wrap" gap={2}>
        <Tab>
          <HStack spacing={2}>
            <Icon as={Music2} boxSize={4} />
            <Text>TikTok</Text>
          </HStack>
        </Tab>
        <Tab>
          <HStack spacing={2}>
            <Icon as={Wrench} boxSize={4} />
            <Text>T4L Tools</Text>
          </HStack>
        </Tab>
      </TabList>
      <TabPanels mt={4}>
        <TabPanel px={0}>
          <TikTokTab />
        </TabPanel>
        <TabPanel px={0}>
          <T4LToolsTab />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Stack>
)

export default ToolsPage
