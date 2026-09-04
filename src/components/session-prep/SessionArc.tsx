import React from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'

interface SessionArcProps {
  labels: string[]
  currentIndex: number
  note?: string
}

export const SessionArc: React.FC<SessionArcProps> = ({ labels, currentIndex, note }) => (
  <Box>
    <Flex mt={3}>
      {labels.map((label, index) => {
        const done = index < currentIndex
        const now = index === currentIndex
        return (
          <Box key={`${label}-${index}`} flex="1" textAlign="center" position="relative" minW={0}>
            {index > 0 && (
              <Box
                position="absolute"
                top="6px"
                left="-50%"
                w="100%"
                h="1px"
                bg="rgba(35,31,48,.28)"
              />
            )}
            <Box
              w="13px"
              h="13px"
              borderRadius="full"
              mx="auto"
              mb="7px"
              border="1.5px solid"
              borderColor={now || done ? '#350e6f' : 'rgba(53, 14, 111, 0.22)'}
              bg={now ? '#350e6f' : done ? '#350e6f' : 'white'}
              boxShadow={now ? '0 0 0 4px rgba(53, 14, 111, 0.12)' : undefined}
              position="relative"
              zIndex={1}
            />
            <Text
              fontFamily="mono"
              fontSize="9px"
              letterSpacing="0.05em"
              textTransform="uppercase"
              color={now ? '#350e6f' : 'gray.500'}
              noOfLines={1}
            >
              {label}
            </Text>
          </Box>
        )
      })}
    </Flex>
    {note ? (
      <Text fontSize="12px" color="#6B6579" mt={3.5} lineHeight="1.55">
        {note}
      </Text>
    ) : null}
  </Box>
)
