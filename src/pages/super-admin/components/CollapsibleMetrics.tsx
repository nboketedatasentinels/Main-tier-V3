import React from 'react'
import {
  Box,
  Button,
  Collapse,
  Heading,
  HStack,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'

type CollapsibleMetricsProps = {
  children: React.ReactNode
}

export const CollapsibleMetrics: React.FC<CollapsibleMetricsProps> = ({ children }) => {
  const { isOpen, onToggle } = useDisclosure()

  return (
    <Box>
      <Button
        variant="ghost"
        width="100%"
        justifyContent="space-between"
        onClick={onToggle}
        py={6}
        borderTop="1px solid"
        borderBottom={isOpen ? 'none' : '1px solid'}
        borderColor="border.control"
        borderRadius="none"
        _hover={{ bg: 'gray.50' }}
      >
        <HStack spacing={3}>
          <BarChart3 size={20} color="gray" />
          <Stack spacing={0} align="flex-start">
            <Heading size="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
              System Metrics & Analytics
            </Heading>
            <Text fontSize="xs" color="text.muted" fontWeight="normal">
              Engagement trends, growth curves, and usage insights
            </Text>
          </Stack>
        </HStack>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </Button>

      <Collapse in={isOpen} animateOpacity>
        <Box py={6}>
          {children}
        </Box>
      </Collapse>
    </Box>
  )
}
