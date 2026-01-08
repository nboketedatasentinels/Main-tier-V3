import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { JourneyType } from '@/config/pointsConfig'
import type { WeeklyPodcastEpisode, WeeklyPodcastInput } from '@/types'
import { PodcastVideoCard } from '@/components/journeys/PodcastVideoCard'
import { isSupportedVideoUrl } from '@/utils/videoEmbeds'

const JOURNEY_OPTIONS: Array<JourneyType | 'all'> = ['4W', '6W', '3M', '6M', '9M', '12M', 'all']

const emptyEpisode: WeeklyPodcastInput = {
  weekNumber: 1,
  journeyType: '4W',
  title: '',
  description: '',
  videoUrl: '',
  thumbnailUrl: '',
  duration: '',
  isActive: true,
}

export const PodcastContentPage: React.FC = () => {
  const toast = useToast()
  const [episodes, setEpisodes] = useState<WeeklyPodcastEpisode[]>([])
  const [selected, setSelected] = useState<WeeklyPodcastEpisode | null>(null)
  const [form, setForm] = useState<WeeklyPodcastInput>(emptyEpisode)
  const [filterJourney, setFilterJourney] = useState<JourneyType | 'all'>('all')
  const [filterWeek, setFilterWeek] = useState<string>('all')
  const [bulkPayload, setBulkPayload] = useState('')

  React.useEffect(() => {
    const q = query(collection(db, 'weekly_content'), orderBy('weekNumber', 'asc'))
    const unsubscribe = onSnapshot(q, snapshot => {
      const next = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as WeeklyPodcastInput),
      })) as WeeklyPodcastEpisode[]
      setEpisodes(next)
    })

    return () => unsubscribe()
  }, [])

  const filteredEpisodes = useMemo(() => {
    return episodes.filter(episode => {
      const journeyMatches = filterJourney === 'all' || episode.journeyType === filterJourney
      const weekMatches = filterWeek === 'all' || episode.weekNumber === Number(filterWeek)
      return journeyMatches && weekMatches
    })
  }, [episodes, filterJourney, filterWeek])

  const handleFieldChange = <K extends keyof WeeklyPodcastInput>(key: K, value: WeeklyPodcastInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setForm(emptyEpisode)
    setSelected(null)
  }

  const validateVideo = (value?: string) => {
    if (!value) return true
    return isSupportedVideoUrl(value)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Title is required', status: 'warning' })
      return
    }

    if (!validateVideo(form.videoUrl)) {
      toast({ title: 'Video URL is invalid', description: 'Use a YouTube, Vimeo, or Wistia link.', status: 'warning' })
      return
    }

    const payload = {
      ...form,
      weekNumber: Number(form.weekNumber),
      updatedAt: new Date(),
      createdAt: selected?.createdAt ?? new Date(),
    }

    try {
      if (selected) {
        await updateDoc(doc(db, 'weekly_content', selected.id), payload)
        toast({ title: 'Episode updated', status: 'success' })
      } else {
        await addDoc(collection(db, 'weekly_content'), {
          ...payload,
          createdAt: new Date(),
        })
        toast({ title: 'Episode created', status: 'success' })
      }
      resetForm()
    } catch (error) {
      console.error(error)
      toast({ title: 'Unable to save episode', status: 'error' })
    }
  }

  const handleEdit = (episode: WeeklyPodcastEpisode) => {
    setSelected(episode)
    setForm({
      weekNumber: episode.weekNumber,
      journeyType: episode.journeyType,
      title: episode.title,
      description: episode.description ?? '',
      videoUrl: episode.videoUrl ?? '',
      thumbnailUrl: episode.thumbnailUrl ?? '',
      duration: episode.duration ?? '',
      isActive: episode.isActive,
    })
  }

  const handleDelete = async (episode: WeeklyPodcastEpisode) => {
    try {
      await deleteDoc(doc(db, 'weekly_content', episode.id))
      toast({ title: 'Episode deleted', status: 'success' })
      if (selected?.id === episode.id) {
        resetForm()
      }
    } catch (error) {
      console.error(error)
      toast({ title: 'Unable to delete episode', status: 'error' })
    }
  }

  const handleBulkUpload = async () => {
    if (!bulkPayload.trim()) return
    try {
      const parsed = JSON.parse(bulkPayload) as WeeklyPodcastInput[]
      await Promise.all(
        parsed.map(item => {
          if (!item.title || !item.weekNumber || !item.journeyType) return Promise.resolve()
          if (!validateVideo(item.videoUrl)) return Promise.resolve()
          return addDoc(collection(db, 'weekly_content'), {
            ...item,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }),
      )
      toast({ title: 'Bulk upload completed', status: 'success' })
      setBulkPayload('')
    } catch (error) {
      console.error(error)
      toast({ title: 'Bulk upload failed', status: 'error' })
    }
  }

  return (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={5}>
            <Stack spacing={1}>
              <Heading size="md">Podcast content management</Heading>
              <Text color="brand.subtleText">Create and manage weekly podcast episodes for each journey.</Text>
            </Stack>

            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
              <GridItem>
                <Stack spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Title</FormLabel>
                    <Input value={form.title} onChange={e => handleFieldChange('title', e.target.value)} />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Textarea value={form.description} onChange={e => handleFieldChange('description', e.target.value)} />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Week number</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      value={form.weekNumber}
                      onChange={e => handleFieldChange('weekNumber', Number(e.target.value))}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Journey type</FormLabel>
                    <Select value={form.journeyType} onChange={e => handleFieldChange('journeyType', e.target.value as JourneyType | 'all')}>
                      {JOURNEY_OPTIONS.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Video URL</FormLabel>
                    <Input value={form.videoUrl} onChange={e => handleFieldChange('videoUrl', e.target.value)} />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Thumbnail URL</FormLabel>
                    <Input value={form.thumbnailUrl} onChange={e => handleFieldChange('thumbnailUrl', e.target.value)} />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Duration</FormLabel>
                    <Input value={form.duration} onChange={e => handleFieldChange('duration', e.target.value)} />
                  </FormControl>

                  <FormControl display="flex" alignItems="center" gap={3}>
                    <Switch isChecked={form.isActive} onChange={e => handleFieldChange('isActive', e.target.checked)} />
                    <FormLabel mb={0}>Active episode</FormLabel>
                  </FormControl>

                  <HStack spacing={3}>
                    <Button colorScheme="purple" onClick={handleSave}>
                      {selected ? 'Update episode' : 'Create episode'}
                    </Button>
                    <Button variant="outline" onClick={resetForm}>
                      Clear
                    </Button>
                  </HStack>
                </Stack>
              </GridItem>

              <GridItem>
                <Stack spacing={4}>
                  <Box borderRadius="lg" border="1px solid" borderColor="brand.border" p={4} bg="gray.50">
                    <Text fontWeight="bold" mb={2}>
                      Preview
                    </Text>
                    <PodcastVideoCard
                      episode={
                        form.title
                          ? ({
                              id: selected?.id ?? 'preview',
                              ...form,
                            } as WeeklyPodcastEpisode)
                          : null
                      }
                      loading={false}
                      error={null}
                    />
                  </Box>

                  <Box borderRadius="lg" border="1px solid" borderColor="brand.border" p={4} bg="white">
                    <Stack spacing={3}>
                      <Heading size="sm">Bulk upload</Heading>
                      <Text color="brand.subtleText" fontSize="sm">
                        Paste a JSON array of weekly content entries to upload multiple episodes at once.
                      </Text>
                      <Textarea
                        value={bulkPayload}
                        onChange={e => setBulkPayload(e.target.value)}
                        placeholder='[{"weekNumber":1,"journeyType":"4W","title":"Episode 1","videoUrl":"https://...","isActive":true}]'
                        minH="160px"
                      />
                      <Button variant="outline" onClick={handleBulkUpload}>
                        Upload entries
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </GridItem>
            </Grid>
          </Stack>
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <Stack spacing={1}>
                <Heading size="sm">Published episodes</Heading>
                <Text color="brand.subtleText" fontSize="sm">
                  Review and manage weekly podcast content.
                </Text>
              </Stack>
              <HStack spacing={3}>
                <Select value={filterJourney} onChange={e => setFilterJourney(e.target.value as JourneyType | 'all')}>
                  {JOURNEY_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
                <Select value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
                  <option value="all">All weeks</option>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Week {idx + 1}
                    </option>
                  ))}
                </Select>
              </HStack>
            </HStack>

            <Divider />

            <Stack spacing={3}>
              {filteredEpisodes.length === 0 ? (
                <Text color="brand.subtleText">No episodes match the current filters.</Text>
              ) : (
                filteredEpisodes.map(episode => (
                  <Box key={episode.id} border="1px solid" borderColor="brand.border" borderRadius="lg" p={4}>
                    <Stack spacing={3}>
                      <HStack justify="space-between" align="center">
                        <Stack spacing={1}>
                          <Heading size="sm">{episode.title}</Heading>
                          <Text color="brand.subtleText" fontSize="sm">
                            Week {episode.weekNumber} • {episode.journeyType}
                          </Text>
                        </Stack>
                        <Badge colorScheme={episode.isActive ? 'green' : 'gray'}>
                          {episode.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </HStack>
                      {episode.description && <Text color="brand.subtleText">{episode.description}</Text>}
                      <HStack spacing={3}>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(episode)}>
                          Edit
                        </Button>
                        <Button size="sm" colorScheme="red" variant="ghost" onClick={() => handleDelete(episode)}>
                          Delete
                        </Button>
                      </HStack>
                    </Stack>
                  </Box>
                ))
              )}
            </Stack>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}
