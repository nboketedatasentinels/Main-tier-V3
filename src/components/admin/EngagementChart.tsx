import React from 'react'
import { Box, HStack, Icon, Stack, Text } from '@chakra-ui/react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { TrendTooltip } from './TrendTooltip'

interface EngagementChartProps {
  data: { label: string; value: number }[]
  title: string
  subtitle?: string
  strokeColor?: string
  valueLabel?: string
}

export const EngagementChart: React.FC<EngagementChartProps> = ({
  data,
  title,
  subtitle,
  strokeColor = '#5d6bff',
  valueLabel,
}) => {
  return (
    <Box h="260px">
      <HStack justify="space-between" align="flex-start" mb={4}>
        <Stack spacing={1}>
          <Text fontWeight="bold" color="brand.text">
            {title}
          </Text>
          {subtitle && (
            <Text fontSize="sm" color="brand.subtleText">
              {subtitle}
            </Text>
          )}
        </Stack>
        <Icon as={LineChartIcon} color="brand.primary" />
      </HStack>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f6" />
          <XAxis dataKey="label" stroke="#8b94b8" tickLine={false} />
          <YAxis stroke="#8b94b8" tickLine={false} allowDecimals={false} />
          <Tooltip content={<TrendTooltip valueLabel={valueLabel} />} cursor={{ stroke: '#e0e3ef', strokeWidth: 2 }} />
          <Line type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}
