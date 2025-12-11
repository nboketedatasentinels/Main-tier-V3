import React from 'react'
import { Card, CardBody, HStack, Text, Box, Stack, Icon } from '@chakra-ui/react'

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  helper?: string
  accent?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, helper, accent }) => (
  <Card bg="white" border="1px solid" borderColor="brand.border">
    <CardBody>
      <Stack spacing={3}>
        <HStack justify="space-between">
          <Text fontSize="sm" color="brand.subtleText" fontWeight="medium">
            {label}
          </Text>
          <Box
            p={2}
            bg={accent || 'brand.primaryMuted'}
            borderRadius="md"
            color="brand.primary"
            display="grid"
            placeItems="center"
          >
            <Icon as={icon} size={18} />
          </Box>
        </HStack>
        <Text fontSize="2xl" fontWeight="bold" color="brand.text">
          {value}
        </Text>
        {helper && (
          <Text fontSize="sm" color="brand.subtleText">
            {helper}
          </Text>
        )}
      </Stack>
    </CardBody>
  </Card>
)
