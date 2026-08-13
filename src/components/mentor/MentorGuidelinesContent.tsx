import React from 'react'
import {
  Box,
  Divider,
  HStack,
  ListItem,
  OrderedList,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  UnorderedList,
  VStack,
} from '@chakra-ui/react'
import {
  MENTOR_GUIDELINES_META,
  MENTOR_GUIDELINES_SECTIONS,
  type MentorGuidelinesBlock,
  type MentorGuidelinesSection,
} from '@/content/mentorGuidelines'

const BlockRenderer: React.FC<{ block: MentorGuidelinesBlock; compact?: boolean }> = ({
  block,
  compact,
}) => {
  switch (block.type) {
    case 'paragraph':
      return (
        <Text color="gray.700" fontSize={compact ? 'sm' : 'md'} lineHeight="1.7">
          {block.text}
        </Text>
      )
    case 'emphasis':
      return (
        <Box
          borderLeft="3px solid"
          borderColor="brand.primary"
          pl={4}
          py={1}
          bg="brand.primaryMuted"
          borderRadius="md"
        >
          <Text color="gray.800" fontSize={compact ? 'sm' : 'md'} lineHeight="1.7" fontWeight="500">
            {block.text}
          </Text>
        </Box>
      )
    case 'bullets':
      return (
        <UnorderedList spacing={2} pl={1} color="gray.700" fontSize={compact ? 'sm' : 'md'}>
          {block.items.map((item) => (
            <ListItem key={item.slice(0, 48)} lineHeight="1.65">
              {item}
            </ListItem>
          ))}
        </UnorderedList>
      )
    case 'numbered':
      return (
        <OrderedList spacing={3} pl={1} color="gray.700" fontSize={compact ? 'sm' : 'md'}>
          {block.items.map((item) => (
            <ListItem key={item.slice(0, 48)} lineHeight="1.65">
              {item}
            </ListItem>
          ))}
        </OrderedList>
      )
    case 'table':
      return (
        <Box overflowX="auto" border="1px solid" borderColor="gray.200" borderRadius="md">
          <Table size="sm" variant="simple">
            <Thead bg="gray.50">
              <Tr>
                {block.table.headers.map((header) => (
                  <Th key={header} color="brand.dark" fontSize="xs" letterSpacing="0.06em" py={3}>
                    {header}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {block.table.rows.map((row) => (
                <Tr key={row.join('|').slice(0, 64)}>
                  {row.map((cell, idx) => (
                    <Td
                      key={`${idx}-${cell.slice(0, 24)}`}
                      fontSize={compact ? 'xs' : 'sm'}
                      color="gray.700"
                      verticalAlign="top"
                      lineHeight="1.55"
                      fontWeight={idx === 0 ? '600' : '400'}
                    >
                      {cell}
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )
    case 'subsection':
      return (
        <Box>
          <Text
            fontSize={compact ? 'sm' : 'md'}
            fontWeight="700"
            color="brand.dark"
            mb={3}
            letterSpacing="-0.01em"
          >
            {block.title}
          </Text>
          <VStack align="stretch" spacing={3}>
            {block.blocks.map((child, i) => (
              <BlockRenderer key={`${block.title}-${i}`} block={child} compact={compact} />
            ))}
          </VStack>
        </Box>
      )
    case 'promptGroup':
      return (
        <Box>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color="gray.500"
            mb={3}
          >
            {block.title}
          </Text>
          <VStack align="stretch" spacing={2}>
            {block.prompts.map((prompt) => (
              <HStack key={prompt.n} align="flex-start" spacing={3}>
                <Text
                  minW="28px"
                  fontSize="xs"
                  fontWeight="700"
                  color="brand.primary"
                  pt="2px"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {prompt.n}.
                </Text>
                <Text fontSize={compact ? 'sm' : 'md'} color="gray.700" lineHeight="1.6">
                  {prompt.text}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )
    default:
      return null
  }
}

const SectionCard: React.FC<{
  section: MentorGuidelinesSection
  compact?: boolean
}> = ({ section, compact }) => (
  <Box
    id={`guideline-${section.id}`}
    as="section"
    scrollMarginTop="24px"
    border="1px solid"
    borderColor="gray.200"
    borderRadius="lg"
    bg="white"
    overflow="hidden"
  >
    <HStack
      spacing={3}
      px={{ base: 4, md: 5 }}
      py={3.5}
      bg="gray.50"
      borderBottom="1px solid"
      borderColor="gray.200"
    >
      <Box
        w="28px"
        h="28px"
        borderRadius="full"
        bg="brand.primary"
        color="white"
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize="xs"
        fontWeight="700"
        flexShrink={0}
      >
        {section.number}
      </Box>
      <Text fontWeight="700" color="brand.dark" fontSize={compact ? 'md' : 'lg'} letterSpacing="-0.01em">
        {section.title}
      </Text>
    </HStack>
    <VStack align="stretch" spacing={4} px={{ base: 4, md: 5 }} py={{ base: 4, md: 5 }}>
      {section.blocks.map((block, i) => (
        <BlockRenderer key={`${section.id}-${i}`} block={block} compact={compact} />
      ))}
    </VStack>
  </Box>
)

export type MentorGuidelinesContentProps = {
  compact?: boolean
  showHeader?: boolean
  maxSections?: number
}

export const MentorGuidelinesContent: React.FC<MentorGuidelinesContentProps> = ({
  compact = false,
  showHeader = true,
  maxSections,
}) => {
  const sections = maxSections
    ? MENTOR_GUIDELINES_SECTIONS.slice(0, maxSections)
    : MENTOR_GUIDELINES_SECTIONS

  return (
    <VStack align="stretch" spacing={6}>
      {showHeader ? (
        <Box>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="0.14em"
            textTransform="uppercase"
            color="brand.primary"
          >
            Mentorship handbook
          </Text>
          <Text
            mt={2}
            fontSize={compact ? 'xl' : { base: '2xl', md: '3xl' }}
            fontWeight="800"
            color="brand.dark"
            letterSpacing="-0.03em"
            lineHeight="1.15"
          >
            {MENTOR_GUIDELINES_META.title}
          </Text>
          <Text mt={2} color="gray.600" fontSize={compact ? 'sm' : 'md'}>
            {MENTOR_GUIDELINES_META.subtitle}
          </Text>
          <Text mt={1} color="gray.500" fontSize="sm">
            {MENTOR_GUIDELINES_META.version}
          </Text>
          <Divider mt={5} borderColor="gray.200" />
        </Box>
      ) : null}

      {sections.map((section) => (
        <SectionCard key={section.id} section={section} compact={compact} />
      ))}
    </VStack>
  )
}
