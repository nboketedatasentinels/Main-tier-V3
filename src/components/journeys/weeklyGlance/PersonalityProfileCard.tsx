import {
  Badge,
  Card,
  CardBody,
  Collapse,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  UnorderedList,
  ListItem,
  Button,
} from '@chakra-ui/react'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { PersonalityProfile } from '@/hooks/useWeeklyGlanceData'

interface PersonalityProfileCardProps {
  data: PersonalityProfile | null
  loading: boolean
}

export const PersonalityProfileCard = ({ data, loading }: PersonalityProfileCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const strengths = data?.personalityStrengths || []

  return (
    <Card h="100%" variant="outline" borderColor="brand.border">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack>
              <Icon as={Sparkles} color="brand.primary" />
              <Text fontWeight="bold">Personality Profile</Text>
            </HStack>
            {data?.personalityType && <Badge colorScheme="purple">{data.personalityType}</Badge>}
          </HStack>

          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={2} color="brand.subtleText" fontSize="sm">
              <Text>{data?.personalityDescription || 'Share your personality insights to receive tailored guidance.'}</Text>
              {strengths.length > 0 && (
                <>
                  <Text fontWeight="semibold" color="brand.text">
                    Strengths
                  </Text>
                  <UnorderedList pl={5} spacing={1}>
                    {strengths.slice(0, expanded ? strengths.length : 3).map(item => (
                      <ListItem key={item}>{item}</ListItem>
                    ))}
                  </UnorderedList>
                </>
              )}
              <Collapse in={expanded} animateOpacity>
                {data?.personalityDescription && (
                  <Text pt={2}>
                    Understanding your type helps us match you with the right habits, allies, and learning experiences.
                  </Text>
                )}
              </Collapse>
              {strengths.length > 3 && (
                <Button variant="ghost" size="sm" alignSelf="flex-start" onClick={() => setExpanded(prev => !prev)}>
                  {expanded ? 'Show less' : 'Show full assessment'}
                </Button>
              )}
            </Stack>
          </Skeleton>
        </Stack>
      </CardBody>
    </Card>
  )
}
