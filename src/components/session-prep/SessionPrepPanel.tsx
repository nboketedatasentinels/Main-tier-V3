import React, { useMemo } from 'react'
import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
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
  leaderGoalEditor?: React.ReactNode
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
 * Professional white / plum palette (aligned with Impact Log cards).
 */
export const SessionPrepPanel: React.FC<SessionPrepPanelProps> = ({
  input,
  leaderGoalEditor,
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

  const hairline = 'rgba(53, 14, 111, 0.16)'

  return (
    <Box
      bg="white"
      borderRadius="xl"
      overflow="hidden"
      borderWidth="1px"
      borderStyle="solid"
      borderColor={hairline}
      color="#27062e"
      boxShadow="0 1px 3px rgba(0,0,0,0.03)"
      fontFamily="'DM Sans', system-ui, sans-serif"
    >
      <Flex
        px={{ base: 4, md: 6 }}
        py={4}
        borderBottom="1px solid"
        borderColor={hairline}
        justify="space-between"
        align={{ base: 'flex-start', md: 'flex-end' }}
        gap={4}
        flexWrap="wrap"
        bg="gray.50"
      >
        <Box>
          <Text fontFamily="mono" fontSize="11px" letterSpacing="0.1em" textTransform="uppercase" color="gray.500" m={0}>
            {model.scheduledLabel}
          </Text>
          <Text
            fontFamily="'DM Serif Display', Georgia, serif"
            fontWeight="400"
            fontSize={{ base: '22px', md: '24px' }}
            mt={1}
            mb={1}
            lineHeight="1.2"
            color="#27062e"
          >
            {isLeader ? `Before you meet ${model.personTitle.split(' ')[0]}` : `Session with ${model.personTitle.split(' ')[0]}`}
          </Text>
          <Text fontSize="12.5px" color="gray.600" m={0}>
            {model.originLine}
          </Text>
        </Box>
        <Text
          fontFamily="mono"
          fontSize="10px"
          letterSpacing="0.11em"
          textTransform="uppercase"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="rgba(53, 14, 111, 0.28)"
          color="#350e6f"
          bg="rgba(53, 14, 111, 0.06)"
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
          p={{ base: isLeader ? 4 : 5, md: isLeader ? 4 : 6 }}
          borderRight={{ lg: '1px solid' }}
          borderBottom={{ base: '1px solid', lg: 'none' }}
          borderColor={hairline}
          bg="white"
        >
          <Stack
            spacing={isLeader ? 3 : 6}
            divider={<Box borderTop="1px solid" borderColor={hairline} />}
          >
            <Box>
              <MonoLabel>{isLeader ? 'Your mentor' : 'Who you are meeting'}</MonoLabel>
              <Flex gap={3} align="flex-start">
                <Flex
                  w="46px"
                  h="46px"
                  borderRadius="full"
                  bg="#350e6f"
                  color="white"
                  align="center"
                  justify="center"
                  fontFamily="mono"
                  fontSize="14px"
                  flexShrink={0}
                >
                  {initials || '?'}
                </Flex>
                <Box>
                  <Text fontSize="17px" fontWeight="700" lineHeight="1.25" m={0} color="#27062e">
                    {model.personTitle}
                  </Text>
                  <Text fontSize="13px" color="gray.600" whiteSpace="pre-line" mt={1} m={0}>
                    {model.personSubtitle}
                  </Text>
                </Box>
              </Flex>
              {model.journeyLine ? (
                <Text fontSize="12.5px" color="gray.600" mt={3} lineHeight="1.55">
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
              {model.liftPending ? (
                <Text fontSize="12px" color="gray.600" mt={2} lineHeight="1.55">
                  {isLeader
                    ? 'LIFT is required on 3-month and longer journeys. Complete it to unlock full Session Prep for you and your mentor/coach.'
                    : 'Waiting on a completed LIFT Index for this leader. On 3M+ journeys it is compulsory before meaningful prep.'}
                </Text>
              ) : null}
              {model.pillars ? (
                <HStack spacing={2} mt={3} flexWrap="wrap">
                  {(['L', 'I', 'F', 'T'] as const).map((key) => (
                    <Text
                      key={key}
                      fontFamily="mono"
                      fontSize="11px"
                      letterSpacing="0.04em"
                      borderWidth="1px"
                      borderStyle="solid"
                      borderColor={hairline}
                      borderRadius="md"
                      px={2}
                      py={1}
                      color="#350e6f"
                    >
                      {key} is {Math.round(model.pillars![key])}
                    </Text>
                  ))}
                </HStack>
              ) : null}
              {model.totalPointsLabel ? (
                <Text fontSize="12.5px" color="gray.600" fontWeight="600" mt={2}>
                  Journey points · {model.totalPointsLabel}
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
                        bg: '#350e6f',
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

            {model.archetypeLabel ? (
              <Box>
                <MonoLabel>Your LIFT archetype</MonoLabel>
                <Text
                  fontFamily="mono"
                  fontSize="12px"
                  letterSpacing="0.08em"
                  textTransform="uppercase"
                  bg="rgba(53, 14, 111, 0.08)"
                  color="#350e6f"
                  borderRadius="full"
                  px={2.5}
                  py={1}
                  display="inline-block"
                  mb={2}
                >
                  {model.archetypeLabel}
                </Text>
                {model.goalVerbatim && !isLeader ? (
                  <Text fontSize="13.5px" lineHeight="1.65" mt={1} color="#6B6579">
                    Session focus: {model.goalVerbatim}
                  </Text>
                ) : null}
              </Box>
            ) : model.goalVerbatim && !isLeader ? (
              <Box>
                <MonoLabel>Session focus</MonoLabel>
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

        <Box p={{ base: isLeader ? 4 : 5, md: isLeader ? 4 : 6 }} minW={0}>
          <MonoLabel>{isLeader ? 'Your meet-ups' : model.audience === 'coach' ? 'The sessions' : 'Your meet-ups'}</MonoLabel>
          <SessionArc labels={model.arcLabels} currentIndex={model.arcCurrentIndex} note={model.arcNote} />

          {isLeader && leaderGoalEditor ? <Box mt={3}>{leaderGoalEditor}</Box> : null}

          {isLeader && model.goalVerbatim ? (
            <Box mt={7}>
              <MonoLabel>Your session prep answers</MonoLabel>
              <Stack spacing={0}>
                {model.goalVerbatim
                  .split(/\n\n+/)
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((part) => (
                    <Box key={part.slice(0, 48)} borderTop="1px solid" borderColor="rgba(35,31,48,.14)" py={4}>
                      <Text fontSize="14.5px" lineHeight="1.55" fontWeight="500" whiteSpace="pre-wrap">
                        {part}
                      </Text>
                    </Box>
                  ))}
              </Stack>
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
                    <Box borderLeft="3px solid #350e6f" pl={4}>
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
              <MonoLabel>From your programme submissions</MonoLabel>
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
            <Box mt={6} bg="#350e6f" color="white" borderRadius="xl" p={5}>
              <MonoLabel color="rgba(255,255,255,0.7)">{model.opener.label}</MonoLabel>
              <Text
                as="q"
                display="block"
                fontFamily="'DM Serif Display', Georgia, serif"
                fontSize={{ base: '18px', md: '20px' }}
                lineHeight="1.4"
                color="white"
              >
                {model.opener.quote}
              </Text>
              <Text fontSize="12.5px" lineHeight="1.6" color="whiteAlpha.800" mt={3} m={0}>
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

          <HStack mt={6} spacing={2.5} flexWrap="wrap">
            {onPrimary ? (
              <Button
                bg="#350e6f"
                color="white"
                borderRadius="lg"
                px={4}
                h="42px"
                fontSize="13px"
                fontWeight="500"
                _hover={{ bg: '#27062e' }}
                isLoading={primaryLoading}
                onClick={onPrimary}
              >
                {model.primaryActionLabel}
              </Button>
            ) : null}
            {onSecondary ? (
              <Button
                variant="outline"
                borderColor="rgba(53, 14, 111, 0.28)"
                color="#350e6f"
                borderRadius="lg"
                px={4}
                h="42px"
                fontSize="13px"
                fontWeight="500"
                bg="transparent"
                _hover={{ bg: 'rgba(53, 14, 111, 0.06)' }}
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
