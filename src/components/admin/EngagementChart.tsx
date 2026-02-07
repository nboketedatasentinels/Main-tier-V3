import React, { memo } from 'react'
import { Box, Flex, HStack, Icon, Stack, Text } from '@chakra-ui/react'
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

// Wrapped EngagementChart with React.memo to prevent unnecessary re-renders.
// As a presentational component, it will only re-render when its props change,
// improving performance by avoiding costly chart redraws.
export const EngagementChart: React.FC<EngagementChartProps> = memo(
  ({ data, title, subtitle, strokeColor = '#5d6bff', valueLabel }) => {
    const hasChartData = data.length > 0 && data.some((point) => point.value !== 0)

    return (
      <Box h="260px" display="flex" flexDirection="column">
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
        <Box flex="1" minH={0}>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f6" />
                <XAxis dataKey="label" stroke="#8b94b8" tickLine={false} />
                <YAxis stroke="#8b94b8" tickLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  content={<TrendTooltip valueLabel={valueLabel} />}
                  cursor={{ stroke: '#e0e3ef', strokeWidth: 2 }}
                />
                <Line type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Flex height="100%" align="center" justify="center" direction="column" gap={1}>
              <Text fontSize="sm" color="text.muted">
                No data yet
              </Text>
              <Text fontSize="xs" color="gray.500">
                This chart will populate as activity is recorded.
              </Text>
            </Flex>
          )}
        </Box>
      </Box>
    )
  },
)
