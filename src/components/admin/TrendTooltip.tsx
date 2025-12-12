import React, { memo } from 'react'
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

// Using React.memo to prevent unnecessary re-renders of the tooltip.
// This is a pure component, and this optimization avoids re-rendering when the parent chart re-renders but the tooltip's data hasn't changed.
export const TrendTooltip: React.FC<TrendTooltipProps> = memo(({ active, payload, label, valueLabel }) => {
  if (!active || !payload?.length) return null

  return (
    <Box bg="white" borderRadius="md" border="1px solid" borderColor="brand.border" p={3} boxShadow="md">
      <Text fontWeight="bold" color="brand.text">
        {label}
      </Text>
      <Text color="brand.subtleText">{valueLabel || 'Value'}: {payload[0].value}</Text>
    </Box>
  )
})
