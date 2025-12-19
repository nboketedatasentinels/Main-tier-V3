import React from 'react'
import {
  Badge,
  Box,
  Button,
  chakra,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ExternalLink, MessageCircle, ShieldCheck, Sparkles, Users } from 'lucide-react'

export interface WhatsAppCommunityCardProps {
  title: string
  description: string
  highlights: string[]
  guidelines: string[]
  link: string
  ctaLabel?: string
  communityName?: string
}

export const WhatsAppCommunityCard: React.FC<WhatsAppCommunityCardProps> = ({
  title,
  description,
  highlights,
  guidelines,
  link,
  ctaLabel = 'Open WhatsApp community',
  communityName = 'WhatsApp Community',
}) => {
  return (
    <Box borderWidth={1} borderColor="border.subtle" bg="surface.default" borderRadius="3xl" boxShadow="sm" p={{ base: 6, md: 8 }}>
      <Stack spacing={6}>
        <Stack spacing={3}>
          <Badge
            colorScheme="green"
            bg="green.50"
            color="green.700"
            px={3}
            py={1}
            borderRadius="full"
            w="fit-content"
            display="inline-flex"
            alignItems="center"
            gap={2}
          >
            <Icon as={MessageCircle} boxSize={4} />
            <Text fontWeight="semibold" fontSize="sm">
              {communityName}
            </Text>
          </Badge>
          <Stack spacing={2}>
            <Text fontSize="2xl" fontWeight="semibold" color="text.primary">
              {title}
            </Text>
            <Text color="text.secondary" fontSize={{ base: 'sm', md: 'md' }}>
              {description}
            </Text>
          </Stack>
          <Button
            as={chakra.a}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            colorScheme="purple"
            borderRadius="full"
            rightIcon={<ExternalLink size={18} />}
            alignSelf={{ base: 'stretch', md: 'flex-start' }}
          >
            {ctaLabel}
          </Button>
        </Stack>

        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
          <VStack
            align="stretch"
            spacing={4}
            borderWidth={1}
            borderColor="border.subtle"
            bg="surface.subtle"
            borderRadius="2xl"
            p={6}
          >
            <HStack spacing={3}>
              <Box bg="yellow.100" borderRadius="full" p={2} display="inline-flex">
                <Icon as={Sparkles} color="yellow.500" />
              </Box>
              <Text fontWeight="semibold" color="text.primary">
                What you'll find inside
              </Text>
            </HStack>
            <Stack spacing={3}>
              {highlights.map((highlight) => (
                <HStack key={highlight} align="flex-start" spacing={3}>
                  <Box bg="green.100" borderRadius="full" p={2} display="inline-flex">
                    <Icon as={Users} color="green.600" />
                  </Box>
                  <Text color="text.secondary" fontSize="sm">
                    {highlight}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </VStack>

          <VStack
            align="stretch"
            spacing={4}
            borderWidth={1}
            borderColor="border.subtle"
            bg="surface.subtle"
            borderRadius="2xl"
            p={6}
          >
            <HStack spacing={3}>
              <Box bg="green.100" borderRadius="full" p={2} display="inline-flex">
                <Icon as={ShieldCheck} color="green.600" />
              </Box>
              <Text fontWeight="semibold" color="text.primary">
                Community guidelines
              </Text>
            </HStack>
            <Stack spacing={3}>
              {guidelines.map((guideline) => (
                <HStack key={guideline} align="flex-start" spacing={3}>
                  <Box bg="purple.100" borderRadius="full" p={2} display="inline-flex">
                    <Box as="span" fontWeight="bold" color="brand.primary" fontSize="xs">
                      •
                    </Box>
                  </Box>
                  <Text color="text.secondary" fontSize="sm">
                    {guideline}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </VStack>
        </SimpleGrid>

        <Box borderWidth={1} borderColor="green.200" borderStyle="dashed" bg="green.50" p={4} borderRadius="xl">
          <Text fontSize="sm" color="text.secondary">
            This resource now lives in our WhatsApp community so you can collaborate directly with peers. Links open in a new
            tab.
          </Text>
        </Box>
      </Stack>
    </Box>
  )
}
