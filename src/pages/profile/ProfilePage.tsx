import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Center,
  Collapse,
  Alert,
  AlertIcon,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Link,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Textarea,
  Tooltip,
  useToast,
  VStack,
} from '@chakra-ui/react'
import {
  AlertCircle,
  Brain,
  Building,
  Calendar,
  Check,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Edit,
  ExternalLink,
  Github,
  Key,
  Linkedin,
  Loader2,
  Lock,
  Mail as MailIcon,
  LogOut,
  Save,
  Settings,
  Shield,
  TrendingUp,
  Twitter,
  Upload,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  EmailAuthProvider,
  User as FirebaseUser,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { StandardRole, Organization, DashboardPreferences } from '@/types'
import { TransformationTier, UserRole } from '@/types'
import { normalizeRole } from '@/utils/role'
import { incrementOrganizationMemberCount, validateCompanyCode } from '@/services/organizationService'
import { fetchVillageById, VillageSummary } from '@/services/villageService'
import { CORE_VALUES } from '@/config/personality-data'
import BadgeDisplay from '@/components/profile/BadgeDisplay'

interface ProfileData {
  id: string
  fullName: string
  email: string
  role: StandardRole
  accountStatus: 'active' | 'inactive' | 'pending'
  membershipStatus: 'paid' | 'free'
  profilePictureUrl?: string
  personalityType?: string
  coreValues: string[]
  hasCompletedPersonalityTest?: boolean
  hasCompletedValuesTest?: boolean
  bio?: string
  timezone?: string
  matchRefreshPreference?: 'weekly' | 'biweekly' | 'on-demand' | 'disabled'
  preferredMatchDay?: number
  matchNotificationPreference?: 'email' | 'in_app' | 'both'
  dashboardPreferences?: DashboardPreferences
  socialLinks: {
    linkedin?: string
    twitter?: string
    github?: string
  }
  leaderboardVisibility: 'public' | 'company' | 'private'
  registrationDate?: string
  companyName?: string
  companyCode?: string
  companyId?: string | null
  villageId?: string | null
  villageName?: string
  clusterName?: string
}

const personalityTypes = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
]

const coreValueOptions = CORE_VALUES

const roleDisplayMap: Record<StandardRole, string> = {
  user: 'Learner',
  free_user: 'Learner',
  paid_member: 'Learner',
  mentor: 'Mentor',
  ambassador: 'Ambassador',
  partner: 'Partner',
  super_admin: 'Super Admin',
}

const statusColorMap: Record<ProfileData['accountStatus'], string> = {
  active: 'green',
  inactive: 'orange',
  pending: 'yellow',
}

const membershipCopy: Record<ProfileData['membershipStatus'], { title: string; description: string; badge: string }> = {
  paid: {
    title: 'Paid Membership',
    description: 'Full access to all features and content',
    badge: 'Active',
  },
  free: {
    title: 'Free Account',
    description: 'Limited access to basic features',
    badge: 'Limited',
  },
}

const matchRefreshOptions: Array<{ label: string; value: NonNullable<ProfileData['matchRefreshPreference']> }> = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Every 2 weeks', value: 'biweekly' },
  { label: 'On-demand', value: 'on-demand' },
  { label: 'Disabled', value: 'disabled' },
]

const matchNotificationOptions: Array<{ label: string; value: NonNullable<ProfileData['matchNotificationPreference']> }> = [
  { label: 'Email only', value: 'email' },
  { label: 'In-app only', value: 'in_app' },
  { label: 'Email + in-app', value: 'both' },
]

const weekdayOptions = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]

const timezoneOptions = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
]

