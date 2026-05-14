import React from 'react'
import {
  Box,
  Button,
  chakra,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ExternalLink, Hammer, Music2, Wrench } from 'lucide-react'

const TIKTOK_URL = 'https://www.tiktok.com/@t4leader'
const T4L_TOOLS_URL = 'https://www.t4leader.com/tools'

interface ToolCardProps {
  eyebrow: string
  title: string
  description: string
  ctaLabel: string
  href: string
  icon: React.ElementType
  iconBg: string
  iconShadow: string
  ornamentBg: string
  hoverShadow: string
  buttonScheme: string
}

const ToolCard: React.FC<ToolCardProps> = ({
  eyebrow,
  title,
  description,
  ctaLabel,
  href,
  icon,
  iconBg,
  iconShadow,
  ornamentBg,
  hoverShadow,
  buttonScheme,
}) => (
  <Box
    bg="white"
    p={{ base: 5, md: 6 }}
    borderRadius="xl"
    boxShadow="0 2px 8px rgba(0,0,0,0.04)"
    _hover={{ transform: 'translateY(-2px)', boxShadow: hoverShadow }}
    transition="all 0.3s ease"
    position="relative"
    overflow="hidden"
    h="100%"
  >
    <Box
      position="absolute"
      top={0}
      right={0}
      w="90px"
      h="90px"
      bg={ornamentBg}
      borderRadius="0 0 0 100%"
    />
    <Stack spacing={5} h="100%" position="relative" zIndex={1}>
      <HStack spacing={3} align="center">
        <Flex
          w={12}
          h={12}
          bg={iconBg}
          borderRadius="xl"
          align="center"
          justify="center"
          boxShadow={iconShadow}
          flexShrink={0}
        >
          <Icon as={icon} boxSize={6} color="white" />
        </Flex>
        <Stack spacing={0}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wide"
            color="gray.500"
          >
            {eyebrow}
          </Text>
          <Heading size="md" color="gray.800">
            {title}
          </Heading>
        </Stack>
      </HStack>

      <Text color="gray.600" fontSize="sm" lineHeight="1.6" flex={1}>
        {description}
      </Text>

      <Button
        as={chakra.a}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        colorScheme={buttonScheme}
        rightIcon={<Icon as={ExternalLink} boxSize={4} />}
        alignSelf="flex-start"
        size="md"
      >
        {ctaLabel}
      </Button>
    </Stack>
  </Box>
)

export const ToolsPage: React.FC = () => (
  <Stack spacing={6} pb={10}>
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
            <Icon as={Hammer} boxSize={5} color="white" />
          </Flex>
          <Stack spacing={0}>
            <Heading size="md" color="gray.800">
              Tools
            </Heading>
            <Text color="gray.500" fontSize="sm">
              Two ways to keep learning between sessions.
            </Text>
          </Stack>
        </HStack>
      </Stack>
    </Box>

    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
      <ToolCard
        eyebrow="Watch"
        title="T4L on TikTok"
        description="Short, sharp leadership clips you can watch on a coffee break and share with your team."
        ctaLabel="Open TikTok"
        href={TIKTOK_URL}
        icon={Music2}
        iconBg="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
        iconShadow="0 4px 12px rgba(15, 23, 42, 0.3)"
        ornamentBg="gray.100"
        hoverShadow="0 8px 25px rgba(15, 23, 42, 0.15)"
        buttonScheme="gray"
      />
      <ToolCard
        eyebrow="Download"
        title="T4L Tools library"
        description="Frameworks, worksheets, and facilitation guides you can pull straight into your week."
        ctaLabel="Browse tools"
        href={T4L_TOOLS_URL}
        icon={Wrench}
        iconBg="#350e6f"
        iconShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
        ornamentBg="purple.50"
        hoverShadow="0 8px 25px rgba(139, 92, 246, 0.15)"
        buttonScheme="purple"
      />
    </SimpleGrid>
  </Stack>
)

export default ToolsPage
