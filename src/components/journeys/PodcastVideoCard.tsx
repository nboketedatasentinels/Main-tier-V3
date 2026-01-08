import React, { useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AspectRatio,
  Badge,
  Box,
  Button,
  Heading,
  Skeleton,
  Stack,
  Tag,
  Text,
} from '@chakra-ui/react'
import { ExternalLink, PlayCircle } from 'lucide-react'
import type { WeeklyPodcastEpisode } from '@/types'
import { getVideoEmbedUrl } from '@/utils/videoEmbeds'
import { SurfaceCard } from '@/components/primitives/SurfacePrimitives'

type PodcastVideoCardProps = {
  episode: WeeklyPodcastEpisode | null
  loading?: boolean
  error?: Error | null
  isCompleted?: boolean
  onMarkWatched?: () => void
  onViewAll?: () => void
}

class PodcastErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback: React.ReactNode }>,
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

export const PodcastVideoCard: React.FC<PodcastVideoCardProps> = ({
  episode,
  loading,
  error,
  isCompleted,
  onMarkWatched,
  onViewAll,
}) => {
  const [embedFailed, setEmbedFailed] = useState(false)
  const embed = useMemo(() => getVideoEmbedUrl(episode?.videoUrl), [episode?.videoUrl])
  const showFallback = !embed || embedFailed

  return (
    <SurfaceCard borderColor="border.card">
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'flex-start', md: 'center' }}>
            <Heading size="sm" color="text.primary">
              Weekly Podcast
            </Heading>
            <Badge colorScheme="purple" variant="subtle">
              Week {episode?.weekNumber ?? '—'}
            </Badge>
          </Stack>
          <Text color="text.secondary" fontSize="sm">
            Dive into this week&apos;s conversation and earn your learning points.
          </Text>
        </Stack>

        {loading ? (
          <Stack spacing={3}>
            <Skeleton height="220px" borderRadius="lg" />
            <Skeleton height="18px" />
            <Skeleton height="14px" />
          </Stack>
        ) : error ? (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <AlertDescription>Unable to load the podcast right now.</AlertDescription>
          </Alert>
        ) : !episode ? (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <AlertDescription>No podcast has been published for this week yet.</AlertDescription>
          </Alert>
        ) : (
          <Stack spacing={3}>
            <PodcastErrorBoundary
              fallback={
                <Box p={6} borderRadius="lg" bg="gray.50" border="1px solid" borderColor="border.subtle">
                  <Text color="text.secondary">We couldn&apos;t load this video. Please check back later.</Text>
                </Box>
              }
            >
              {showFallback ? (
                <Box p={6} borderRadius="lg" bg="gray.50" border="1px solid" borderColor="border.subtle">
                  <Text color="text.secondary">Video embed is unavailable. Try another episode or open it directly.</Text>
                </Box>
              ) : (
                <AspectRatio ratio={16 / 9} borderRadius="lg" overflow="hidden" bg="black">
                  <iframe
                    src={embed.embedUrl}
                    title={episode.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    frameBorder="0"
                    onError={() => setEmbedFailed(true)}
                  />
                </AspectRatio>
              )}
            </PodcastErrorBoundary>

            <Stack spacing={2}>
              <Heading size="md" color="text.primary">
                {episode.title}
              </Heading>
              {episode.description && (
                <Text color="text.secondary" fontSize="sm">
                  {episode.description}
                </Text>
              )}
              <Stack direction="row" spacing={2} align="center">
                <Tag colorScheme="purple" variant="subtle">
                  {episode.journeyType} journey
                </Tag>
                {episode.duration && (
                  <Tag variant="subtle" colorScheme="gray">
                    {episode.duration}
                  </Tag>
                )}
              </Stack>
            </Stack>

            <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} align={{ base: 'stretch', sm: 'center' }}>
              <Button
                colorScheme="purple"
                leftIcon={<PlayCircle size={18} />}
                onClick={onMarkWatched}
                isDisabled={!onMarkWatched || Boolean(isCompleted)}
              >
                {isCompleted ? 'Podcast watched' : 'Mark as watched'}
              </Button>
              <Button
                variant="outline"
                leftIcon={<ExternalLink size={18} />}
                onClick={onViewAll}
                isDisabled={!onViewAll}
              >
                View all episodes
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    </SurfaceCard>
  )
}