const PaymentHistory: React.FC<{ hasRecords: boolean }> = ({ hasRecords }) => {
  if (!hasRecords) {
    return (
      <Text fontSize="sm" color="brand.subtleText">
        No payment history — upgrade to start your subscription.
      </Text>
    )
  }

  return (
    <Card mt={6} borderColor="brand.border" boxShadow="card">
      <CardHeader>
        <Flex justify="space-between" align="center">
          <Box>
            <Text fontWeight="semibold" fontSize="lg">
              Payment History
            </Text>
            <Text fontSize="sm" color="brand.subtleText">
              Track your recent subscription payments
            </Text>
          </Box>
          <Icon as={CreditCard} color="brand.primary" />
        </Flex>
      </CardHeader>
      <CardBody>
        <VStack spacing={4} align="stretch">
          <Flex align="center" justify="center" color="brand.subtleText" direction="column" py={6}>
            <Icon as={TrendingUp} mb={2} />
            <Text>No payment records yet.</Text>
          </Flex>
        </VStack>
      </CardBody>
    </Card>
  )
}

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [editedData, setEditedData] = useState<ProfileData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null)
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [visibilityMessage, setVisibilityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [companyCode, setCompanyCode] = useState('')
  const [companyCodeValid, setCompanyCodeValid] = useState<boolean | null>(null)
  const [companyCodeError, setCompanyCodeError] = useState<string | null>(null)
  const [companyCodeChecking, setCompanyCodeChecking] = useState(false)
  const [companyOrganization, setCompanyOrganization] = useState<Organization | null>(null)
  const [companyCodeSaving, setCompanyCodeSaving] = useState(false)
  const [personalityTestError, setPersonalityTestError] = useState<string | null>(null)
  const [valuesTestError, setValuesTestError] = useState<string | null>(null)
  const [personalityFormError, setPersonalityFormError] = useState<string | null>(null)
  const [matchPreferencesSaving, setMatchPreferencesSaving] = useState(false)
  const [matchPreferencesMessage, setMatchPreferencesMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAdvancedMatching, setShowAdvancedMatching] = useState(false)
  const [accountSettingsSaving, setAccountSettingsSaving] = useState(false)
  const [organizationMessage, setOrganizationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [villageDetails, setVillageDetails] = useState<VillageSummary | null>(null)
  const [villageLoading, setVillageLoading] = useState(false)
  const [villageError, setVillageError] = useState<string | null>(null)
  const [isLeaveVillageOpen, setIsLeaveVillageOpen] = useState(false)
  const [isLeavingVillage, setIsLeavingVillage] = useState(false)
  const cancelLeaveRef = useRef<HTMLButtonElement | null>(null)

  const hasAccountSettingsChanges = useMemo(() => {
    if (!editedData || !profileData) return false
    const hasMatchChanges = editedData.matchRefreshPreference !== profileData.matchRefreshPreference
      || editedData.preferredMatchDay !== profileData.preferredMatchDay
      || editedData.matchNotificationPreference !== profileData.matchNotificationPreference
      || editedData.timezone !== profileData.timezone
    const hasVisibilityChange = editedData.leaderboardVisibility !== profileData.leaderboardVisibility
    return hasMatchChanges || hasVisibilityChange
  }, [editedData, profileData])

  const buildProfileFromDoc = useCallback(
    (docData: Record<string, unknown>): ProfileData => ({
      id: String(docData.id),
      fullName:
        (typeof docData.fullName === 'string' && docData.fullName) ||
        (typeof docData.full_name === 'string' && docData.full_name) ||
        (typeof docData.firstName === 'string' && docData.firstName) ||
        'User',
      email: (typeof docData.email === 'string' && docData.email) || '',
      role: (docData.role as StandardRole) || profile?.role || 'user',
      accountStatus: (docData.accountStatus as ProfileData['accountStatus']) || 'active',
      membershipStatus: (docData.membershipStatus as ProfileData['membershipStatus']) ||
        ((normalizeRole(docData.role as StandardRole) === 'user' && profile?.membershipStatus === 'paid') ? 'paid' : 'free'),
      profilePictureUrl:
        (typeof docData.avatarUrl === 'string' ? docData.avatarUrl : undefined) ||
        (typeof docData.profilePictureUrl === 'string' ? docData.profilePictureUrl : undefined) ||
        (typeof docData.profile_picture_url === 'string' ? docData.profile_picture_url : undefined),
      personalityType:
        (typeof docData.personalityType === 'string' ? docData.personalityType : undefined) ||
        (typeof docData.personality_type === 'string' ? docData.personality_type : undefined),
      coreValues: (docData.coreValues as string[]) || (docData.core_values as string[]) || [],
      hasCompletedPersonalityTest:
        (typeof docData.hasCompletedPersonalityTest === 'boolean'
          ? docData.hasCompletedPersonalityTest
          : profile?.hasCompletedPersonalityTest) || false,
      hasCompletedValuesTest:
        (typeof docData.hasCompletedValuesTest === 'boolean'
          ? docData.hasCompletedValuesTest
          : profile?.hasCompletedValuesTest) || false,
      bio: (typeof docData.bio === 'string' && docData.bio) || '',
      timezone: (docData.timezone as string) || profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      matchRefreshPreference: (docData.matchRefreshPreference as ProfileData['matchRefreshPreference']) || 'weekly',
      preferredMatchDay: typeof docData.preferredMatchDay === 'number' ? docData.preferredMatchDay : 1,
      matchNotificationPreference:
        (docData.matchNotificationPreference as ProfileData['matchNotificationPreference']) || 'both',
      socialLinks: (docData.socialLinks as Record<string, string>) ||
        (docData.social_media_links as Record<string, string>) ||
        {},
      leaderboardVisibility: (docData.leaderboardVisibility as ProfileData['leaderboardVisibility']) ||
        (docData.leaderboard_visibility as ProfileData['leaderboardVisibility']) ||
        'public',
      registrationDate: (docData.registrationDate as string) || (docData.createdAt as string),
      companyName: docData.companyName as string,
      companyCode: docData.companyCode as string,
      villageId: (docData.villageId as string) || null,
      villageName: docData.villageName as string,
      clusterName: docData.clusterName as string,
    }),
    [profile?.role, profile?.membershipStatus, profile?.hasCompletedPersonalityTest, profile?.hasCompletedValuesTest]
  )

  const fetchUserProfile = useCallback(async () => {
    if (!user) {
      setLoading(false)
      setError('You need to sign in to view this page.')
      navigate('/login')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const profileDoc = await getDoc(doc(db, 'profiles', user.uid))
      if (!profileDoc.exists()) {
        setError('Profile not found. Please contact support.')
        setLoading(false)
        return
      }
      const data = buildProfileFromDoc({ id: user.uid, ...profileDoc.data() })
      setProfileData(data)
      setEditedData(data)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setError('Failed to load your profile. Please try again later.')
      setLoading(false)
    }
  }, [buildProfileFromDoc, navigate, user])

  useEffect(() => {
    fetchUserProfile()
  }, [fetchUserProfile])

  useEffect(() => {
    setCompanyCode(profileData?.companyCode || '')
  }, [profileData?.companyCode])

  const villageId = useMemo(
    () => profile?.villageId || profileData?.villageId || null,
    [profile?.villageId, profileData?.villageId],
  )
  const isPaidMember = profileData?.membershipStatus === 'paid'
  const shouldShowVillageCard = !isPaidMember && Boolean(villageId)

  useEffect(() => {
    let isMounted = true

    const loadVillageDetails = async () => {
      if (!villageId || isPaidMember) {
        if (isMounted) {
          setVillageDetails(null)
          setVillageLoading(false)
          setVillageError(null)
        }
        return
      }

      if (isMounted) {
        setVillageLoading(true)
        setVillageError(null)
      }

      const details = await fetchVillageById(villageId)

      if (!isMounted) return

      if (!details) {
        setVillageDetails(null)
        setVillageError('We could not load your village details. Please try again later.')
      } else {
        setVillageDetails(details)
        setVillageError(null)
      }
      setVillageLoading(false)
    }

    loadVillageDetails()

    return () => {
      isMounted = false
    }
  }, [isPaidMember, villageId])

  useEffect(() => {
    const trimmedCode = companyCode.trim().toUpperCase()

    if (!trimmedCode) {
      setCompanyCodeValid(null)
      setCompanyCodeError(null)
      setCompanyOrganization(null)
      setCompanyCodeChecking(false)
      return
    }

    if (trimmedCode.length !== 6) {
      setCompanyCodeValid(null)
      setCompanyCodeError(null)
      setCompanyOrganization(null)
      setCompanyCodeChecking(false)
      return
    }

    let cancelled = false
    setCompanyCodeChecking(true)

    validateCompanyCode(trimmedCode).then((result) => {
      if (cancelled) return
      setCompanyCodeValid(result.valid)
      setCompanyCodeError(result.error ?? null)
      setCompanyOrganization(result.valid && result.organization ? result.organization : null)
      setCompanyCodeChecking(false)
    })

    return () => {
      cancelled = true
    }
  }, [companyCode])

  useEffect(() => {
    if (organizationMessage?.type !== 'success') return
    const timer = window.setTimeout(() => setOrganizationMessage(null), 6000)
    return () => window.clearTimeout(timer)
  }, [organizationMessage])

  const handleInputChange = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
    if (!editedData) return
    setEditedData({ ...editedData, [field]: value })
  }

  const handleSocialLinkChange = (platform: keyof ProfileData['socialLinks'], value: string) => {
    if (!editedData) return
    setEditedData({ ...editedData, socialLinks: { ...editedData.socialLinks, [platform]: value } })
  }

  const formatVillageDate = (value?: string) => {
    if (!value) return 'Unknown'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return 'Unknown'
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
  }

  const handleManageVillage = () => {
    if (!villageId) return
    navigate(`/app/villages/${villageId}`)
  }

  const handleInviteVillage = () => {
    if (!villageId) return
    navigate(`/app/villages/${villageId}/invite`)
  }

  const handleLeaveVillage = async () => {
    if (!user) return
    setIsLeavingVillage(true)
    try {
      await Promise.all([
        updateDoc(doc(db, 'users', user.uid), { villageId: null, updatedAt: serverTimestamp() }),
        updateDoc(doc(db, 'profiles', user.uid), { villageId: null, updatedAt: serverTimestamp() }),
      ])
      await refreshProfile({ reason: 'village-left' })
      setVillageDetails(null)
      setVillageError(null)
      toast({
        title: 'You left the village',
        description: 'Your village affiliation has been removed.',
        status: 'success',
        duration: 4000,
      })
    } catch (leaveError) {
      console.error('Failed to leave village', leaveError)
      toast({
        title: 'Unable to leave village',
        description: 'Please try again or contact support if the issue persists.',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsLeavingVillage(false)
      setIsLeaveVillageOpen(false)
    }
  }

  const handleCoreValueToggle = (value: string) => {
    if (!editedData) return
    const hasValue = editedData.coreValues.includes(value)
    if (hasValue) {
      setEditedData({ ...editedData, coreValues: editedData.coreValues.filter((item) => item !== value) })
    } else if (editedData.coreValues.length < 5) {
      setEditedData({ ...editedData, coreValues: [...editedData.coreValues, value] })
    }
    setPersonalityFormError(null)
  }

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editedData) return
    setProfilePictureFile(file)
    // Update editedData with preview URL for immediate display in the banner avatar
    const previewUrl = URL.createObjectURL(file)
    setEditedData({ ...editedData, profilePictureUrl: previewUrl })
  }

  const uploadProfilePicture = async (): Promise<string | undefined> => {
    if (!profilePictureFile || !user) return editedData?.profilePictureUrl
    const storageRef = ref(storage, `profile_pictures/${user.uid}`)
    await uploadBytes(storageRef, profilePictureFile)
    const url = await getDownloadURL(storageRef)
    return url
  }

  const handleSaveProfile = async () => {
    if (!user || !editedData) return
    setIsSaving(true)
    setError(null)
    setPersonalityTestError(null)
    setValuesTestError(null)
    setPersonalityFormError(null)

    if (!editedData.hasCompletedPersonalityTest || !editedData.hasCompletedValuesTest) {
      if (!editedData.hasCompletedPersonalityTest) {
        setPersonalityTestError('Please confirm you have taken the 16 Personalities test.')
      }
      if (!editedData.hasCompletedValuesTest) {
        setValuesTestError('Please confirm you have taken the Personal Values test.')
      }
      window.alert('Please confirm you have completed the required tests before saving.')
      setIsSaving(false)
      return
    }

    if (!editedData.personalityType) {
      setPersonalityFormError('Please select your personality type.')
      setIsSaving(false)
      return
    }

    if (editedData.coreValues.length !== 5) {
      setPersonalityFormError('Please select exactly 5 core values.')
      setIsSaving(false)
      return
    }
    try {
      const uploadedUrl = await uploadProfilePicture()
      const payload = {
        fullName: editedData.fullName,
        email: editedData.email,
        personalityType: editedData.personalityType || null,
        coreValues: editedData.coreValues,
        hasCompletedPersonalityTest: editedData.hasCompletedPersonalityTest ?? false,
        hasCompletedValuesTest: editedData.hasCompletedValuesTest ?? false,
        profilePictureUrl: uploadedUrl || editedData.profilePictureUrl || null,
        bio: editedData.bio || '',
        socialLinks: editedData.socialLinks,
        leaderboardVisibility: editedData.leaderboardVisibility,
        updatedAt: serverTimestamp(),
      }
      await Promise.all([
        updateDoc(doc(db, 'profiles', user.uid), payload),
        updateDoc(doc(db, 'users', user.uid), {
          personalityType: payload.personalityType,
          coreValues: payload.coreValues,
          hasCompletedPersonalityTest: payload.hasCompletedPersonalityTest,
          hasCompletedValuesTest: payload.hasCompletedValuesTest,
          updatedAt: serverTimestamp(),
        }),
      ])
      const updatedProfile = { ...editedData, profilePictureUrl: uploadedUrl || editedData.profilePictureUrl }
      setProfileData(updatedProfile)
      setEditedData(updatedProfile)
      setIsEditing(false)
      toast({
        title: 'Profile updated',
        description: 'Your profile details were saved successfully.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
    } catch (err) {
      console.error(err)
      setError('Unable to save your profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedData(profileData)
    setProfilePictureFile(null)
    setPersonalityTestError(null)
    setValuesTestError(null)
    setPersonalityFormError(null)
  }

  const reauthenticateUser = async (currentUser: FirebaseUser, password: string) => {
    const credential = EmailAuthProvider.credential(currentUser.email || '', password)
    return reauthenticateWithCredential(currentUser, credential)
  }

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth.currentUser || !editedData) return

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(emailForm.newEmail)) {
      setEmailMessage({ type: 'error', text: 'Please provide a valid email address.' })
      return
    }

    try {
      await reauthenticateUser(auth.currentUser, emailForm.password)
      await updateEmail(auth.currentUser, emailForm.newEmail)
      await updateDoc(doc(db, 'profiles', auth.currentUser.uid), {
        email: emailForm.newEmail,
        updatedAt: serverTimestamp(),
      })

      const updated = { ...editedData, email: emailForm.newEmail }
      setProfileData(updated)
      setEditedData(updated)
      setEmailMessage({ type: 'success', text: 'Email updated successfully.' })
      setTimeout(() => {
        setEmailFormOpen(false)
        setEmailMessage(null)
      }, 2000)
    } catch (err) {
      console.error(err)
      setEmailMessage({ type: 'error', text: 'Unable to update email. Check your password and try again.' })
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth.currentUser) return

    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirmation do not match.' })
      return
    }

    try {
      await reauthenticateUser(auth.currentUser, passwordForm.currentPassword)
      await updatePassword(auth.currentUser, passwordForm.newPassword)
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' })
      setTimeout(() => {
        setPasswordFormOpen(false)
        setPasswordMessage(null)
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }, 2000)
    } catch (err) {
      console.error(err)
      setPasswordMessage({ type: 'error', text: 'Unable to update password. Please try again.' })
    }
  }

  const handleSaveVisibilityPreference = async () => {
    if (!auth.currentUser || !editedData) return
    setVisibilitySaving(true)
    try {
      await updateDoc(doc(db, 'profiles', auth.currentUser.uid), {
        leaderboardVisibility: editedData.leaderboardVisibility,
        updatedAt: serverTimestamp(),
      })
      setProfileData({ ...editedData })
      setVisibilityMessage({ type: 'success', text: 'Leaderboard visibility updated successfully.' })
    } catch (err) {
      console.error(err)
      setVisibilityMessage({ type: 'error', text: 'Unable to save preference.' })
    } finally {
      setVisibilitySaving(false)
    }
  }

  const handleSaveMatchPreferences = async () => {
    if (!auth.currentUser || !editedData) return
    setMatchPreferencesSaving(true)
    setMatchPreferencesMessage(null)
    try {
      const updates = {
        matchRefreshPreference: editedData.matchRefreshPreference || 'weekly',
        preferredMatchDay: editedData.preferredMatchDay ?? 1,
        matchNotificationPreference: editedData.matchNotificationPreference || 'both',
        timezone: editedData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        updatedAt: serverTimestamp(),
      }
      await Promise.all([
        updateDoc(doc(db, 'profiles', auth.currentUser.uid), updates),
        updateDoc(doc(db, 'users', auth.currentUser.uid), updates),
      ])
      setProfileData({ ...editedData, ...updates })
      setMatchPreferencesMessage({ type: 'success', text: 'Peer matching preferences updated.' })
    } catch (err) {
      console.error(err)
      setMatchPreferencesMessage({ type: 'error', text: 'Unable to save peer matching preferences.' })
    } finally {
      setMatchPreferencesSaving(false)
    }
  }

  const handleCompanyCodeSave = async () => {
    if (!user || !profileData) return
    const trimmedCode = companyCode.trim().toUpperCase()
    const currentCompanyCode = (profileData.companyCode || '').trim().toUpperCase()

    if (trimmedCode === currentCompanyCode && profileData.companyId) {
      setOrganizationMessage({
        type: 'error',
        text: `You're already connected to ${profileData.companyName || 'this organization'}.`,
      })
      return
    }

    if (!trimmedCode) {
      toast({
        title: 'Company code required',
        description: 'Enter your 6-character company code to continue.',
        status: 'warning',
        duration: 4000,
      })
      return
    }

    if (trimmedCode.length !== 6) {
      toast({
        title: 'Invalid company code',
        description: 'Company codes must be 6 characters.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    if (companyCodeValid === false || companyCodeChecking) {
      toast({
        title: 'Company code not ready',
        description: companyCodeError || 'Please wait while we verify the company code.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    setCompanyCodeSaving(true)
    setOrganizationMessage(null)
    const membershipUpdates = {
      membershipStatus: 'paid' as const,
      role: UserRole.PAID_MEMBER,
      transformationTier: companyOrganization
        ? TransformationTier.CORPORATE_MEMBER
        : TransformationTier.INDIVIDUAL_PAID,
      dashboardPreferences: {
        ...(profileData.dashboardPreferences ?? {}),
        lockedToFreeExperience: false,
      },
    }
    const updates = {
      companyCode: trimmedCode,
      companyId: companyOrganization?.id ?? null,
      companyName: companyOrganization?.name ?? null,
      updatedAt: serverTimestamp(),
    }

    const shouldIncrementMemberCount =
      !!companyOrganization?.id && companyOrganization.id !== profile?.companyId

    try {
      await Promise.all([
        updateDoc(doc(db, 'profiles', user.uid), {
          ...updates,
          ...membershipUpdates,
        }),
        updateDoc(doc(db, 'users', user.uid), {
          ...updates,
          ...membershipUpdates,
        }),
      ])

      if (companyOrganization?.id && shouldIncrementMemberCount) {
        try {
          await incrementOrganizationMemberCount(companyOrganization.id)
        } catch (incrementError) {
          console.warn('Unable to increment organization member count', incrementError)
        }
      }

      await refreshProfile({ reason: 'company-code-upgrade' })

      const updatedProfile = {
        ...profileData,
        companyCode: trimmedCode,
        companyName: companyOrganization?.name ?? profileData.companyName,
        ...membershipUpdates,
      }
      setProfileData(updatedProfile)
      setEditedData(updatedProfile)

      setOrganizationMessage({
        type: 'success',
        text: companyOrganization?.name
          ? `Connected to ${companyOrganization.name}. Your membership is now paid—check your dashboard for new features.`
          : 'Company code saved successfully. Your membership is now paid—check your dashboard for new features.',
      })

      toast({
        title: 'You are now a paid member',
        description: companyOrganization?.name
          ? `Connected to ${companyOrganization.name}. Your membership has been upgraded.`
          : 'Company code saved successfully. Your membership has been upgraded.',
        status: 'success',
        duration: 4000,
      })
    } catch (err) {
      console.error(err)
      setOrganizationMessage({
        type: 'error',
        text: 'We could not connect this organization. Please try again or contact support.',
      })
      toast({
        title: 'Unable to update company code',
        description: 'Please try again or contact support.',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setCompanyCodeSaving(false)
    }
  }

  const handleSaveAccountSettings = async () => {
    if (!editedData || !profileData) return
    setAccountSettingsSaving(true)

    try {
      await Promise.all([handleSaveMatchPreferences(), handleSaveVisibilityPreference()])
    } finally {
      setAccountSettingsSaving(false)
    }
  }

  const handleCopyAccountId = async () => {
    if (!profileData?.id) return
    try {
      await navigator.clipboard.writeText(profileData.id)
      toast({
        title: 'Account ID copied',
        description: 'Share this with support if they ask for it.',
        status: 'success',
        duration: 3000,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Unable to copy ID',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleUpgrade = () => {
    navigate('/upgrade')
  }

  // Build subtitle for profile banner
  const buildSubtitle = () => {
    const parts: string[] = []
    parts.push(roleDisplayMap[profileData?.role || 'user'])
    if (profileData?.personalityType) {
      parts.push(profileData.personalityType)
    }
    if (profileData?.registrationDate) {
      const date = new Date(profileData.registrationDate)
      if (!Number.isNaN(date.getTime())) {
        parts.push(`Member since ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`)
      }
    }
    return parts.join(' · ')
  }

  const normalizedCompanyCode = companyCode.trim().toUpperCase()
  const currentCompanyCode = (profileData?.companyCode || '').trim().toUpperCase()
  const isAlreadyConnected = Boolean(normalizedCompanyCode)
    && normalizedCompanyCode === currentCompanyCode
    && Boolean(profileData?.companyId)

  if (loading) {
    return (
      <Center h="70vh">
        <VStack spacing={4}>
          <Spinner color="brand.primary" size="lg" />
          <Text color="brand.subtleText">Loading your profile...</Text>
        </VStack>
      </Center>
    )
  }

  if (error || !profileData || !editedData) {
    return (
      <Center h="70vh">
        <VStack spacing={4}>
          <Icon as={AlertCircle} color="red.500" boxSize={8} />
          <Text color="brand.text">{error || 'Something went wrong loading your profile.'}</Text>
          <Button variant="ghost" rightIcon={<ChevronRight />} onClick={() => navigate('/app/leaderboard')}>
            Back to Dashboard
          </Button>
        </VStack>
      </Center>
    )
  }

  return (
    <Box px={{ base: 4, md: 6 }} py={6}>
      {/* Simplified Profile Banner */}
      <Card mb={8} borderColor="brand.border" boxShadow="card">
        <CardBody py={6}>
          <Flex justify="space-between" align="center">
            <HStack spacing={4} align="center">
              <Box position="relative" cursor="pointer" as="label">
                {editedData.profilePictureUrl ? (
                  <Avatar src={editedData.profilePictureUrl} name={editedData.fullName} size="xl" />
                ) : (
                  <Center
                    w="96px"
                    h="96px"
                    rounded="full"
                    bg="brand.primary"
                    color="white"
                    fontWeight="bold"
                    fontSize="2xl"
                  >
                    {editedData.fullName.slice(0, 2).toUpperCase()}
                  </Center>
                )}
                <Center
                  position="absolute"
                  bottom={0}
                  right={0}
                  w="28px"
                  h="28px"
                  bg="white"
                  rounded="full"
                  border="2px solid"
                  borderColor="brand.border"
                  boxShadow="sm"
                >
                  <Icon as={Upload} size={14} color="brand.subtleText" />
                </Center>
                <Input
                  type="file"
                  accept="image/*"
                  display="none"
                  onChange={handleProfilePictureChange}
                />
              </Box>
              <Box>
                <Text fontWeight="bold" fontSize="2xl" color="brand.text">
                  {profileData.fullName}
                </Text>
                <Text fontSize="sm" color="brand.subtleText" mt={1}>
                  {buildSubtitle()}
                </Text>
              </Box>
            </HStack>
            <Tooltip label="Edit profile" hasArrow>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                aria-label="Edit profile"
              >
                <Icon as={Edit} size={18} />
              </Button>
            </Tooltip>
          </Flex>
        </CardBody>
      </Card>

      <Tabs variant="unstyled" colorScheme="brand">
        <TabList borderBottom="1px solid" borderColor="brand.border" mb={4}>
          {['Profile', 'Account Settings', 'Membership'].map((tab) => (
            <Tab
              key={tab}
              px={4}
              py={3}
              _selected={{ borderBottom: '3px solid', borderColor: 'brand.primary', color: 'brand.primary', fontWeight: 'bold' }}
              color="brand.subtleText"
            >
              {tab}
            </Tab>
          ))}
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <Grid templateColumns={{ base: '1fr', lg: '7fr 5fr' }} gap={8}>
              {/* Left Column - About Me */}
              <GridItem>
                <Card borderColor="brand.border" boxShadow="card">
                  <CardHeader pb={2}>
                    <Flex justify="space-between" align="center">
                      <Text fontWeight="semibold" fontSize="lg">
                        About Me
                      </Text>
                      {isEditing && (
                        <HStack spacing={2}>
                          <Button size="sm" variant="ghost" leftIcon={<X size={16} />} onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" leftIcon={isSaving ? <Loader2 size={16} /> : <Save size={16} />} onClick={handleSaveProfile} isDisabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </HStack>
                      )}
                    </Flex>
                  </CardHeader>
                  <CardBody pt={4}>
                    <VStack align="stretch" spacing={6}>
                      {/* Name & Email Section */}
                      <Box>
                        <FormControl mb={4}>
                          <FormLabel fontSize="sm" color="brand.subtleText" mb={1}>Full Name</FormLabel>
                          {!isEditing ? (
                            <Text fontSize="lg" fontWeight="medium" color="brand.text">{profileData.fullName}</Text>
                          ) : (
                            <Input value={editedData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} />
                          )}
                        </FormControl>

                        <FormControl>
                          <FormLabel fontSize="sm" color="brand.subtleText" mb={1}>Email Address</FormLabel>
                          {!isEditing ? (
                            <HStack spacing={2} color="brand.text">
                              <Icon as={MailIcon} size={16} color="brand.subtleText" />
                              <Text>{profileData.email}</Text>
                            </HStack>
                          ) : (
                            <Input type="email" value={editedData.email} onChange={(e) => handleInputChange('email', e.target.value)} />
                          )}
                        </FormControl>
                      </Box>

                      <Divider borderColor="brand.border" />

                      {/* Bio Section */}
                      <FormControl>
                        <FormLabel fontSize="sm" color="brand.subtleText" mb={1}>Bio</FormLabel>
                        {!isEditing ? (
                          profileData.bio ? (
                            <Text whiteSpace="pre-wrap" color="brand.text" lineHeight="tall">
                              {profileData.bio}
                            </Text>
                          ) : (
                            <Box py={2}>
                              <Text color="brand.subtleText" mb={2}>Add a bio to help others get to know you</Text>
                              <Button
                                size="sm"
                                variant="ghost"
                                color="brand.primary"
                                leftIcon={<Edit size={14} />}
                                onClick={() => setIsEditing(true)}
                                p={0}
                                h="auto"
                                _hover={{ bg: 'transparent', textDecoration: 'underline' }}
                              >
                                Add a bio
                              </Button>
                            </Box>
                          )
                        ) : (
                          <Textarea
                            value={editedData.bio}
                            rows={4}
                            onChange={(e) => handleInputChange('bio', e.target.value)}
                            placeholder="Tell others about yourself..."
                          />
                        )}
                      </FormControl>

                      <Divider borderColor="brand.border" />

                      {/* Social Links Section */}
                      <FormControl>
                        <FormLabel fontSize="sm" color="brand.subtleText" mb={2}>Social Links</FormLabel>
                        {!isEditing ? (
                          editedData.socialLinks.linkedin || editedData.socialLinks.twitter || editedData.socialLinks.github ? (
                            <HStack spacing={3} flexWrap="wrap">
                              {editedData.socialLinks.linkedin && (
                                <Link href={editedData.socialLinks.linkedin} isExternal>
                                  <HStack spacing={1} color="brand.primary" _hover={{ textDecoration: 'underline' }}>
                                    <Icon as={Linkedin} size={16} />
                                    <Text fontSize="sm">LinkedIn</Text>
                                  </HStack>
                                </Link>
                              )}
                              {editedData.socialLinks.twitter && (
                                <Link href={editedData.socialLinks.twitter} isExternal>
                                  <HStack spacing={1} color="brand.primary" _hover={{ textDecoration: 'underline' }}>
                                    <Icon as={Twitter} size={16} />
                                    <Text fontSize="sm">Twitter</Text>
                                  </HStack>
                                </Link>
                              )}
                              {editedData.socialLinks.github && (
                                <Link href={editedData.socialLinks.github} isExternal>
                                  <HStack spacing={1} color="brand.primary" _hover={{ textDecoration: 'underline' }}>
                                    <Icon as={Github} size={16} />
                                    <Text fontSize="sm">GitHub</Text>
                                  </HStack>
                                </Link>
                              )}
                            </HStack>
                          ) : (
                            <Box py={2}>
                              <Text color="brand.subtleText" mb={2}>Connect your accounts</Text>
                              <HStack spacing={2}>
                                <Tooltip label="Add LinkedIn" hasArrow>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsEditing(true)}
                                    borderColor="brand.border"
                                    _hover={{ borderColor: 'brand.primary' }}
                                  >
                                    <Icon as={Linkedin} size={16} />
                                  </Button>
                                </Tooltip>
                                <Tooltip label="Add Twitter" hasArrow>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsEditing(true)}
                                    borderColor="brand.border"
                                    _hover={{ borderColor: 'brand.primary' }}
                                  >
                                    <Icon as={Twitter} size={16} />
                                  </Button>
                                </Tooltip>
                                <Tooltip label="Add GitHub" hasArrow>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsEditing(true)}
                                    borderColor="brand.border"
                                    _hover={{ borderColor: 'brand.primary' }}
                                  >
                                    <Icon as={Github} size={16} />
                                  </Button>
                                </Tooltip>
                              </HStack>
                            </Box>
                          )
                        ) : (
                          <VStack spacing={3} align="stretch">
                            <InputGroup size="sm">
                              <InputLeftElement pointerEvents="none">
                                <Icon as={Linkedin} color="brand.subtleText" size={16} />
                              </InputLeftElement>
                              <Input
                                placeholder="LinkedIn profile URL"
                                value={editedData.socialLinks.linkedin || ''}
                                onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                                type="url"
                              />
                            </InputGroup>
                            <InputGroup size="sm">
                              <InputLeftElement pointerEvents="none">
                                <Icon as={Twitter} color="brand.subtleText" size={16} />
                              </InputLeftElement>
                              <Input
                                placeholder="Twitter profile URL"
                                value={editedData.socialLinks.twitter || ''}
                                onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                                type="url"
                              />
                            </InputGroup>
                            <InputGroup size="sm">
                              <InputLeftElement pointerEvents="none">
                                <Icon as={Github} color="brand.subtleText" size={16} />
                              </InputLeftElement>
                              <Input
                                placeholder="GitHub profile URL"
                                value={editedData.socialLinks.github || ''}
                                onChange={(e) => handleSocialLinkChange('github', e.target.value)}
                                type="url"
                              />
                            </InputGroup>
                          </VStack>
                        )}
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>

              {/* Right Column */}
              <GridItem>
                <VStack spacing={6}>
                  {/* Personality & Values Card */}
                  <Card borderColor="brand.border" boxShadow="card" w="full">
                    <CardHeader pb={2}>
                      <Text fontWeight="semibold" fontSize="sm">Personality & Values</Text>
                    </CardHeader>
                    <CardBody pt={2}>
                      <VStack align="stretch" spacing={4}>
                        {/* Personality Type */}
                        <Box>
                          <Text fontSize="xs" color="brand.subtleText" mb={1}>Personality Type</Text>
                          {profileData.personalityType ? (
                            <HStack spacing={2}>
                              <Icon as={Brain} size={16} color="brand.primary" />
                              <Text fontWeight="medium">{profileData.personalityType}</Text>
                            </HStack>
                          ) : (
                            <Box>
                              <Text fontSize="sm" color="brand.subtleText" mb={1}>Find your type</Text>
                              <Button
                                as={Link}
                                href="https://www.16personalities.com/free-personality-test"
                                isExternal
                                size="xs"
                                variant="ghost"
                                color="brand.primary"
                                rightIcon={<ExternalLink size={12} />}
                                p={0}
                                h="auto"
                                _hover={{ textDecoration: 'underline' }}
                              >
                                Take the test
                              </Button>
                            </Box>
                          )}
                        </Box>

                        <Divider borderColor="brand.border" />

                        {/* Core Values */}
                        <Box>
                          <Text fontSize="xs" color="brand.subtleText" mb={2}>Core Values</Text>
                          {profileData.coreValues.length > 0 ? (
                            <HStack spacing={2} flexWrap="wrap">
                              {profileData.coreValues.map((value) => (
                                <Tag key={value} size="sm" colorScheme="yellow" borderRadius="full">
                                  {value}
                                </Tag>
                              ))}
                            </HStack>
                          ) : (
                            <Box>
                              <Text fontSize="sm" color="brand.subtleText" mb={1}>Discover your values</Text>
                              <Button
                                as={Link}
                                href="https://personalvalu.es/"
                                isExternal
                                size="xs"
                                variant="ghost"
                                color="brand.primary"
                                rightIcon={<ExternalLink size={12} />}
                                p={0}
                                h="auto"
                                _hover={{ textDecoration: 'underline' }}
                              >
                                Take the test
                              </Button>
                            </Box>
                          )}
                        </Box>

                        {/* Edit personality button when in edit mode */}
                        {isEditing && (
                          <>
                            <Divider borderColor="brand.border" />
                            <Box>
                              <Alert status="info" borderRadius="md" size="sm" bg="blue.50" border="1px solid" borderColor="blue.200">
                                <AlertIcon color="blue.500" />
                                <VStack align="start" spacing={1} flex={1}>
                                  <Text fontSize="xs" fontWeight="medium">Update your personality profile</Text>
                                  <HStack spacing={2}>
                                    <Checkbox
                                      size="sm"
                                      isChecked={Boolean(editedData.hasCompletedPersonalityTest)}
                                      onChange={(e) => {
                                        handleInputChange('hasCompletedPersonalityTest', e.target.checked)
                                        setPersonalityTestError(null)
                                      }}
                                    >
                                      <Text fontSize="xs">I completed the personality test</Text>
                                    </Checkbox>
                                  </HStack>
                                  <HStack spacing={2}>
                                    <Checkbox
                                      size="sm"
                                      isChecked={Boolean(editedData.hasCompletedValuesTest)}
                                      onChange={(e) => {
                                        handleInputChange('hasCompletedValuesTest', e.target.checked)
                                        setValuesTestError(null)
                                      }}
                                    >
                                      <Text fontSize="xs">I completed the values test</Text>
                                    </Checkbox>
                                  </HStack>
                                </VStack>
                              </Alert>
                              {editedData.hasCompletedPersonalityTest && (
                                <FormControl mt={3}>
                                  <FormLabel fontSize="xs">Select Type</FormLabel>
                                  <Select
                                    size="sm"
                                    value={editedData.personalityType || ''}
                                    onChange={(e) => handleInputChange('personalityType', e.target.value)}
                                  >
                                    <option value="">Select...</option>
                                    {personalityTypes.map((type) => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                              {editedData.hasCompletedValuesTest && (
                                <FormControl mt={3}>
                                  <FormLabel fontSize="xs">Select 5 Values</FormLabel>
                                  <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                                    {coreValueOptions.map((value) => {
                                      const selected = editedData.coreValues.includes(value)
                                      const disabled = !selected && editedData.coreValues.length >= 5
                                      return (
                                        <Box
                                          key={value}
                                          border="1px solid"
                                          borderColor={selected ? 'yellow.400' : 'brand.border'}
                                          bg={selected ? 'yellow.50' : 'white'}
                                          rounded="md"
                                          p={2}
                                          cursor={disabled ? 'not-allowed' : 'pointer'}
                                          opacity={disabled ? 0.5 : 1}
                                          onClick={() => !disabled && handleCoreValueToggle(value)}
                                          fontSize="xs"
                                        >
                                          {value}
                                        </Box>
                                      )
                                    })}
                                  </Grid>
                                  <Text fontSize="xs" color="brand.subtleText" mt={1}>
                                    {editedData.coreValues.length}/5 selected
                                  </Text>
                                </FormControl>
                              )}
                              {(personalityTestError || valuesTestError || personalityFormError) && (
                                <Text fontSize="xs" color="red.500" mt={2}>
                                  {personalityTestError || valuesTestError || personalityFormError}
                                </Text>
                              )}
                            </Box>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

                  {/* Badges & Achievements Card */}
                  <Card borderColor="brand.border" boxShadow="card" w="full">
                    <CardHeader pb={2}>
                      <Text fontWeight="semibold" fontSize="sm">Badges & Achievements</Text>
                    </CardHeader>
                    <CardBody pt={2}>
                      <BadgeDisplay />
                    </CardBody>
                  </Card>

                  {/* Organization Info Card (paid members only) */}
                  {isPaidMember && (
                    <Card borderColor="brand.border" boxShadow="card" w="full">
                      <CardHeader pb={2}>
                        <Text fontWeight="semibold" fontSize="sm">Organization</Text>
                      </CardHeader>
                      <CardBody pt={2}>
                        <VStack align="stretch" spacing={3}>
                          <Box>
                            <Text fontSize="xs" color="brand.subtleText">Company</Text>
                            <HStack spacing={2}>
                              <Icon as={Building} size={14} color="brand.subtleText" />
                              <Text fontSize="sm" fontWeight="medium">{profileData.companyName || 'Not assigned'}</Text>
                            </HStack>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="brand.subtleText">Company Code</Text>
                            <Tag size="sm" bg="gray.100" fontFamily="mono">{profileData.companyCode || 'N/A'}</Tag>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="brand.subtleText">Village</Text>
                            <HStack spacing={2}>
                              <Icon as={Users} size={14} color="brand.subtleText" />
                              <Text fontSize="sm">{profileData.villageName || 'Not assigned'}</Text>
                            </HStack>
                          </Box>
                          {profileData.clusterName && (
                            <Box>
                              <Text fontSize="xs" color="brand.subtleText">Cluster</Text>
                              <Text fontSize="sm">{profileData.clusterName}</Text>
                            </Box>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  )}

                  {/* Village Info Card (free members with a village) */}
                  {shouldShowVillageCard && (
                    <Card borderColor="brand.border" boxShadow="card" w="full">
                      <CardHeader pb={2}>
                        <Text fontWeight="semibold" fontSize="sm">Village Information</Text>
                      </CardHeader>
                      <CardBody pt={2}>
                        {villageLoading ? (
                          <HStack spacing={3}>
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="brand.subtleText">Loading village details...</Text>
                          </HStack>
                        ) : villageError ? (
                          <Alert status="error" borderRadius="md">
                            <AlertIcon />
                            <Text fontSize="sm">{villageError}</Text>
                          </Alert>
                        ) : (
                          <VStack align="stretch" spacing={4}>
                            <Box>
                              <Text fontSize="xs" color="brand.subtleText">Village</Text>
                              <HStack spacing={2}>
                                <Icon as={Users} size={14} color="brand.subtleText" />
                                <Text fontSize="sm" fontWeight="medium">{villageDetails?.name || 'Your village'}</Text>
                              </HStack>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="brand.subtleText">Members</Text>
                              <Text fontSize="sm">{villageDetails?.memberCount ?? 0}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="brand.subtleText">Role</Text>
                              <Text fontSize="sm">
                                {villageDetails?.creatorId && profile?.id === villageDetails.creatorId ? 'Founder' : 'Member'}
                              </Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="brand.subtleText">Joined</Text>
                              <HStack spacing={2}>
                                <Icon as={Calendar} size={14} color="brand.subtleText" />
                                <Text fontSize="sm">{formatVillageDate(villageDetails?.createdAt)}</Text>
                              </HStack>
                            </Box>
                            <HStack spacing={3} flexWrap="wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                leftIcon={<Icon as={Settings} />}
                                onClick={handleManageVillage}
                                isDisabled={!villageId}
                              >
                                Manage Village
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                leftIcon={<Icon as={UserPlus} />}
                                onClick={handleInviteVillage}
                                isDisabled={!villageId}
                              >
                                Invite Members
                              </Button>
                              <Button
                                size="sm"
                                colorScheme="red"
                                variant="outline"
                                leftIcon={<Icon as={LogOut} />}
                                onClick={() => setIsLeaveVillageOpen(true)}
                                isLoading={isLeavingVillage}
                              >
                                Leave Village
                              </Button>
                            </HStack>
                          </VStack>
                        )}
                      </CardBody>
                    </Card>
                  )}
                </VStack>
              </GridItem>
            </Grid>
          </TabPanel>

          <TabPanel px={0}>
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
              <GridItem>
                <VStack spacing={6}>
                  <Card borderColor="brand.border" boxShadow="card">
                    <CardHeader>
                      <Box>
                        <Text fontWeight="semibold" fontSize="lg">Account &amp; Security</Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          Manage your login details and account status in one place.
                        </Text>
                      </Box>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={6}>
                        <Box>
                          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4}>
                            <Box>
                              <Text fontWeight="semibold">Email</Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                Keep your contact email up to date.
                              </Text>
                            </Box>
                            <Button size="sm" variant="secondary" onClick={() => setEmailFormOpen((prev) => !prev)}>
                              {emailFormOpen ? 'Close' : 'Change Email'}
                            </Button>
                          </Flex>
                          {!emailFormOpen ? (
                            <HStack spacing={2} color="brand.text" mt={3}>
                              <Icon as={MailIcon} />
                              <Text>{profileData.email}</Text>
                            </HStack>
                          ) : (
                            <VStack align="stretch" spacing={4} as="form" onSubmit={handleChangeEmail} mt={4}>
                              <FormControl>
                                <FormLabel>Current Email</FormLabel>
                                <Box bg="brand.primaryMuted" p={3} rounded="lg" display="flex" alignItems="center" gap={2}>
                                  <Icon as={MailIcon} color="brand.primary" />
                                  <Text>{profileData.email}</Text>
                                </Box>
                              </FormControl>
                              <FormControl isRequired>
                                <FormLabel>New Email Address</FormLabel>
                                <Input
                                  type="email"
                                  value={emailForm.newEmail}
                                  onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                                />
                              </FormControl>
                              <FormControl isRequired>
                                <FormLabel>Current Password</FormLabel>
                                <Input
                                  type="password"
                                  value={emailForm.password}
                                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                                />
                              </FormControl>
                              {emailMessage && (
                                <Box
                                  bg={emailMessage.type === 'success' ? 'green.50' : 'red.50'}
                                  border="1px solid"
                                  borderColor={emailMessage.type === 'success' ? 'green.100' : 'red.100'}
                                  p={3}
                                  rounded="md"
                                >
                                  <HStack spacing={2} color={emailMessage.type === 'success' ? 'green.600' : 'red.600'}>
                                    <Icon as={emailMessage.type === 'success' ? Check : AlertCircle} />
                                    <Text>{emailMessage.text}</Text>
                                  </HStack>
                                </Box>
                              )}
                              <HStack spacing={2}>
                                <Button variant="ghost" onClick={() => setEmailFormOpen(false)}>
                                  Cancel
                                </Button>
                                <Button type="submit">Update Email</Button>
                              </HStack>
                            </VStack>
                          )}
                        </Box>

                        <Divider borderColor="brand.border" />

                        <Box>
                          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4}>
                            <Box>
                              <Text fontWeight="semibold">Password</Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                Update your password regularly for better security.
                              </Text>
                            </Box>
                            <Button size="sm" variant="secondary" onClick={() => setPasswordFormOpen((prev) => !prev)}>
                              {passwordFormOpen ? 'Close' : 'Change Password'}
                            </Button>
                          </Flex>
                          {!passwordFormOpen ? (
                            <HStack spacing={2} color="brand.text" mt={3}>
                              <Icon as={Key} />
                              <Text>••••••••</Text>
                            </HStack>
                          ) : (
                            <VStack align="stretch" spacing={4} as="form" onSubmit={handleChangePassword} mt={4}>
                              <FormControl isRequired>
                                <FormLabel>Current Password</FormLabel>
                                <Input
                                  type="password"
                                  value={passwordForm.currentPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                />
                              </FormControl>
                              <FormControl isRequired>
                                <FormLabel>New Password</FormLabel>
                                <Input
                                  type="password"
                                  value={passwordForm.newPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                />
                                <FormHelperText>Password must be at least 8 characters</FormHelperText>
                              </FormControl>
                              <FormControl isRequired>
                                <FormLabel>Confirm New Password</FormLabel>
                                <Input
                                  type="password"
                                  value={passwordForm.confirmPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                />
                              </FormControl>
                              {passwordMessage && (
                                <Box
                                  bg={passwordMessage.type === 'success' ? 'green.50' : 'red.50'}
                                  border="1px solid"
                                  borderColor={passwordMessage.type === 'success' ? 'green.100' : 'red.100'}
                                  p={3}
                                  rounded="md"
                                >
                                  <HStack spacing={2} color={passwordMessage.type === 'success' ? 'green.600' : 'red.600'}>
                                    <Icon as={passwordMessage.type === 'success' ? Check : AlertCircle} />
                                    <Text>{passwordMessage.text}</Text>
                                  </HStack>
                                </Box>
                              )}
                              <HStack spacing={2}>
                                <Button variant="ghost" onClick={() => setPasswordFormOpen(false)}>
                                  Cancel
                                </Button>
                                <Button type="submit">Update Password</Button>
                              </HStack>
                            </VStack>
                          )}
                        </Box>

                        <Divider borderColor="brand.border" />

                        <Box>
                          <Text fontWeight="semibold">Account Security</Text>
                          <Text fontSize="sm" color="brand.subtleText" mt={1}>
                            For support, you can share your account ID if requested.
                          </Text>
                          <HStack spacing={3} mt={3} align="center">
                            <Icon as={Shield} color="brand.subtleText" />
                            <Box>
                              <Text fontWeight="medium">Account Status</Text>
                              <Badge colorScheme={statusColorMap[profileData.accountStatus] || 'gray'}>
                                {profileData.accountStatus === 'active' ? 'Active' : profileData.accountStatus === 'inactive' ? 'Inactive' : 'Pending'}
                              </Badge>
                            </Box>
                          </HStack>
                          <HStack spacing={3} mt={4} align="center">
                            <Text fontSize="sm" color="brand.subtleText">
                              Account ID (support only)
                            </Text>
                            <Button variant="link" size="sm" color="brand.primary" onClick={handleCopyAccountId}>
                              Copy ID
                            </Button>
                          </HStack>
                        </Box>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border" boxShadow="card">
                    <CardHeader>
                      <Text fontWeight="semibold" fontSize="lg">Preferences</Text>
                      <Text fontSize="sm" color="brand.subtleText" mt={1}>
                        Manage peer matching and leaderboard visibility in one place.
                      </Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={6}>
                        <Box>
                          <Text fontWeight="semibold">Peer Matching</Text>
                          <Text fontSize="sm" color="brand.subtleText" mt={1}>
                            Control how often you receive a new peer match and how we notify you.
                          </Text>
                        </Box>

                        <FormControl display="flex" alignItems="center" justifyContent="space-between">
                          <Box>
                            <FormLabel mb={1}>Automatic matching</FormLabel>
                            <Text fontSize="sm" color="brand.subtleText">
                              Disable if you only want to request matches manually.
                            </Text>
                          </Box>
                          <Switch
                            isChecked={editedData.matchRefreshPreference !== 'disabled'}
                            onChange={(event) =>
                              handleInputChange(
                                'matchRefreshPreference',
                                event.target.checked ? 'weekly' : 'disabled'
                              )
                            }
                          />
                        </FormControl>

                        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                          <FormControl>
                            <HStack justify="space-between" align="center">
                              <FormLabel mb={0}>Refresh frequency</FormLabel>
                              <Select
                                maxW="200px"
                                value={editedData.matchRefreshPreference || 'weekly'}
                                onChange={(event) =>
                                  handleInputChange('matchRefreshPreference', event.target.value as ProfileData['matchRefreshPreference'])
                                }
                              >
                                {matchRefreshOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </HStack>
                          </FormControl>

                          <FormControl isDisabled={!['weekly', 'biweekly'].includes(editedData.matchRefreshPreference || '')}>
                            <HStack justify="space-between" align="center">
                              <FormLabel mb={0}>Preferred match day</FormLabel>
                              <Select
                                maxW="200px"
                                value={editedData.preferredMatchDay ?? 1}
                                onChange={(event) => handleInputChange('preferredMatchDay', Number(event.target.value))}
                              >
                                {weekdayOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </HStack>
                          </FormControl>
                        </Grid>

                        <Button
                          variant="ghost"
                          size="sm"
                          alignSelf="flex-start"
                          onClick={() => setShowAdvancedMatching((prev) => !prev)}
                        >
                          {showAdvancedMatching ? 'Hide advanced settings' : 'Advanced settings'}
                        </Button>

                        <Collapse in={showAdvancedMatching} animateOpacity>
                          <VStack align="stretch" spacing={4}>
                            <FormControl>
                              <HStack justify="space-between" align="center">
                                <FormLabel mb={0}>Notification preference</FormLabel>
                                <Select
                                  maxW="220px"
                                  value={editedData.matchNotificationPreference || 'both'}
                                  onChange={(event) =>
                                    handleInputChange('matchNotificationPreference', event.target.value as ProfileData['matchNotificationPreference'])
                                  }
                                >
                                  {matchNotificationOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </Select>
                              </HStack>
                            </FormControl>

                            <FormControl>
                              <HStack justify="space-between" align="center">
                                <FormLabel mb={0}>Match timezone</FormLabel>
                                <Select
                                  maxW="220px"
                                  value={editedData.timezone || ''}
                                  onChange={(event) => handleInputChange('timezone', event.target.value)}
                                >
                                  {timezoneOptions.map((zone) => (
                                    <option key={zone} value={zone}>
                                      {zone}
                                    </option>
                                  ))}
                                </Select>
                              </HStack>
                              <FormHelperText>
                                Match timing is calculated using this timezone.
                              </FormHelperText>
                            </FormControl>
                          </VStack>
                        </Collapse>

                        {matchPreferencesMessage && (
                          <Box
                            bg={matchPreferencesMessage.type === 'success' ? 'green.50' : 'red.50'}
                            border="1px solid"
                            borderColor={matchPreferencesMessage.type === 'success' ? 'green.100' : 'red.100'}
                            p={3}
                            rounded="md"
                          >
                            <HStack spacing={2} color={matchPreferencesMessage.type === 'success' ? 'green.600' : 'red.600'}>
                              <Icon as={matchPreferencesMessage.type === 'success' ? Check : AlertCircle} />
                              <Text>{matchPreferencesMessage.text}</Text>
                            </HStack>
                          </Box>
                        )}

                        <Divider borderColor="brand.border" />

                        <Box>
                          <Text fontWeight="semibold">Leaderboard Privacy</Text>
                          <Text fontSize="sm" color="brand.subtleText" mt={1}>
                            Decide who can view your ranking and recent activity on leaderboards.
                          </Text>
                        </Box>

                        <RadioGroup
                          value={editedData.leaderboardVisibility}
                          onChange={(value) => handleInputChange('leaderboardVisibility', value as ProfileData['leaderboardVisibility'])}
                        >
                          <VStack align="stretch" spacing={4}>
                            {[
                              {
                                value: 'public',
                                title: 'Public',
                                description: 'Visible on company and village leaderboards across the community.',
                              },
                              {
                                value: 'company',
                                title: 'Company Only',
                                description: 'Only teammates and cohort members can see your ranking and activity.',
                              },
                              {
                                value: 'private',
                                title: 'Hidden',
                                description: 'Keep your ranking private while you continue to earn points.',
                              },
                            ].map((option) => (
                              <Box
                                key={option.value}
                                border="1px solid"
                                borderColor={editedData.leaderboardVisibility === option.value ? 'brand.primary' : 'brand.border'}
                                bg={editedData.leaderboardVisibility === option.value ? 'purple.50' : 'white'}
                                rounded="lg"
                                p={5}
                              >
                                <Radio value={option.value} colorScheme="purple">
                                  <Text fontWeight="semibold">{option.title}</Text>
                                  <Text fontSize="sm" color="brand.subtleText" mt={1}>
                                    {option.description}
                                  </Text>
                                </Radio>
                              </Box>
                            ))}
                          </VStack>
                        </RadioGroup>

                        {visibilityMessage && (
                          <Box
                            bg={visibilityMessage.type === 'success' ? 'green.50' : 'red.50'}
                            border="1px solid"
                            borderColor={visibilityMessage.type === 'success' ? 'green.100' : 'red.100'}
                            p={3}
                            rounded="md"
                          >
                            <HStack spacing={2} color={visibilityMessage.type === 'success' ? 'green.600' : 'red.600'}>
                              <Icon as={visibilityMessage.type === 'success' ? Check : AlertCircle} />
                              <Text>{visibilityMessage.text}</Text>
                            </HStack>
                          </Box>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                </VStack>
              </GridItem>

              <GridItem>
                <VStack spacing={6}>
                  <Card borderColor="brand.border" boxShadow="card">
                    <CardHeader>
                      <Text fontWeight="semibold" fontSize="lg">Organization</Text>
                      <Text fontSize="sm" color="brand.subtleText" mt={1}>
                        Company code and affiliation status.
                      </Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={4}>
                        <Box>
                          <Text fontSize="sm" color="brand.subtleText">
                            Current affiliation
                          </Text>
                          <Text fontWeight="semibold">{profileData.companyName || 'Not assigned'}</Text>
                          <Text fontSize="sm" color="brand.subtleText">
                            Code: {profileData.companyCode || 'N/A'}
                          </Text>
                        </Box>
                        <FormControl>
                          <FormLabel>Company Code</FormLabel>
                          <HStack align="center">
                            <Input
                              maxW="200px"
                              value={companyCode}
                              onChange={(event) => {
                                setCompanyCode(event.target.value.toUpperCase().slice(0, 6))
                                setOrganizationMessage(null)
                              }}
                              placeholder="6-character code"
                            />
                            <Button
                              colorScheme="purple"
                              onClick={handleCompanyCodeSave}
                              isLoading={companyCodeSaving}
                              loadingText="Connecting"
                              isDisabled={
                                companyCodeChecking
                                || companyCodeSaving
                                || companyCodeValid === false
                                || isAlreadyConnected
                                || normalizedCompanyCode.length !== 6
                              }
                            >
                              Connect to Organization
                            </Button>
                          </HStack>
                          <FormHelperText>
                            Enter your organization code to unlock paid member features.
                          </FormHelperText>
                        </FormControl>
                        {isAlreadyConnected && (
                          <Box bg="blue.50" border="1px solid" borderColor="blue.100" p={3} rounded="md">
                            <HStack spacing={2} color="blue.700">
                              <Icon as={CheckCircle} />
                              <Text fontSize="sm">
                                You're already connected to {profileData.companyName || 'this organization'}.
                              </Text>
                            </HStack>
                          </Box>
                        )}
                        {profileData.membershipStatus === 'free' && (
                          <Box bg="purple.50" border="1px solid" borderColor="purple.100" p={3} rounded="md">
                            <Text fontSize="sm" fontWeight="semibold" color="purple.700">
                              Connecting this code upgrades you to paid.
                            </Text>
                            <Text fontSize="sm" color="brand.subtleText" mt={1}>
                              Unlock organization dashboards, peer matching enhancements, and full course access.
                            </Text>
                          </Box>
                        )}
                        {companyCodeValid && companyOrganization && !companyCodeChecking && (
                          <VStack align="stretch" spacing={2} bg="green.50" border="1px solid" borderColor="green.100" p={3} rounded="md">
                            <HStack spacing={2} color="green.600">
                              <Icon as={CheckCircle} />
                              <Text fontSize="sm">Valid company code ({companyOrganization.name})</Text>
                            </HStack>
                            <HStack spacing={3} fontSize="sm" color="green.700">
                              <Text>Members: {companyOrganization.memberCount ?? 0}</Text>
                              <Text>Upgrade path: Free → Paid</Text>
                            </HStack>
                          </VStack>
                        )}
                        {companyCodeValid === false && !companyCodeChecking && (
                          <Box bg="red.50" border="1px solid" borderColor="red.100" p={3} rounded="md">
                            <HStack spacing={2} color="red.600">
                              <Icon as={XCircle} />
                              <Text fontSize="sm">{companyCodeError || 'Invalid or inactive company code'}</Text>
                            </HStack>
                          </Box>
                        )}
                        {companyCodeChecking && (
                          <Text fontSize="sm" color="brand.subtleText">
                            Checking company code...
                          </Text>
                        )}
                        {companyCodeSaving && (
                          <Text fontSize="sm" color="brand.subtleText">
                            Connecting to organization...
                          </Text>
                        )}
                        {organizationMessage && (
                          <Box
                            bg={organizationMessage.type === 'success' ? 'green.50' : 'red.50'}
                            border="1px solid"
                            borderColor={organizationMessage.type === 'success' ? 'green.100' : 'red.100'}
                            p={3}
                            rounded="md"
                          >
                            <HStack spacing={2} color={organizationMessage.type === 'success' ? 'green.600' : 'red.600'}>
                              <Icon as={organizationMessage.type === 'success' ? CheckCircle : AlertCircle} />
                              <Text fontSize="sm">{organizationMessage.text}</Text>
                            </HStack>
                          </Box>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                </VStack>
              </GridItem>
            </Grid>

            {hasAccountSettingsChanges && (
              <Box position="sticky" bottom={0} bg="white" pt={4} pb={2} borderTop="1px solid" borderColor="brand.border" mt={6} zIndex={1}>
                <Flex justify="flex-end">
                  <Button
                    onClick={handleSaveAccountSettings}
                    isLoading={accountSettingsSaving || matchPreferencesSaving || visibilitySaving}
                    loadingText="Saving..."
                  >
                    Save Changes
                  </Button>
                </Flex>
              </Box>
            )}
          </TabPanel>

          <TabPanel px={0}>
            <Box maxW="700px" mx="auto">
              <HStack spacing={2} fontSize="sm" color="brand.subtleText" mb={4}>
                <Button variant="link" size="sm" onClick={() => navigate('/app/leaderboard')}>
                  Dashboard
                </Button>
                <Text>/</Text>
                <Text color="brand.text">Membership</Text>
              </HStack>
            </Box>

            <VStack spacing={6} align="stretch" maxW="700px" mx="auto">
              <Card borderColor="brand.border" boxShadow="card">
                <CardBody>
                  <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4}>
                    <Box>
                      <Text fontWeight="bold" fontSize="lg">{membershipCopy[profileData.membershipStatus].title}</Text>
                      <Text color="brand.subtleText" fontSize="sm">
                        {membershipCopy[profileData.membershipStatus].description}
                      </Text>
                    </Box>
                  </Flex>
                </CardBody>
              </Card>

              <Card borderColor="brand.border" boxShadow="card">
                <CardHeader>
                  <Text fontWeight="semibold" fontSize="lg">Feature Comparison</Text>
                </CardHeader>
                <CardBody>
                  <Grid templateColumns={{ base: '2fr 1fr 1fr' }} gap={3} fontWeight="semibold" mb={2}>
                    <Text>Feature</Text>
                    <Text textAlign="center">Free</Text>
                    <Text textAlign="center" bg="purple.50" color="brand.text" rounded="md" py={1}>
                      Paid
                    </Text>
                  </Grid>
                  {[{
                    label: 'Orientation Content',
                    free: true,
                    paid: true,
                  },
                  { label: 'Points Tracking', free: true, paid: true },
                  { label: 'Weekly Activities', free: false, paid: true },
                  { label: 'Learning Clusters', free: false, paid: true },
                  { label: 'Transformation Partner', free: false, paid: true },
                  { label: 'Live Sessions', free: false, paid: true },
                  { label: 'Certification', free: false, paid: true }].map((row) => (
                    <Grid templateColumns={{ base: '2fr 1fr 1fr' }} gap={3} alignItems="center" py={2} key={row.label} borderBottom="1px solid" borderColor="brand.border">
                      <Text fontWeight="medium">{row.label}</Text>
                      <Center>
                        <Icon as={Check} color={row.free ? 'green.500' : 'gray.300'} />
                      </Center>
                      <Center bg="purple.50" rounded="md" py={2}>
                        <Icon as={Check} color={row.paid ? 'green.500' : 'gray.300'} />
                      </Center>
                    </Grid>
                  ))}
                  {profileData.membershipStatus === 'free' && (
                    <Center mt={4}>
                      <Button leftIcon={<Lock size={16} />} onClick={handleUpgrade}>
                        Upgrade to Full Access
                      </Button>
                    </Center>
                  )}
                </CardBody>
              </Card>

              {profileData.membershipStatus === 'paid' ? (
                <PaymentHistory hasRecords />
              ) : (
                <PaymentHistory hasRecords={false} />
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <AlertDialog
        isOpen={isLeaveVillageOpen}
        leastDestructiveRef={cancelLeaveRef}
        onClose={() => setIsLeaveVillageOpen(false)}
      >
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Leave your village?</AlertDialogHeader>
          <AlertDialogBody>
            Leaving the village will remove your affiliation and related access. You can join another village later.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelLeaveRef} onClick={() => setIsLeaveVillageOpen(false)} variant="ghost">
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleLeaveVillage} ml={3} isLoading={isLeavingVillage}>
              Leave Village
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  )
}
