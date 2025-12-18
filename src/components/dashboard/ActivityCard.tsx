import { Card, CardBody, Checkbox, Flex, Text, Badge, Icon } from '@chakra-ui/react'
import { CheckCircle2, CircleDashed } from 'lucide-react'

interface ActivityCardProps {
  title: string
  points: number
  completed?: boolean
  onToggle?: () => void
}

export const ActivityCard = ({ title, points, completed, onToggle }: ActivityCardProps) => {
  return (
    <Card
      bg={completed ? 'rgba(234, 177, 48, 0.08)' : 'white'}
      borderColor={completed ? 'brand.gold' : 'brand.border'}
      transition="all 0.2s"
      _hover={{ transform: 'translateY(-2px)', borderColor: 'brand.gold' }}
    >
      <CardBody>
        <Flex align="center" gap={3}>
          <Checkbox
            colorScheme="yellow"
            isChecked={completed}
            onChange={onToggle}
            iconColor="brand.primary"
          />
          <Flex direction="column" flex={1} gap={1}>
            <Text fontWeight="semibold" color="brand.text">
              {title}
            </Text>
            <Badge variant="gold" width="fit-content">
              {points} pts
            </Badge>
          </Flex>
          <Icon
            as={completed ? CheckCircle2 : CircleDashed}
            color={completed ? 'brand.primary' : 'brand.subtleText'}
            boxSize={5}
          />
        </Flex>
      </CardBody>
    </Card>
  )
}
