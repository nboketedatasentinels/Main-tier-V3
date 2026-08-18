import React, { useMemo } from 'react'
import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { LiftCapabilityRadar } from '@/components/session-prep/LiftCapabilityRadar'
import { SessionArc } from '@/components/session-prep/SessionArc'
import {
  buildSessionPrepModel,
  type SessionPrepInput,
} from '@/services/sessionPrepContent'

export interface SessionPrepPanelProps {
  input: SessionPrepInput
  onPrimary?: () => void
  onSecondary?: () => void
  primaryLoading?: boolean
}

const MonoLabel: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = '#6B6579',
}) => (
  <Text
    fontFamily="mono"
    fontSize="10px"
    letterSpacing="0.16em"
    textTransform="uppercase"
    color={color}
    mb={2.5}
    fontWeight="500"
  >
    {children}
  </Text>
)

/**
 * Session Prep screen - mentor / coach / leader readings of one profile.
 * Visual language follows the T4L Session Prep mockup (cream / charcoal / gold).
 */
export const SessionPrepPanel: React.FC<SessionPrepPanelProps> = ({
  input,
  onPrimary,
  onSecondary,
  primaryLoading,
}) => {
  const model = useMemo(() => buildSessionPrepModel(input), [input])
  const isLeader = model.audience === 'leader'
  const initials = model.personTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <Box
      bg="#FDF8EF"
      borderRadius="14px"
      overflow="hidden"
      border="1px solid"
      borderColor="rgba(35,31,48,.14)"
      color="#231F30"
      fontFamily="'DM Sans', system-ui, sans-serif"
    >
      <Flex
        px={{ base: 4, md: 6 }}
        py={4}
        borderBottom="1px solid"
        borderColor="rgba(35,31,48,.14)"
        justify="space-between"
        align={{ base: 'flex-start', md: 'flex-end' }}
        gap={4}
        flexWrap="wrap"
        bgGradient="linear(180deg, rgba(212,160,23,.07), transparent)"
      >
        <Box>
          <Text fontFamily="mono" fontSize="11px" letterSpacing="0.1em" textTransform="uppercase" color="#6B6579" m={0}>
            {model.scheduledLabel}
          </Text>
          <Text
            fontFamily="'DM Serif Display', Georgia, serif"
            fontWeight="400"
            fontSize={{ base: '22px', md: '24px' }}
            mt={1}
            mb={1}
            lineHeight="1.2"
          >
            {isLeader ? `Before you meet ${model.personTitle.split(' ')[0]}` : `Session with ${model.personTitle.split(' ')[0]}`}
          </Text>
          <Text fontSize="12.5px" color="#6B6579" m={0}>
            {model.originLine}
          </Text>
        </Box>
        <Text
          fontFamily="mono"
          fontSize="10px"
          letterSpacing="0.11em"
          textTransform="uppercase"
          border="1px solid #D4A017"
          color="#7A5C08"
          bg="rgba(212,160,23,.12)"
          px={2.5}
          py={1}
          borderRadius="full"
          whiteSpace="nowrap"
        >
          {model.sessionPill}
        </Text>
      </Flex>

      <Grid templateColumns={{ base: '1fr', lg: '318px 1fr' }}>
        <Box
          p={{ base: 5, md: 6 }}
          borderRight={{ lg: '1px solid' }}
          borderBottom={{ base: '1px solid', lg: 'none' }}
          borderColor="rgba(35,31,48,.14)"
          bg="rgba(35,31,48,.025)"
        >
          <Stack spacing={6} divider={<Box borderTop="1px solid" borderColor="rgba(35,31,48,.14)" />}>
            <Box>
              <MonoLabel>{isLeader ? 'Your mentor' : 'Who you are meeting'}</MonoLabel>
              <Flex gap={3} align="flex-start">
                <Flex
                  w="46px"
                  h="46px"
                  borderRadius="full"
                  bg="#2D2A3E"
                  color="#FDF8EF"
                  align="center"
                  justify="center"
                  fontFamily="mono"
                  fontSize="14px"
                  flexShrink={0}
                >
                  {initials || '?'}
                </Flex>
                <Box>
                  <Text fontSize="17px" fontWeight="700" lineHeight="1.25" m={0}>
                    {model.personTitle}
                  </Text>
                  <Text fontSize="13px" color="#6B6579" whiteSpace="pre-line" mt={1} m={0}>
                    {model.personSubtitle}
                  </Text>
                </Box>
              </Flex>
              {model.journeyLine ? (
                <Text fontSize="12.5px" color="#6B6579" mt={3} lineHeight="1.55">
                  {model.journeyLine}
                </Text>
              ) : null}
            </Box>

            <Box>
              <MonoLabel>{isLeader ? 'Where you were in week 1' : 'Capability shape'}</MonoLabel>
              <LiftCapabilityRadar
                pillars={model.pillars}
                chosenPillar={model.chosenPillar}
                gapPillar={model.gapPillar}
                showScores={model.showScores}
              />
              {isLeader ? (
                <Text fontSize="12px" color="#6B6579" mt={2} lineHeight="1.55">
                  You take the LIFT Index again near journey end. This shape is yours, and your mentor can see it.
                </Text>
              ) : null}
            </Box>

            {!isLeader && model.tendencies.length > 0 ? (
              <Box>
                <MonoLabel>How they tend to work</MonoLabel>
                <Stack spacing={2.5} as="ul" pl={0} m={0} style={{ listStyle: 'none' }}>
                  {model.tendencies.map((line) => (
                    <Text
                      as="li"
                      key={line}
                      fontSize="13.5px"
                      lineHeight="1.62"
                      pl="14px"
                      position="relative"
                      _before={{
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: '9px',
                        w: '5px',
                        h: '5px',
                        borderRadius: 'full',
                        bg: '#D4A017',
                      }}
                    >
                      {line}
                    </Text>
                  ))}
                </Stack>
              </Box>
            ) : null}

            {!isLeader && model.costs.length > 0 ? (
              <Box>
                <MonoLabel>Where that costs them</MonoLabel>
                <Stack spacing={2.5}>
                  {model.costs.map((line) => (
                    <Text
                      key={line}
                      fontSize="13.5px"
                      lineHeight="1.62"
                      pl="14px"
                      position="relative"
                      color="#6B6579"
                      _before={{
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: '11px',
                        w: '8px',
                        h: '1px',
                        bg: 'rgba(35,31,48,.28)',
                      }}
                    >
                      {line}
                    </Text>
                  ))}
                </Stack>
              </Box>
            ) : null}

            {model.goalVerbatim ? (
              <Box>
                <MonoLabel>What they say they want</MonoLabel>
                <Text fontSize="13.5px" lineHeight="1.65" m={0}>
                  {model.goalVerbatim}
                </Text>
              </Box>
            ) : null}

            {model.challengeChips.length > 0 ? (
              <Box>
                <MonoLabel>How they take input</MonoLabel>
                <Wrap spacing={1.5}>
                  {model.challengeChips.map((chip) => (
                    <WrapItem key={chip}>
                      <Text
                        fontFamily="mono"
                        fontSize="10.5px"
                        letterSpacing="0.05em"
                        border="1px solid rgba(35,31,48,.28)"
                        borderRadius="full"
                        px={2.5}
                        py={1}
                        color="#2D2A3E"
                      >
                        {chip}
                      </Text>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            ) : null}

            {model.values.length > 0 && model.audience === 'mentor' ? (
              <Box>
                <MonoLabel>What they value</MonoLabel>
                <Wrap spacing={1.5}>
                  {model.values.map((v) => (
                    <WrapItem key={v}>
                      <Text
                        fontFamily="mono"
                        fontSize="10.5px"
                        letterSpacing="0.05em"
                        border="1px solid rgba(35,31,48,.28)"
                        borderRadius="full"
                        px={2.5}
                        py={1}
                        color="#2D2A3E"
                      >
                        {v}
                      </Text>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            ) : null}

            {model.offLimits ? (
              <Box>
                <MonoLabel>They have asked you not to raise</MonoLabel>
                <Box borderLeft="2px solid #B33A3A" pl={3}>
                  <Text fontSize="13px" lineHeight="1.55" color="#8A2F2F" m={0}>
                    {model.offLimits}
                  </Text>
                </Box>
              </Box>
            ) : null}
          </Stack>
        </Box>

        <Box p={{ base: 5, md: 6 }} minW={0}>
          <MonoLabel>{isLeader ? 'Your meet-ups' : model.audience === 'coach' ? 'The sessions' : 'Your meet-ups'}</MonoLabel>
          <SessionArc labels={model.arcLabels} currentIndex={model.arcCurrentIndex} note={model.arcNote} />

          {isLeader && model.goalVerbatim ? (
            <Box
              mt={7}
              border="1px solid rgba(35,31,48,.28)"
              borderRadius="10px"
              p={5}
              bg="rgba(212,160,23,.12)"
            >
              <MonoLabel>What you said you wanted</MonoLabel>
              <Text
                as="q"
                display="block"
                fontFamily="'DM Serif Display', Georgia, serif"
                fontSize="19px"
                lineHeight="1.42"
              >
                {model.goalVerbatim}
              </Text>
              <Text fontSize="12.5px" color="#6B6579" mt={3} lineHeight="1.6" m={0}>
                If it has changed, update it before the meet-up so your mentor works on the right thing.
              </Text>
            </Box>
          ) : null}

          {!isLeader && model.headline ? (
            <Box mt={7}>
              <MonoLabel>
                {model.audience === 'coach' ? 'Where the session probably is' : 'What they most need from this session'}
              </MonoLabel>
              <Text
                fontFamily="'DM Serif Display', Georgia, serif"
                fontWeight="400"
                fontSize={{ base: '20px', md: '23px' }}
                lineHeight="1.34"
                maxW="44ch"
                mt={1}
              >
                {model.headline}
              </Text>
            </Box>
          ) : null}

          {!isLeader && model.topics.length > 0 ? (
            <Box mt={6}>
              <MonoLabel>
                {model.audience === 'coach' ? 'Areas to open · pick one, not four' : 'Topics you could explore · pick one, not four'}
              </MonoLabel>
              <Stack spacing={0} mt={2}>
                {model.topics.map((topic) => (
                  <Box key={topic.title} py={5} borderTop="1px solid" borderColor="rgba(35,31,48,.14)">
                    <Flex justify="space-between" gap={3} align="baseline" flexWrap="wrap">
                      <Text fontFamily="mono" fontSize="10px" letterSpacing="0.14em" textTransform="uppercase" color="#9A7410">
                        {topic.pillarLabel}
                      </Text>
                      <Text
                        fontFamily="mono"
                        fontSize="9.5px"
                        letterSpacing="0.06em"
                        color="#6B6579"
                        textAlign="right"
                        whiteSpace="pre-line"
                      >
                        {topic.signalSource}
                      </Text>
                    </Flex>
                    <Text fontSize="16.5px" fontWeight="700" mt={2} mb={1.5} lineHeight="1.3">
                      {topic.title}
                    </Text>
                    <Text fontSize="13.5px" lineHeight="1.65" color="#6B6579" maxW="64ch" mb={4}>
                      {topic.why}
                    </Text>
                    <Box borderLeft="3px solid #D4A017" pl={4}>
                      <MonoLabel>{topic.sayLabel}</MonoLabel>
                      <Text
                        as="q"
                        display="block"
                        fontFamily="'DM Serif Display', Georgia, serif"
                        fontSize={{ base: '18px', md: '20px' }}
                        lineHeight="1.38"
                      >
                        {topic.sayAloud}
                      </Text>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}

          {isLeader && model.bringItems.length > 0 ? (
            <Box mt={7}>
              <MonoLabel>Things you could bring</MonoLabel>
              <Stack spacing={0}>
                {model.bringItems.map((item) => (
                  <Box key={item.title} borderTop="1px solid" borderColor="rgba(35,31,48,.14)" py={4}>
                    <Text fontSize="14.5px" lineHeight="1.55" fontWeight="500">
                      {item.title}
                    </Text>
                    <Text fontSize="12.5px" color="#6B6579" mt={1} lineHeight="1.6">
                      {item.hint}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}

          {model.opener ? (
            <Box mt={6} bg="#2D2A3E" color="#FDF8EF" borderRadius="10px" p={5}>
              <MonoLabel color="#D4A017">{model.opener.label}</MonoLabel>
              <Text
                as="q"
                display="block"
                fontFamily="'DM Serif Display', Georgia, serif"
                fontSize={{ base: '18px', md: '20px' }}
                lineHeight="1.4"
              >
                {model.opener.quote}
              </Text>
              <Text fontSize="12.5px" lineHeight="1.6" color="rgba(253,248,239,.6)" mt={3} m={0}>
                {model.opener.note}
              </Text>
            </Box>
          ) : null}

          {model.stanceReminders.length > 0 ? (
            <Box mt={6} border="1px dashed" borderColor="rgba(35,31,48,.28)" borderRadius="10px" p={4}>
              <MonoLabel>Stance reminders</MonoLabel>
              <Stack spacing={2}>
                {model.stanceReminders.map((line) => (
                  <Text key={line} fontSize="13px" lineHeight="1.65" color="#6B6579" m={0}>
                    {line}
                  </Text>
                ))}
              </Stack>
            </Box>
          ) : null}

          {isLeader ? (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={0} border="1px solid rgba(35,31,48,.28)" borderRadius="10px" overflow="hidden" mt={6}>
              <Box p={4} borderRight={{ md: '1px solid' }} borderBottom={{ base: '1px solid', md: 'none' }} borderColor="rgba(35,31,48,.28)">
                <MonoLabel>They can see</MonoLabel>
                <Stack spacing={1}>
                  {model.mentorCanSee.map((item) => (
                    <Text key={item} fontSize="12.5px" lineHeight="1.7" color="#6B6579">
                      <Text as="span" color="#D4A017" fontFamily="mono">
                        +{' '}
                      </Text>
                      {item}
                    </Text>
                  ))}
                </Stack>
              </Box>
              <Box p={4}>
                <MonoLabel>They cannot see</MonoLabel>
                <Stack spacing={1}>
                  {model.mentorCannotSee.map((item) => (
                    <Text key={item} fontSize="12.5px" lineHeight="1.7" color="#6B6579">
                      <Text as="span" color="#B33A3A" fontFamily="mono">
                        -{' '}
                      </Text>
                      {item}
                    </Text>
                  ))}
                </Stack>
              </Box>
            </SimpleGrid>
          ) : null}

          <HStack mt={6} spacing={2.5} flexWrap="wrap">
            {onPrimary ? (
              <Button
                bg="#2D2A3E"
                color="#FDF8EF"
                borderRadius="7px"
                px={4}
                h="42px"
                fontSize="13px"
                fontWeight="500"
                _hover={{ bg: '#1A1726' }}
                isLoading={primaryLoading}
                onClick={onPrimary}
              >
                {model.primaryActionLabel}
              </Button>
            ) : null}
            {onSecondary ? (
              <Button
                variant="outline"
                borderColor="#2D2A3E"
                color="#2D2A3E"
                borderRadius="7px"
                px={4}
                h="42px"
                fontSize="13px"
                fontWeight="500"
                bg="transparent"
                _hover={{ bg: 'rgba(35,31,48,.04)' }}
                onClick={onSecondary}
              >
                {model.secondaryActionLabel}
              </Button>
            ) : null}
          </HStack>
        </Box>
      </Grid>
    </Box>
  )
}

export default SessionPrepPanel
