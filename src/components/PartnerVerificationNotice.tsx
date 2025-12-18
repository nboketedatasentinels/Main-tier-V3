import React from 'react'
import { Badge, Box, Heading, List, ListIcon, ListItem, Stack, Text } from '@chakra-ui/react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'

export const PartnerVerificationNotice: React.FC = () => {
  return (
    <Box
      bgGradient="linear(to-r, purple.50, orange.50)"
      border="1px solid"
      borderColor="purple.100"
      borderRadius="2xl"
      p={{ base: 4, md: 6 }}
      boxShadow="md"
    >
      <Stack spacing={3}>
        <Badge
          colorScheme="purple"
          variant="subtle"
          borderRadius="full"
          px={3}
          py={1}
          width="fit-content"
          display="inline-flex"
          alignItems="center"
          gap={2}
        >
          <ShieldCheck size={16} />
          Partner verification required
        </Badge>

        <Heading size="md" color="purple.900">
          Essential for genuine participation and accountability
        </Heading>
        <Text color="purple.800" fontSize="sm">
          Verification from your partner team is required for webinars, book clubs, and course completion points to confirm
          real attendance and follow-through.
        </Text>

        <List spacing={2} color="purple.900" fontSize="sm">
          <ListItem display="flex" gap={2} alignItems="flex-start">
            <ListIcon as={CheckCircle2} color="purple.600" mt={0.5} />
            <Text flex="1">
              <Text as="span" fontWeight="semibold">
                Webinars:
              </Text>{' '}
              Partner approval confirms you attended and participated, not just registered.
            </Text>
          </ListItem>
          <ListItem display="flex" gap={2} alignItems="flex-start">
            <ListIcon as={CheckCircle2} color="purple.600" mt={0.5} />
            <Text flex="1">
              <Text as="span" fontWeight="semibold">
                Book club:
              </Text>{' '}
              Participation is validated through partner approval to keep discussions accountable and high-quality.
            </Text>
          </ListItem>
          <ListItem display="flex" gap={2} alignItems="flex-start">
            <ListIcon as={CheckCircle2} color="purple.600" mt={0.5} />
            <Text flex="1">
              <Text as="span" fontWeight="semibold">
                Course completion:
              </Text>{' '}
              Points are awarded after partners confirm you completed the course within the required timeframe.
            </Text>
          </ListItem>
        </List>
      </Stack>
    </Box>
  )
}

export default PartnerVerificationNotice
