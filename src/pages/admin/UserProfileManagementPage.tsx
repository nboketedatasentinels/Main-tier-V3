import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Icon,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tag,
  TagLabel,
  Text,
  Textarea,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import {
  ArrowLeft,
  Edit,
  Mail,
  MessageSquare,
  Save,
  ShieldAlert,
  Trash2,
  UserX,
  X,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { UnauthorizedPage } from '@/pages/errors/UnauthorizedPage'
import { NotFoundPage } from '@/pages/errors/NotFoundPage'
import {
  fetchImpactLogSummary,
  fetchOrganizationDetails,
  fetchUserBadges,
  fetchUserProfileById,
  logUserProfileAccess,
  updateUserProfile,
  type BadgeRecord,
  type ImpactLogSummary,
  type UserProfileExtended,
} from '@/services/userProfileService'
import { deleteUserAccount } from '@/services/userManagementService'

type ViewContext = 'admin' | 'mentor'

const formatDateTime = (value?: string) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const formatDate = (value?: string) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const safeNumber = (value?: number) => (typeof value === 'number' && !Number.isNaN(value) ? value : 0)

export const UserProfileManagementPage: React.FC<{ viewContext?: ViewContext }> = ({ viewContext }) => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    profile: viewerProfile,
    isMentor,
    isAdmin,
    isSuperAdmin,
    canAccessOrganization,
  } = useAuth()
  const [profileData, setProfileData] = useState<UserProfileExtended | null>(null)
  const [organization, setOrganization] = useState<{ id: string; name: string; code?: string; status?: string } | null>(
    null,
  )
  const [impactSummary, setImpactSummary] = useState<ImpactLogSummary | null>(null)
  const [badges, setBadges] = useState<BadgeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedProfile, setEditedProfile] = useState<UserProfileExtended | null>(null)
  const [coreValuesInput, setCoreValuesInput] = useState('')
  const [notesInput, setNotesInput] = useState('')
  const accessLoggedRef = useRef(false)

  const isMentorView = viewContext === 'mentor' || isMentor

  const editableFields = useMemo(() => {
    if (isMentorView) {
      return new Set(['notes', 'goalsCompleted', 'goalsTotal', 'milestonesProgress', 'weeklyActivity'])
    }
    if (isSuperAdmin) {
      return new Set([
        'fullName',
        'email',
        'bio',
        'personalityType',
        'coreValues',
        'linkedinUrl',
        'membershipStatus',
        'accountStatus',
        'companyName',
        'companyCode',
        'companyId',
        'villageId',
        'clusterId',
        'mentorId',
        'ambassadorId',
        'role',
        'notes',
        'goalsCompleted',
        'goalsTotal',
        'milestonesProgress',
        'weeklyActivity',
      ])
    }
    return new Set([
      'fullName',
      'email',
      'bio',
      'personalityType',
      'coreValues',
      'linkedinUrl',
      'membershipStatus',
      'accountStatus',
      'companyName',
      'companyCode',
      'companyId',
      'villageId',
      'clusterId',
      'mentorId',
      'ambassadorId',
      'notes',
      'goalsCompleted',
      'goalsTotal',
      'milestonesProgress',
      'weeklyActivity',
    ])
  }, [isMentorView, isSuperAdmin])

  const canAccessProfile = useMemo(() => {
    if (!profileData || !viewerProfile) return false
    if (isSuperAdmin) return true
    if (isMentorView) {
      return profileData.mentorId === viewerProfile.id
    }
    if (isAdmin) {
      if (!profileData.companyId) return false
      return canAccessOrganization(profileData.companyId)
    }
    return false
  }, [canAccessOrganization, isAdmin, isMentorView, isSuperAdmin, profileData, viewerProfile])

  useEffect(() => {
    if (!userId) return

    const loadProfile = async () => {
      setLoading(true)
      setError(null)
      try {
        const [profile, badgeRecords, impactData] = await Promise.all([
          fetchUserProfileById(userId),
          fetchUserBadges(userId),
          fetchImpactLogSummary(userId),
        ])
        if (!profile) {
          setError('not_found')
          setLoading(false)
          return
        }
        setProfileData(profile)
        setEditedProfile(profile)
        setCoreValuesInput((profile.coreValues || []).join(', '))
        setNotesInput(profile.notes || '')
        setBadges(badgeRecords)
        setImpactSummary(impactData)
        if (profile.companyId) {
          const org = await fetchOrganizationDetails(profile.companyId)
          setOrganization(org)
        } else {
          setOrganization(null)
        }
      } catch (err) {
        console.error(err)
        setError('Unable to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [userId])

  useEffect(() => {
    if (!profileData || !viewerProfile || accessLoggedRef.current) return
    const allowed = canAccessProfile
    const reason = allowed ? 'allowed' : 'denied'
    logUserProfileAccess({
      viewerId: viewerProfile.id,
      targetUserId: profileData.id,
      viewerRole: viewerProfile.role,
      allowed,
      reason,
      route: window.location.pathname,
    }).catch((err) => console.error('Failed to log profile access', err))
    accessLoggedRef.current = true
  }, [canAccessProfile, profileData, viewerProfile])

  const handleEditToggle = () => {
    if (!profileData) return
    setIsEditing(true)
    setEditedProfile(profileData)
    setCoreValuesInput((profileData.coreValues || []).join(', '))
    setNotesInput(profileData.notes || '')
  }

  const handleCancel = () => {
    if (!profileData) return
    setIsEditing(false)
    setEditedProfile(profileData)
    setCoreValuesInput((profileData.coreValues || []).join(', '))
    setNotesInput(profileData.notes || '')
  }

  const handleSave = async () => {
    if (!profileData || !editedProfile || !userId) return

    const coreValues = coreValuesInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 5)

    const updates: Record<string, unknown> = {}

    if (editableFields.has('fullName') && editedProfile.fullName !== profileData.fullName) {
      updates.fullName = editedProfile.fullName
    }
    if (editableFields.has('email') && editedProfile.email !== profileData.email) {
      updates.email = editedProfile.email
    }
    if (editableFields.has('bio') && editedProfile.bio !== profileData.bio) {
      updates.bio = editedProfile.bio || ''
    }
    if (
      editableFields.has('personalityType') &&
      editedProfile.personalityType !== profileData.personalityType
    ) {
      updates.personalityType = editedProfile.personalityType || ''
    }
    if (editableFields.has('coreValues')) {
      updates.coreValues = coreValues
    }
    if (editableFields.has('linkedinUrl') && editedProfile.linkedinUrl !== profileData.linkedinUrl) {
      updates.linkedinUrl = editedProfile.linkedinUrl || ''
    }
    if (editableFields.has('membershipStatus') && editedProfile.membershipStatus !== profileData.membershipStatus) {
      updates.membershipStatus = editedProfile.membershipStatus || 'free'
    }
    if (editableFields.has('accountStatus') && editedProfile.accountStatus !== profileData.accountStatus) {
      updates.accountStatus = editedProfile.accountStatus || 'active'
    }
    if (editableFields.has('companyName') && editedProfile.companyName !== profileData.companyName) {
      updates.companyName = editedProfile.companyName || ''
    }
    if (editableFields.has('companyCode') && editedProfile.companyCode !== profileData.companyCode) {
      updates.companyCode = editedProfile.companyCode || ''
    }
    if (editableFields.has('companyId') && editedProfile.companyId !== profileData.companyId) {
      updates.companyId = editedProfile.companyId || ''
    }
    if (editableFields.has('villageId') && editedProfile.villageId !== profileData.villageId) {
      updates.villageId = editedProfile.villageId || ''
    }
    if (editableFields.has('clusterId') && editedProfile.clusterId !== profileData.clusterId) {
      updates.clusterId = editedProfile.clusterId || ''
    }
    if (editableFields.has('mentorId') && editedProfile.mentorId !== profileData.mentorId) {
      updates.mentorId = editedProfile.mentorId || ''
    }
    if (editableFields.has('ambassadorId') && editedProfile.ambassadorId !== profileData.ambassadorId) {
      updates.ambassadorId = editedProfile.ambassadorId || ''
    }
    if (editableFields.has('role') && editedProfile.role !== profileData.role) {
      updates.role = editedProfile.role
    }
    if (editableFields.has('notes') && notesInput !== (profileData.notes || '')) {
      updates.notes = notesInput
    }
    if (editableFields.has('goalsCompleted') && editedProfile.goalsCompleted !== profileData.goalsCompleted) {
      updates.goalsCompleted = safeNumber(editedProfile.goalsCompleted)
    }
    if (editableFields.has('goalsTotal') && editedProfile.goalsTotal !== profileData.goalsTotal) {
      updates.goalsTotal = safeNumber(editedProfile.goalsTotal)
    }
    if (
      editableFields.has('milestonesProgress') &&
      editedProfile.milestonesProgress !== profileData.milestonesProgress
    ) {
      updates.milestonesProgress = safeNumber(editedProfile.milestonesProgress)
    }
    if (editableFields.has('weeklyActivity') && editedProfile.weeklyActivity !== profileData.weeklyActivity) {
      updates.weeklyActivity = safeNumber(editedProfile.weeklyActivity)
    }

    if (!Object.keys(updates).length) {
      toast({ title: 'No changes to save', status: 'info' })
      setIsEditing(false)
      return
    }

    if (typeof updates.email === 'string') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(updates.email)) {
        toast({ title: 'Invalid email address', status: 'error' })
        return
      }
    }

    setIsSaving(true)
    const previous = profileData
    const optimistic = {
      ...profileData,
      ...updates,
      coreValues,
      notes: notesInput,
      lastModifiedByName: viewerProfile?.fullName || viewerProfile?.email || 'Unknown admin',
      lastModifiedAt: new Date().toISOString(),
    } as UserProfileExtended
    setProfileData(optimistic)
    setEditedProfile(optimistic)

    try {
      const allowedFieldsList = Array.from(editableFields)
      await updateUserProfile(
        userId,
        updates,
        allowedFieldsList,
        viewerProfile ? { id: viewerProfile.id, name: viewerProfile.fullName || viewerProfile.email } : null,
      )
      toast({ title: 'Profile updated', status: 'success' })
      setIsEditing(false)
    } catch (err) {
      console.error(err)
      setProfileData(previous)
      setEditedProfile(previous)
      toast({ title: 'Unable to save changes', status: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSuspend = async () => {
    if (!profileData || !userId) return
    if (!window.confirm(`Suspend ${profileData.fullName || profileData.email}?`)) return
    try {
      setIsSaving(true)
      await updateUserProfile(
        userId,
        { accountStatus: 'suspended' },
        Array.from(editableFields),
        viewerProfile ? { id: viewerProfile.id, name: viewerProfile.fullName || viewerProfile.email } : null,
      )
      setProfileData((prev) => (prev ? { ...prev, accountStatus: 'suspended' } : prev))
      toast({ title: 'Account suspended', status: 'warning' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to suspend account', status: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!profileData || !userId) return
    if (!window.confirm(`Delete ${profileData.fullName || profileData.email}? This action cannot be undone.`)) return
    try {
      setIsSaving(true)
      await deleteUserAccount(userId)
      toast({ title: 'Account deleted', status: 'success' })
      navigate(-1)
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to delete account', status: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <Flex minH="60vh" align="center" justify="center">
        <Spinner size="xl" />
      </Flex>
    )
  }

  if (error === 'not_found') {
    return <NotFoundPage />
  }

  if (!profileData || !viewerProfile) {
    return (
      <Flex minH="60vh" align="center" justify="center">
        <Text color="red.500">Unable to load profile.</Text>
      </Flex>
    )
  }

  if (!canAccessProfile) {
    return <UnauthorizedPage />
  }

  const avatarUrl = profileData.photoURL || profileData.avatarUrl
  const membershipBadge = profileData.membershipStatus === 'paid' ? 'green' : 'orange'
  const accountBadge = profileData.accountStatus === 'suspended' ? 'red' : 'blue'
  const mentorNotesEditable = editableFields.has('notes')
  const canEdit = editableFields.size > 0
  const progressPercent =
    safeNumber(profileData.goalsTotal) > 0
      ? Math.round((safeNumber(profileData.goalsCompleted) / safeNumber(profileData.goalsTotal)) * 100)
      : safeNumber(profileData.milestonesProgress)

  return (
    <Stack spacing={6} px={{ base: 4, md: 6, xl: 8 }} py={{ base: 6, md: 8, xl: 10 }}>
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
        <Stack spacing={2}>
          <HStack>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Icon as={ArrowLeft} />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            {canEdit && !isEditing && (
              <Button size="sm" colorScheme="purple" leftIcon={<Icon as={Edit} />} onClick={handleEditToggle}>
                Edit
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  size="sm"
                  colorScheme="purple"
                  leftIcon={<Icon as={Save} />}
                  onClick={handleSave}
                  isLoading={isSaving}
                >
                  Save
                </Button>
                <Button size="sm" variant="outline" leftIcon={<Icon as={X} />} onClick={handleCancel}>
                  Cancel
                </Button>
              </>
            )}
          </HStack>
        </Stack>
        <HStack spacing={2}>
          {isMentorView && (
            <>
              <Button size="sm" variant="outline" leftIcon={<Icon as={MessageSquare} />}>
                Send message
              </Button>
              <Button size="sm" variant="outline" leftIcon={<Icon as={Mail} />}>
                Schedule session
              </Button>
            </>
          )}
          {(isAdmin || isSuperAdmin) && (
            <>
              <Button size="sm" variant="outline" colorScheme="orange" leftIcon={<Icon as={UserX} />} onClick={handleSuspend}>
                Suspend
              </Button>
              {isSuperAdmin && (
                <Button size="sm" colorScheme="red" leftIcon={<Icon as={Trash2} />} onClick={handleDelete}>
                  Delete
                </Button>
              )}
            </>
          )}
        </HStack>
      </Flex>

      <Card>
        <CardBody>
          <Flex align="center" gap={6} flexWrap="wrap">
            <Avatar size="xl" name={profileData.fullName || profileData.email} src={avatarUrl} />
            <Stack spacing={1} flex="1">
              <Text fontSize="xl" fontWeight="bold">
                {profileData.fullName || profileData.email}
              </Text>
              <Text color="gray.500">{profileData.email}</Text>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="purple" textTransform="capitalize">
                  {profileData.role?.replace('_', ' ') || 'user'}
                </Badge>
                <Badge colorScheme={membershipBadge} textTransform="capitalize">
                  {profileData.membershipStatus || 'free'} member
                </Badge>
                <Badge colorScheme={accountBadge} textTransform="capitalize">
                  {profileData.accountStatus || 'active'}
                </Badge>
                {profileData.personalityType && (
                  <Tag colorScheme="purple" variant="subtle">
                    <TagLabel>{profileData.personalityType}</TagLabel>
                  </Tag>
                )}
              </HStack>
            </Stack>
            <Stack spacing={1} minW="200px">
              <Text fontSize="sm" color="gray.500">
                Registered
              </Text>
              <Text fontWeight="semibold">{formatDate(profileData.registrationDate || profileData.createdAt)}</Text>
              <Text fontSize="sm" color="gray.500">
                Last active
              </Text>
              <Text fontWeight="semibold">{formatDateTime(profileData.lastActive || profileData.lastActiveAt)}</Text>
            </Stack>
          </Flex>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Stack spacing={6}>
            <Card>
              <CardHeader>
                <Text fontWeight="bold">Personal information</Text>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Name</FormLabel>
                    <Input
                      value={editedProfile?.fullName || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, fullName: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('fullName')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input
                      value={editedProfile?.email || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, email: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('email')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Personality type</FormLabel>
                    <Input
                      value={editedProfile?.personalityType || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, personalityType: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('personalityType')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Core values</FormLabel>
                    <Input
                      value={coreValuesInput}
                      onChange={(event) => setCoreValuesInput(event.target.value)}
                      isDisabled={!isEditing || !editableFields.has('coreValues')}
                      placeholder="Comma separated values"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>LinkedIn</FormLabel>
                    <Input
                      value={editedProfile?.linkedinUrl || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, linkedinUrl: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('linkedinUrl')}
                    />
                  </FormControl>
                  <FormControl gridColumn={{ base: '1 / -1' }}>
                    <FormLabel>Bio</FormLabel>
                    <Textarea
                      value={editedProfile?.bio || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, bio: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('bio')}
                    />
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>

            {!isMentorView && (
              <Card>
                <CardHeader>
                  <Text fontWeight="bold">Role & permissions</Text>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Role</FormLabel>
                      <Select
                        value={editedProfile?.role || 'user'}
                        onChange={(event) =>
                          setEditedProfile((prev) => (prev ? { ...prev, role: event.target.value as UserProfileExtended['role'] } : prev))
                        }
                        isDisabled={!isEditing || !editableFields.has('role')}
                      >
                        <option value="user">User</option>
                        <option value="paid_member">Paid Member</option>
                        <option value="free_user">Free User</option>
                        <option value="team_leader">Team Leader</option>
                        <option value="mentor">Mentor</option>
                        <option value="ambassador">Ambassador</option>
                        <option value="partner">Partner Admin</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Membership status</FormLabel>
                      <Select
                        value={editedProfile?.membershipStatus || 'free'}
                        onChange={(event) =>
                          setEditedProfile((prev) => (prev ? { ...prev, membershipStatus: event.target.value as UserProfileExtended['membershipStatus'] } : prev))
                        }
                        isDisabled={!isEditing || !editableFields.has('membershipStatus')}
                      >
                        <option value="free">Free</option>
                        <option value="paid">Paid</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Account status</FormLabel>
                      <Select
                        value={editedProfile?.accountStatus?.toString() || 'active'}
                        onChange={(event) =>
                          setEditedProfile((prev) => (prev ? { ...prev, accountStatus: event.target.value } : prev))
                        }
                        isDisabled={!isEditing || !editableFields.has('accountStatus')}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="pending">Pending</option>
                        <option value="suspended">Suspended</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Mentor ID</FormLabel>
                      <Input
                        value={editedProfile?.mentorId || ''}
                        onChange={(event) =>
                          setEditedProfile((prev) => (prev ? { ...prev, mentorId: event.target.value } : prev))
                        }
                        isDisabled={!isEditing || !editableFields.has('mentorId')}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Ambassador ID</FormLabel>
                      <Input
                        value={editedProfile?.ambassadorId || ''}
                        onChange={(event) =>
                          setEditedProfile((prev) => (prev ? { ...prev, ambassadorId: event.target.value } : prev))
                        }
                        isDisabled={!isEditing || !editableFields.has('ambassadorId')}
                      />
                    </FormControl>
                  </SimpleGrid>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader>
                <Text fontWeight="bold">Organization details</Text>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Company name</FormLabel>
                    <Input
                      value={editedProfile?.companyName || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, companyName: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('companyName')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Company code</FormLabel>
                    <Input
                      value={editedProfile?.companyCode || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, companyCode: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('companyCode')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Village</FormLabel>
                    <Input
                      value={editedProfile?.villageId || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, villageId: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('villageId')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Cluster</FormLabel>
                    <Input
                      value={editedProfile?.clusterId || ''}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, clusterId: event.target.value } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('clusterId')}
                    />
                  </FormControl>
                </SimpleGrid>
                {organization && (
                  <Box mt={4} p={4} borderRadius="md" bg="gray.50">
                    <HStack justify="space-between">
                      <Box>
                        <Text fontWeight="semibold">{organization.name}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {organization.code || 'No code'} • {organization.status || 'Unknown status'}
                        </Text>
                      </Box>
                      <Badge colorScheme="purple" textTransform="capitalize">
                        Organization
                      </Badge>
                    </HStack>
                  </Box>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <Text fontWeight="bold">Progress tracking</Text>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Goals completed</FormLabel>
                    <Input
                      type="number"
                      value={editedProfile?.goalsCompleted ?? 0}
                      onChange={(event) =>
                        setEditedProfile((prev) =>
                          prev ? { ...prev, goalsCompleted: Number(event.target.value) } : prev,
                        )
                      }
                      isDisabled={!isEditing || !editableFields.has('goalsCompleted')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Goals total</FormLabel>
                    <Input
                      type="number"
                      value={editedProfile?.goalsTotal ?? 0}
                      onChange={(event) =>
                        setEditedProfile((prev) => (prev ? { ...prev, goalsTotal: Number(event.target.value) } : prev))
                      }
                      isDisabled={!isEditing || !editableFields.has('goalsTotal')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Milestones progress (%)</FormLabel>
                    <Input
                      type="number"
                      value={editedProfile?.milestonesProgress ?? 0}
                      onChange={(event) =>
                        setEditedProfile((prev) =>
                          prev ? { ...prev, milestonesProgress: Number(event.target.value) } : prev,
                        )
                      }
                      isDisabled={!isEditing || !editableFields.has('milestonesProgress')}
                    />
                  </FormControl>
                </SimpleGrid>
                <Divider my={4} />
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Weekly activity</FormLabel>
                    <Input
                      type="number"
                      value={editedProfile?.weeklyActivity ?? 0}
                      onChange={(event) =>
                        setEditedProfile((prev) =>
                          prev ? { ...prev, weeklyActivity: Number(event.target.value) } : prev,
                        )
                      }
                      isDisabled={!isEditing || !editableFields.has('weeklyActivity')}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Notes</FormLabel>
                    <Textarea
                      value={notesInput}
                      onChange={(event) => setNotesInput(event.target.value)}
                      isDisabled={!isEditing || !mentorNotesEditable}
                    />
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>
          </Stack>
        </GridItem>

        <GridItem>
          <Stack spacing={6}>
            <Card>
              <CardHeader>
                <Text fontWeight="bold">Activity & engagement</Text>
              </CardHeader>
              <CardBody>
                <Stack spacing={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Total points
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {profileData.totalPoints || 0}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Current level
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {profileData.level || 0}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Impact logs
                    </Text>
                    <Text fontSize="lg" fontWeight="semibold">
                      {impactSummary?.totalEntries ?? 0} entries
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      Last entry: {formatDateTime(impactSummary?.lastActivityAt)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Progress completion
                    </Text>
                    <HStack>
                      <Icon as={ShieldAlert} color="purple.500" />
                      <Text fontWeight="bold">{progressPercent}%</Text>
                    </HStack>
                  </Box>
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <HStack justify="space-between">
                  <Text fontWeight="bold">Badges & achievements</Text>
                  <Badge colorScheme="purple">{badges.length}</Badge>
                </HStack>
              </CardHeader>
              <CardBody>
                <Stack spacing={3}>
                  {badges.length === 0 && <Text color="gray.500">No badges found.</Text>}
                  {badges.map((badge) => (
                    <Box key={badge.id} p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                      <HStack justify="space-between" align="flex-start">
                        <Box>
                          <Text fontWeight="semibold">{badge.title}</Text>
                          <Text fontSize="sm" color="gray.500">
                            {badge.description || badge.criteria || 'No description available.'}
                          </Text>
                        </Box>
                        <Badge colorScheme={badge.earned ? 'green' : 'gray'}>
                          {badge.earned ? 'Earned' : 'In progress'}
                        </Badge>
                      </HStack>
                      {badge.progressPercentage !== undefined && (
                        <Text fontSize="xs" color="gray.500" mt={2}>
                          {badge.progressPercentage}% complete
                        </Text>
                      )}
                      {badge.earnedAt && (
                        <Text fontSize="xs" color="gray.500">
                          Earned on {formatDate(badge.earnedAt)}
                        </Text>
                      )}
                    </Box>
                  ))}
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <Text fontWeight="bold">Audit trail</Text>
              </CardHeader>
              <CardBody>
                <Stack spacing={2}>
                  <Text fontSize="sm" color="gray.500">
                    Last modified by
                  </Text>
                  <Text fontWeight="semibold">{profileData.lastModifiedByName || 'Not recorded'}</Text>
                  <Text fontSize="sm" color="gray.500">
                    Last modified at
                  </Text>
                  <Text fontWeight="semibold">{formatDateTime(profileData.lastModifiedAt || profileData.updatedAt)}</Text>
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <HStack justify="space-between">
                  <Text fontWeight="bold">Access & status</Text>
                  <Tooltip label="Role-based visibility is enforced for this profile">
                    <Badge colorScheme="purple">Protected</Badge>
                  </Tooltip>
                </HStack>
              </CardHeader>
              <CardBody>
                <Stack spacing={3}>
                  <HStack justify="space-between">
                    <Text color="gray.500">Viewer role</Text>
                    <Badge colorScheme="purple">{viewerProfile.role}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500">Organization access</Text>
                    <Text fontWeight="semibold">
                      {isSuperAdmin ? 'All organizations' : profileData.companyCode || 'Restricted'}
                    </Text>
                  </HStack>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </GridItem>
      </Grid>
    </Stack>
  )
}
