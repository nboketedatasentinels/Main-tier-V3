import { Card, CardBody, HStack, VStack, Text, Icon, Box } from '@chakra-ui/react'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  helper?: string
  icon?: LucideIcon
  trendLabel?: string
  trendValue?: string
  highlight?: boolean
}

export const StatCard = ({
  label,
  value,
  helper,
  icon: IconComponent,
  trendLabel,
  trendValue,
  highlight,
}: StatCardProps) => {
  return (
    <Card bg={highlight ? 'brand.royalPurple' : 'brand.deepPlum'} borderColor="rgba(234, 177, 48, 0.35)">
      <CardBody>
        <HStack spacing={4} align="flex-start">
          {IconComponent && (
            <Box
              bg="rgba(249, 219, 89, 0.12)"
              borderRadius="full"
              p={2}
              color="brand.gold"
              boxShadow="sm"
            >
              <Icon as={IconComponent} boxSize={6} />
            </Box>
          )}
          <VStack align="flex-start" spacing={1} flex={1}>
            <Text fontSize="sm" color="brand.textOnDark" opacity={0.85}>
              {label}
            </Text>
            <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color="white">
              {value}
            </Text>
            {helper && (
              <Text fontSize="sm" color="brand.textOnDark" opacity={0.8}>
                {helper}
              </Text>
            )}
            {(trendLabel || trendValue) && (
              <Text fontSize="sm" color="brand.flameOrange" fontWeight="semibold">
                {trendLabel} {trendValue}
              </Text>
            )}
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  )
}
