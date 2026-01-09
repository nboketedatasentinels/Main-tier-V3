import { useEffect, useMemo, useRef } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Stack,
  Tag,
  TagLabel,
  Text,
  useToast,
} from '@chakra-ui/react'
import { ArrowLeft, ChevronDown, ChevronUp, Search, User } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationDetails } from '@/hooks/useOrganizationDetails'
import { logAdminAction } from '@/services/superAdminService'

const formatDate = (value?: string) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const formatDateTime = (value?: Date | null) => {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const OrganizationDetailPage: React.FC = () => {
  const { organizationId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile, user } = useAuth()
  const unauthorizedLogged = useRef(false)

  const {
    organization,
    statistics,
    courseTitles,
    loading,
    error,
    reload,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    roleFilter,
    setRoleFilter,
    membershipFilter,
    setMembershipFilter,
    accountStatusFilter,
    setAccountStatusFilter,
    sortKey,
    sortDirection,
    handleSort,
    page,
    setPage,
    pageCount,
    pageSize,
    paginatedUsers,
    totalCount,
    filteredCount,
    activeFilters,
    clearFilters,
  } = useOrganizationDetails(organizationId)

  useEffect(() => {
    if (error !== 'unauthorized' || unauthorizedLogged.current) return
    unauthorizedLogged.current = true
    toast({
      title: 'Access restricted',
      description: 'You do not have permission to view this organization.',
      status: 'error',
    })
    logAdminAction({
      action: 'Unauthorized organization access attempt',
      organizationName: organization?.name,
      organizationCode: organization?.code || organizationId,
      adminId: user?.uid,
      adminName: profile?.fullName || profile?.email,
      metadata: { organizationId },
    })
    navigate('/unauthorized', { replace: true })
  }, [error, navigate, organization, organizationId, profile, toast, user])

  const handleBack = () => {
    navigate('/admin/dashboard')
  }

  const handleViewUser = (userId: string) => {
    navigate(`/admin/user/${userId}`)
  }

  const matchRegex = useMemo(() => {
    if (!debouncedSearch) return null
    return new RegExp(`(${escapeRegExp(debouncedSearch)})`, 'ig')
  }, [debouncedSearch])

  const highlightMatch = (value: string) => {
    if (!matchRegex) return value
    return value.split(matchRegex).map((part, index) => {
      if (part.toLowerCase() === debouncedSearch.toLowerCase()) {
        return (
          <Box as="mark" key={`${part}-${index}`} bg="yellow.100" color="inherit" px={1} borderRadius="sm">
            {part}
          </Box>
        )
      }
      return <Box as="span" key={`${part}-${index}`}>{part}</Box>
    })
  }

  const startIndex = Math.min((page - 1) * pageSize + 1, filteredCount || 0)
  const endIndex = Math.min(page * pageSize, filteredCount)

  if (error && error !== 'unauthorized') {
    const title =
      error === 'not_found'
        ? 'Organization not found'
        : error === 'invalid'
          ? 'Invalid organization ID'
          : 'Unable to load organization'
    const description =
      error === 'not_found'
        ? 'We could not locate this organization. Please check the link or try again.'
        : error === 'invalid'
          ? 'The organization ID provided is not valid.'
          : 'There was a problem loading the organization details. Please try again.'

    return (
      <Box bg="brand.canvas" minH="100vh" px={{ base: 4, md: 8 }} py={8}>
        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Alert status="error" borderRadius="md" bg="red.50">
              <AlertIcon />
              <Box flex="1">
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription>{description}</AlertDescription>
              </Box>
              <Button variant="outline" onClick={reload}>
                Retry
              </Button>
            </Alert>
          </CardBody>
        </Card>
      </Box>
    )
  }

  return (
    <Box bg="brand.canvas" minH="100vh" px={{ base: 4, md: 8 }} py={8}>
      <Stack spacing={6}>
        <Breadcrumb fontSize="sm" color="brand.subtleText">
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/admin/dashboard')}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/admin/dashboard')}>Organizations</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>{organization?.name || 'Organization'}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={4}>
              <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} wrap="wrap" spacing={4}>
                <HStack spacing={3}>
                  <IconButton
                    aria-label="Back to organizations"
                    icon={<ArrowLeft size={18} />}
                    variant="outline"
                    onClick={handleBack}
                  />
                  <Stack spacing={1}>
                    <Text fontSize="sm" color="brand.subtleText">
                      Organization detail
                    </Text>
                    <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color="brand.text">
                      {organization?.name || 'Loading organization'}
                    </Text>
                    <HStack spacing={2}>
                      <Badge colorScheme="purple" variant="subtle">
                        Code: {organization?.code || 'N/A'}
                      </Badge>
                      {organization?.status && <StatusBadge status={organization.status} />}
                    </HStack>
                  </Stack>
                </HStack>
                <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={handleBack}>
                  Back to organizations
                </Button>
              </HStack>
              {organization?.description ? (
                <Text color="brand.subtleText">{organization.description}</Text>
              ) : (
                <Text color="brand.subtleText">View-only details for this organization.</Text>
              )}
            </Stack>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <Text fontWeight="bold" color="brand.text">
                  Organization overview
                </Text>
                {loading ? (
                  <SkeletonText noOfLines={6} spacing={3} />
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Name</Text>
                      <Text fontWeight="semibold" color="brand.text">{organization?.name}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Code</Text>
                      <Text fontWeight="semibold" color="brand.text">{organization?.code}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Status</Text>
                      <Text fontWeight="semibold" color="brand.text">{organization?.status}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Team size</Text>
                      <Text fontWeight="semibold" color="brand.text">{organization?.teamSize ?? 0}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Village</Text>
                      <Text fontWeight="semibold" color="brand.text">{organization?.village || 'Not assigned'}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Cluster</Text>
                      <Text fontWeight="semibold" color="brand.text">{organization?.cluster || 'Not assigned'}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Program start</Text>
                      <Text fontWeight="semibold" color="brand.text">{formatDate(organization?.programStart)}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Program end</Text>
                      <Text fontWeight="semibold" color="brand.text">{formatDate(organization?.programEnd)}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Cohort start</Text>
                      <Text fontWeight="semibold" color="brand.text">{formatDate(organization?.cohortStartDate)}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Program duration</Text>
                      <Text fontWeight="semibold" color="brand.text">
                        {organization?.programDuration ? `${organization.programDuration} months` : 'Not set'}
                      </Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Description</Text>
                      <Text fontWeight="semibold" color="brand.text">
                        {organization?.description || 'No description provided'}
                      </Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Created</Text>
                      <Text fontWeight="semibold" color="brand.text">{formatDate(organization?.createdAt)}</Text>
                    </Stack>
                    <Stack spacing={1}>
                      <Text fontSize="xs" color="brand.subtleText">Updated</Text>
                      <Text fontWeight="semibold" color="brand.text">{formatDate(organization?.updatedAt)}</Text>
                    </Stack>
                  </SimpleGrid>
                )}
              </Stack>
            </CardBody>
          </Card>

          <Stack spacing={6}>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">
                    Leadership & support
                  </Text>
                  {loading ? (
                    <SkeletonText noOfLines={5} spacing={3} />
                  ) : (
                    <Stack spacing={3}>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="brand.subtleText">Transformation partner</Text>
                        <Text fontWeight="semibold" color="brand.text">
                          {organization?.transformationPartner || 'Not assigned'}
                        </Text>
                      </HStack>
                      <Divider />
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="brand.subtleText">Mentor</Text>
                        <Stack spacing={0} align="flex-end">
                          <Text fontWeight="semibold" color="brand.text">
                            {organization?.assignedMentorName || 'Not assigned'}
                          </Text>
                          {organization?.assignedMentorEmail && (
                            <Text fontSize="xs" color="brand.subtleText">{organization.assignedMentorEmail}</Text>
                          )}
                        </Stack>
                      </HStack>
                      <Divider />
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="brand.subtleText">Ambassador</Text>
                        <Stack spacing={0} align="flex-end">
                          <Text fontWeight="semibold" color="brand.text">
                            {organization?.assignedAmbassadorName || 'Not assigned'}
                          </Text>
                          {organization?.assignedAmbassadorEmail && (
                            <Text fontSize="xs" color="brand.subtleText">{organization.assignedAmbassadorEmail}</Text>
                          )}
                        </Stack>
                      </HStack>
                      <Divider />
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="brand.subtleText">Partner</Text>
                        <Stack spacing={0} align="flex-end">
                          <Text fontWeight="semibold" color="brand.text">
                            {organization?.assignedPartnerName || 'Not assigned'}
                          </Text>
                          {organization?.assignedPartnerEmail && (
                            <Text fontSize="xs" color="brand.subtleText">{organization.assignedPartnerEmail}</Text>
                          )}
                        </Stack>
                      </HStack>
                    </Stack>
                  )}
                </Stack>
              </CardBody>
            </Card>

            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="bold" color="brand.text">
                      Course assignments
                    </Text>
                    <Badge colorScheme="purple">{courseTitles.length} courses</Badge>
                  </HStack>
                  {loading ? (
                    <SkeletonText noOfLines={4} spacing={3} />
                  ) : courseTitles.length ? (
                    <Stack spacing={2}>
                      {courseTitles.map((course) => (
                        <Box
                          key={course}
                          p={3}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="brand.border"
                          bg="brand.accent"
                        >
                          <Text fontWeight="semibold" color="brand.text">{course}</Text>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Box p={3} borderRadius="md" border="1px dashed" borderColor="brand.border">
                      <Text color="brand.subtleText">No courses assigned yet.</Text>
                    </Box>
                  )}
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </SimpleGrid>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={4}>
              <Text fontWeight="bold" color="brand.text">
                Organization statistics
              </Text>
              {loading ? (
                <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} spacing={4}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} height="80px" borderRadius="md" />
                  ))}
                </SimpleGrid>
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} spacing={4}>
                  {[
                    { label: 'Total members', value: statistics?.totalMembers ?? 0 },
                    { label: 'Active (30d)', value: statistics?.activeMembers ?? 0 },
                    { label: 'Paid members', value: statistics?.paidMembers ?? 0 },
                    { label: 'New this week', value: statistics?.newMembersThisWeek ?? 0 },
                    { label: 'Avg engagement', value: `${statistics?.averageEngagementRate ?? 0}%` },
                  ].map((stat) => (
                    <Box
                      key={stat.label}
                      p={4}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <Text fontSize="sm" color="brand.subtleText">{stat.label}</Text>
                      <Text fontSize="2xl" fontWeight="bold" color="brand.text">{stat.value}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </CardBody>
        </Card>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={4}>
              <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} wrap="wrap" spacing={3}>
                <Stack spacing={1}>
                  <Text fontWeight="bold" color="brand.text">
                    Users ({filteredCount} of {totalCount})
                  </Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Showing {startIndex}-{endIndex} of {filteredCount} users
                  </Text>
                </Stack>
                <Button variant="outline" onClick={clearFilters} isDisabled={!activeFilters.length}>
                  Clear filters
                </Button>
              </HStack>

              <Grid templateColumns={{ base: '1fr', md: '2fr 1fr 1fr 1fr' }} gap={3}>
                <GridItem colSpan={{ base: 1, md: 1 }}>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <Search size={16} />
                    </InputLeftElement>
                    <Input
                      placeholder="Search by name or email"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      bg="white"
                    />
                  </InputGroup>
                </GridItem>
                <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
                  <option value="all">All roles</option>
                  <option value="user">User</option>
                  <option value="mentor">Mentor</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="ambassador">Ambassador</option>
                  <option value="partner">Partner</option>
                  <option value="admin">Admin</option>
                </Select>
                <Select
                  value={membershipFilter}
                  onChange={(event) => setMembershipFilter(event.target.value as typeof membershipFilter)}
                >
                  <option value="all">All memberships</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <Select
                  value={accountStatusFilter}
                  onChange={(event) => setAccountStatusFilter(event.target.value as typeof accountStatusFilter)}
                >
                  <option value="all">All accounts</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </Grid>

              {activeFilters.length ? (
                <HStack spacing={2} wrap="wrap">
                  {activeFilters.map((filter) => (
                    <Tag key={`${filter.label}-${filter.value}`} colorScheme="purple" borderRadius="full">
                      <TagLabel>{filter.label}: {filter.value}</TagLabel>
                    </Tag>
                  ))}
                </HStack>
              ) : null}

              <Divider />

              {loading ? (
                <Stack spacing={3}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} height="52px" borderRadius="md" />
                  ))}
                </Stack>
              ) : paginatedUsers.length ? (
                <Box overflowX="auto">
                  <Box minW="900px">
                    <Grid templateColumns="2fr 2fr 1fr 1fr 1fr 1fr 0.8fr" gap={2} pb={2}>
                      <Button
                        variant="ghost"
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => handleSort('name')}
                        rightIcon={sortKey === 'name' ? sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} /> : undefined}
                      >
                        User
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => handleSort('email')}
                        rightIcon={sortKey === 'email' ? sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} /> : undefined}
                      >
                        Email
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => handleSort('role')}
                        rightIcon={sortKey === 'role' ? sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} /> : undefined}
                      >
                        Role
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => handleSort('membershipStatus')}
                        rightIcon={sortKey === 'membershipStatus' ? sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} /> : undefined}
                      >
                        Membership
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => handleSort('accountStatus')}
                        rightIcon={sortKey === 'accountStatus' ? sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} /> : undefined}
                      >
                        Account
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        justifyContent="flex-start"
                        onClick={() => handleSort('lastActive')}
                        rightIcon={sortKey === 'lastActive' ? sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} /> : undefined}
                      >
                        Last active
                      </Button>
                      <Text fontSize="sm" color="brand.subtleText" fontWeight="semibold" px={2} py={1}>
                        Actions
                      </Text>
                    </Grid>

                    <Stack spacing={2}>
                      {paginatedUsers.map((userRow) => (
                        <Grid
                          key={userRow.id}
                          templateColumns="2fr 2fr 1fr 1fr 1fr 1fr 0.8fr"
                          gap={2}
                          p={3}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="brand.border"
                          bg="brand.accent"
                          alignItems="center"
                        >
                          <HStack spacing={3}>
                            <Box
                              w={8}
                              h={8}
                              borderRadius="full"
                              bg="white"
                              border="1px solid"
                              borderColor="brand.border"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              <User size={16} />
                            </Box>
                            <Stack spacing={0}>
                              <Text fontWeight="semibold" color="brand.text">
                                {highlightMatch(userRow.name)}
                              </Text>
                              <Text fontSize="xs" color="brand.subtleText">{userRow.role}</Text>
                            </Stack>
                          </HStack>
                          <Text color="brand.text">{highlightMatch(userRow.email || 'No email')}</Text>
                          <Badge colorScheme="blue" variant="subtle" textTransform="capitalize">
                            {userRow.role.replace('_', ' ')}
                          </Badge>
                          <Badge colorScheme={userRow.membershipStatus === 'paid' ? 'green' : 'gray'} textTransform="capitalize">
                            {userRow.membershipStatus}
                          </Badge>
                          <Badge colorScheme={userRow.accountStatus === 'active' ? 'green' : 'red'} textTransform="capitalize">
                            {userRow.accountStatus}
                          </Badge>
                          <Text fontSize="sm" color="brand.subtleText">
                            {formatDateTime(userRow.lastActive)}
                          </Text>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewUser(userRow.id)}
                          >
                            View user
                          </Button>
                        </Grid>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              ) : (
                <Box p={4} borderRadius="md" border="1px dashed" borderColor="brand.border">
                  <Text color="brand.subtleText">
                    {totalCount === 0
                      ? 'No users belong to this organization yet.'
                      : 'No users match the current search or filters.'}
                  </Text>
                </Box>
              )}

              <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
                <Text fontSize="sm" color="brand.subtleText">
                  Showing {startIndex}-{endIndex} of {filteredCount} users
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    isDisabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Select
                    size="sm"
                    value={page}
                    onChange={(event) => setPage(Number(event.target.value))}
                    width="auto"
                  >
                    {Array.from({ length: pageCount }).map((_, index) => (
                      <option key={index} value={index + 1}>
                        Page {index + 1}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    isDisabled={page >= pageCount}
                  >
                    Next
                  </Button>
                </HStack>
              </Flex>
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </Box>
  )
}

export default OrganizationDetailPage
