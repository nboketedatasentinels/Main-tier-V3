import { Card, CardBody, Flex, Text, VStack, Badge, Icon, Avatar } from '@chakra-ui/react'
import { ShieldCheck } from 'lucide-react'

interface BadgeCardProps {
  name: string
  description: string
  earnedOn?: string
  imageUrl?: string
  isNew?: boolean
}

export const BadgeCard = ({ name, description, earnedOn, imageUrl, isNew }: BadgeCardProps) => {
  return (
    <Card borderColor={isNew ? 'brand.gold' : 'rgba(234, 177, 48, 0.2)'}>
      <CardBody>
        <Flex align="center" gap={4}>
          <Avatar
            name={name}
            src={imageUrl}
            bg="brand.royalPurple"
            color="brand.gold"
            icon={<Icon as={ShieldCheck} />}
          />
          <VStack align="flex-start" spacing={1} flex={1}>
            <Text fontWeight="bold" color="brand.softGold">
              {name}
            </Text>
            <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
              {description}
            </Text>
            {earnedOn && (
              <Text fontSize="xs" color="brand.gold">
                Earned {earnedOn}
              </Text>
            )}
          </VStack>
          {isNew && <Badge variant="gold">New</Badge>}
        </Flex>
      </CardBody>
    </Card>
  )
}
