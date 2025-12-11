import React from 'react'
import { Box, Text } from '@chakra-ui/react'

interface TooltipPayload {
  value: number
}

interface TrendTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  valueLabel?: string
}

export const TrendTooltip: React.FC<TrendTooltipProps> = ({ active, payload, label, valueLabel }) => {
  if (!active || !payload?.length) return null

  return (
    <Box bg="white" borderRadius="md" border="1px solid" borderColor="brand.border" p={3} boxShadow="md">
      <Text fontWeight="bold" color="brand.text">
        {label}
      </Text>
      <Text color="brand.subtleText">{valueLabel || 'Value'}: {payload[0].value}</Text>
    </Box>
  )
}
