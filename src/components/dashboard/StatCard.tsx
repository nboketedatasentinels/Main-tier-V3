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
  const cardBg = highlight ? 'brand.primary' : 'white'
  const textColor = highlight ? 'brand.textLight' : 'brand.text'
  const helperColor = highlight ? 'brand.textLight' : 'brand.subtleText'

  return (
    <Card bg={cardBg} borderColor={highlight ? 'brand.primary' : 'brand.border'}>
      <CardBody>
        <HStack spacing={4} align="flex-start">
          {IconComponent && (
            <Box
              bg={highlight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(93, 107, 255, 0.12)'}
              borderRadius="full"
              p={2}
              color="brand.gold"
              boxShadow="sm"
            >
              <Icon as={IconComponent} boxSize={6} />
            </Box>
          )}
          <VStack align="flex-start" spacing={1} flex={1}>
            <Text fontSize="sm" color={helperColor} opacity={0.9}>
              {label}
            </Text>
            <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color={textColor}>
              {value}
            </Text>
            {helper && (
              <Text fontSize="sm" color={helperColor} opacity={0.9}>
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
