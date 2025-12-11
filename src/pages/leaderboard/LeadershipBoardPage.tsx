import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  Stack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  HStack,
  ButtonGroup,
  Button,
  Select,
  Badge,
  useToast,
} from '@chakra-ui/react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LeaderboardView, UserRole } from '@/types'

type LeaderboardRecord = {
  id: string
  name: string
  points: number
  companyId: string
  villageId: string
  clusterId: string
}

const companies = [
  { id: 'company-1', name: 'Tier Tech' },
  { id: 'company-2', name: 'Growth Labs' },
]

const villages = [
  { id: 'village-1', name: 'North Village', companyId: 'company-1' },
  { id: 'village-2', name: 'South Village', companyId: 'company-2' },
]

const clusters = [
  { id: 'cluster-1', name: 'Innovation Cluster', companyId: 'company-1', villageId: 'village-1' },
  { id: 'cluster-2', name: 'Builders Cluster', companyId: 'company-2', villageId: 'village-2' },
]

const sampleLeaders: LeaderboardRecord[] = [
  { id: 'me', name: 'You', points: 1200, companyId: 'company-1', villageId: 'village-1', clusterId: 'cluster-1' },
  { id: 'kevin', name: 'Kevin', points: 1150, companyId: 'company-1', villageId: 'village-1', clusterId: 'cluster-1' },
  { id: 'joker', name: 'Joker', points: 980, companyId: 'company-2', villageId: 'village-2', clusterId: 'cluster-2' },
  { id: 'dara', name: 'Dara', points: 940, companyId: 'company-2', villageId: 'village-2', clusterId: 'cluster-2' },
  { id: 'kai', name: 'Kai', points: 915, companyId: 'company-1', villageId: 'village-1', clusterId: 'cluster-1' },
]

