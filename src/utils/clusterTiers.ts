export type ClusterTier = {
  name: string
  rangeLabel: string
  min: number
  max?: number
  colorScheme: string
  description: string
}

export const clusterTiers: ClusterTier[] = [
  {
    name: 'No Cluster',
    rangeLabel: '1-3',
    min: 1,
    max: 3,
    colorScheme: 'gray',
    description: 'Small cohorts with 1-3 learners.',
  },
  {
    name: 'Kalahari Cluster',
    rangeLabel: '4-10',
    min: 4,
    max: 10,
    colorScheme: 'blue',
    description: 'Early growth cohorts with 4-10 learners.',
  },
  {
    name: 'Sahara Cluster',
    rangeLabel: '11-20',
    min: 11,
    max: 20,
    colorScheme: 'green',
    description: 'Mid-sized cohorts with 11-20 learners.',
  },
  {
    name: 'Sahel Cluster',
    rangeLabel: '21-40',
    min: 21,
    max: 40,
    colorScheme: 'orange',
    description: 'Large cohorts with 21-40 learners.',
  },
  {
    name: 'Serengeti Cluster',
    rangeLabel: '41+',
    min: 41,
    colorScheme: 'red',
    description: 'Enterprise-scale cohorts with 41+ learners.',
  },
]

export const clusterBoundaries = [4, 11, 21, 41]

export const getClusterDisplayName = (clusterName?: string) => clusterName || 'No Cluster'

export const getClusterTierByName = (clusterName?: string) => {
  const resolvedName = getClusterDisplayName(clusterName)
  return clusterTiers.find((tier) => tier.name === resolvedName) ?? clusterTiers[0]
}