export const LeadershipBoardPage: React.FC = () => {
  const { profile } = useAuth()
  const toast = useToast()
  const isAdmin = useMemo(
    () => profile?.role === UserRole.COMPANY_ADMIN || profile?.role === UserRole.SUPER_ADMIN,
    [profile?.role],
  )
  const isFreeUser = profile?.role === UserRole.FREE_USER
  const isMentor = profile?.role === UserRole.MENTOR

  const [view, setView] = useState<LeaderboardView>(isAdmin ? LeaderboardView.GLOBAL : LeaderboardView.COMPANY)
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [selectedVillage, setSelectedVillage] = useState<string>('')
  const [selectedCluster, setSelectedCluster] = useState<string>('')

  useEffect(() => {
    if (!profile) return

    setSelectedCompany(profile.companyId || companies[0].id)
    setSelectedVillage(profile.villageId || villages[0].id)
    setSelectedCluster(profile.clusterId || clusters[0].id)
  }, [profile])

  useEffect(() => {
    setView(isAdmin ? LeaderboardView.GLOBAL : LeaderboardView.COMPANY)
  }, [isAdmin])

  const availableViews = isAdmin
    ? [LeaderboardView.GLOBAL, LeaderboardView.COMPANY, LeaderboardView.VILLAGE, LeaderboardView.CLUSTER]
    : [LeaderboardView.COMPANY, LeaderboardView.VILLAGE, LeaderboardView.CLUSTER]

  const handleViewChange = (newView: LeaderboardView) => {
    if (newView === LeaderboardView.CLUSTER && isFreeUser) {
      toast({
        title: 'Upgrade required',
        description: 'Cluster rankings are reserved for paid members.',
        status: 'info',
        duration: 3500,
        isClosable: true,
      })
      setView(LeaderboardView.COMPANY)
      return
    }

    setView(newView)
  }

  const filteredLeaders = useMemo(() => {
    const scopedCompany = isAdmin ? selectedCompany : profile?.companyId
    const scopedVillage = isAdmin ? selectedVillage : profile?.villageId
    const scopedCluster = isAdmin ? selectedCluster : profile?.clusterId

    switch (view) {
      case LeaderboardView.COMPANY:
        return sampleLeaders.filter(entry => !scopedCompany || entry.companyId === scopedCompany)
      case LeaderboardView.VILLAGE:
        return sampleLeaders.filter(entry => !scopedVillage || entry.villageId === scopedVillage)
      case LeaderboardView.CLUSTER:
        return sampleLeaders.filter(entry => !scopedCluster || entry.clusterId === scopedCluster)
      default:
        return sampleLeaders
    }
  }, [isAdmin, profile?.clusterId, profile?.companyId, profile?.villageId, selectedCluster, selectedCompany, selectedVillage, view])

  const sortedLeaders = [...filteredLeaders]
    .sort((a, b) => b.points - a.points)
    .map((leader, index) => ({ ...leader, rank: index + 1 }))

  if (isMentor) {
    return <Navigate to="/mentor/dashboard" replace />
  }

  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} spacing={4} flexWrap="wrap">
          <Box>
            <Heading size="md" color="brand.text">
              Leadership Board
            </Heading>
            <Text color="brand.subtleText">
              Compare your progress with peers across multiple leaderboards.
            </Text>
          </Box>

          <ButtonGroup size="sm" variant="outline" colorScheme="purple" isAttached>
            {availableViews.map(option => (
              <Button
                key={option}
                onClick={() => handleViewChange(option)}
                variant={view === option ? 'solid' : 'outline'}
                isDisabled={option === LeaderboardView.CLUSTER && isFreeUser}
              >
                {option === LeaderboardView.GLOBAL && 'Global'}
                {option === LeaderboardView.COMPANY && 'Company'}
                {option === LeaderboardView.VILLAGE && 'Village'}
                {option === LeaderboardView.CLUSTER && 'Cluster'}
              </Button>
            ))}
          </ButtonGroup>
        </HStack>

        {!isAdmin && (
          <Badge mt={3} colorScheme="purple" variant="subtle">
            Viewing data for your organization. Filters are locked for security.
          </Badge>
        )}
      </Box>

      <Box bg="white" p={4} borderRadius="lg" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} mb={4}>
          <Select
            value={selectedCompany}
            onChange={event => setSelectedCompany(event.target.value)}
            isDisabled={!isAdmin || view === LeaderboardView.GLOBAL}
          >
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>

          <Select
            value={selectedVillage}
            onChange={event => setSelectedVillage(event.target.value)}
            isDisabled={!isAdmin || view === LeaderboardView.GLOBAL}
          >
            {villages
              .filter(village => !selectedCompany || village.companyId === selectedCompany)
              .map(village => (
                <option key={village.id} value={village.id}>
                  {village.name}
                </option>
              ))}
          </Select>

          <Select
            value={selectedCluster}
            onChange={event => setSelectedCluster(event.target.value)}
            isDisabled={!isAdmin || view === LeaderboardView.GLOBAL || view === LeaderboardView.COMPANY}
          >
            {clusters
              .filter(cluster =>
                (!selectedCompany || cluster.companyId === selectedCompany) &&
                (!selectedVillage || cluster.villageId === selectedVillage),
              )
              .map(cluster => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </option>
              ))}
          </Select>
        </Stack>

        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Rank</Th>
              <Th>Name</Th>
              <Th>Scope</Th>
              <Th isNumeric>Points</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sortedLeaders.map(leader => (
              <Tr key={leader.id} bg={leader.name === 'You' ? 'brand.primaryMuted' : 'transparent'}>
                <Td>
                  {leader.rank <= 3 ? <Tag colorScheme="purple">{leader.rank}</Tag> : leader.rank}
                </Td>
                <Td>{leader.name}</Td>
                <Td>
                  <Badge colorScheme="gray">
                    {view === LeaderboardView.GLOBAL && 'Global'}
                    {view === LeaderboardView.COMPANY &&
                      companies.find(company => company.id === leader.companyId)?.name}
                    {view === LeaderboardView.VILLAGE &&
                      villages.find(village => village.id === leader.villageId)?.name}
                    {view === LeaderboardView.CLUSTER &&
                      clusters.find(cluster => cluster.id === leader.clusterId)?.name}
                  </Badge>
                </Td>
                <Td isNumeric>{leader.points}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Stack>
  )
}
