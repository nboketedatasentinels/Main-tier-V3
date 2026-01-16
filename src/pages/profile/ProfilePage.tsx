import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Center,
  chakra,
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
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Link,
  Progress,
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
  Award,
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
  Heart,
  Key,
  Linkedin,
  Loader2,
  Lock,
  LogOut,
  Mail as MailIcon,
  Save,
  Settings,
  Shield,
  RefreshCcw,
  TrendingUp,
  Twitter,
  Upload,
  User,
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
  signOut as firebaseSignOut,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { StandardRole, Organization } from '@/types'
import { TransformationTier } from '@/types'
import { normalizeRole } from '@/utils/role'
import { validateCompanyCode } from '@/services/organizationService'
import { CORE_VALUES } from '@/config/personality-data'

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
  socialLinks: {
    linkedin?: string
    twitter?: string
    github?: string
  }
  leaderboardVisibility: 'public' | 'company' | 'private'
  registrationDate?: string
  companyName?: string
  companyCode?: string
  villageName?: string
  clusterName?: string
}

interface BadgeRecord {
  id: string
  title: string
  description?: string
  criteria?: string
  type?: string
  earned: boolean
  earnedAt?: string
  progressPercentage?: number
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

const roleColorMap: Record<StandardRole, string> = {
  user: 'gray',
  free_user: 'gray',
  paid_member: 'green',
  mentor: 'purple',
  ambassador: 'blue',
  partner: 'red',
  super_admin: 'red',
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

const formatDate = (value?: string) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

const AvatarInitials: React.FC<{ name: string }> = ({ name }) => {
  const initials = useMemo(() => name.slice(0, 2).toUpperCase(), [name])
  return (
    <Center
      w="64px"
      h="64px"
      rounded="full"
      bg="brand.primary"
      color="white"
      fontWeight="bold"
      fontSize="xl"
    >
      {initials}
    </Center>
  )
}

const PaymentHistory: React.FC = () => {
  return (
    <Card mt={6} borderColor="brand.border">
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
  const { user, profile } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [editedData, setEditedData] = useState<ProfileData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [badges, setBadges] = useState<BadgeRecord[]>([])
  const [badgesLoading, setBadgesLoading] = useState(true)
  const [badgesError, setBadgesError] = useState<string | null>(null)
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

  const loadUserBadges = useCallback(async () => {
    if (!user) {
      setBadgesLoading(false)
      return
    }
    setBadgesLoading(true)
    setBadgesError(null)
    try {
      const badgeDefsSnap = await getDocs(collection(db, 'badges'))
      type BadgeDefinition = {
        id: string
        title?: string
        name?: string
        description?: string
        criteria?: string
        type?: string
      }

      const badgeDefs: BadgeDefinition[] = badgeDefsSnap.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Record<string, unknown>),
      }))

      const userBadgesSnap = await getDocs(query(collection(db, 'user_badges'), where('userId', '==', user.uid)))
      type UserBadgePayload = { badgeId?: string; earnedAt?: string; progressPercentage?: number }

      const userBadgeMap = new Map(
        userBadgesSnap.docs.map((docItem) => {
          const payload = docItem.data() as UserBadgePayload
          return [payload.badgeId, { ...payload, id: docItem.id }]
        }),
      )

      const combined: BadgeRecord[] = badgeDefs.map((def) => {
        const userBadge = userBadgeMap.get(def.id)
        const earned = Boolean(userBadge?.earnedAt)
        return {
          id: def.id,
          title: def.title || def.name || 'Achievement',
          description: def.description,
          criteria: def.criteria,
          type: def.type,
          earned,
          earnedAt: userBadge?.earnedAt,
          progressPercentage: userBadge?.progressPercentage || 0,
        }
      })

      combined.sort((a, b) => {
        if (a.earned && !b.earned) return -1
        if (!a.earned && b.earned) return 1
        return (b.earnedAt || '').localeCompare(a.earnedAt || '')
      })

      setBadges(combined)
    } catch (err) {
      console.error(err)
      setBadgesError('Unable to load badges right now.')
    } finally {
      setBadgesLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchUserProfile()
  }, [fetchUserProfile])

  useEffect(() => {
    loadUserBadges()
  }, [loadUserBadges])

  useEffect(() => {
    setCompanyCode(profileData?.companyCode || '')
  }, [profileData?.companyCode])

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

  const handleInputChange = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
    if (!editedData) return
    setEditedData({ ...editedData, [field]: value })
  }

  const handleSocialLinkChange = (platform: keyof ProfileData['socialLinks'], value: string) => {
    if (!editedData) return
    setEditedData({ ...editedData, socialLinks: { ...editedData.socialLinks, [platform]: value } })
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
    if (!file) return
    setProfilePictureFile(file)
    setPreviewUrl(URL.createObjectURL(file))
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
    setPreviewUrl(null)
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
    const updates = {
      companyCode: trimmedCode,
      companyId: companyOrganization?.id ?? null,
      companyName: companyOrganization?.name ?? null,
      updatedAt: serverTimestamp(),
    }

    try {
      await Promise.all([
        updateDoc(doc(db, 'profiles', user.uid), updates),
        updateDoc(doc(db, 'users', user.uid), {
          ...updates,
          transformationTier: companyOrganization
            ? TransformationTier.CORPORATE_MEMBER
            : TransformationTier.INDIVIDUAL_FREE,
        }),
      ])

      const updatedProfile = {
        ...profileData,
        companyCode: trimmedCode,
        companyName: companyOrganization?.name ?? profileData.companyName,
      }
      setProfileData(updatedProfile)
      setEditedData(updatedProfile)

      toast({
        title: 'Company code updated',
        description: companyOrganization?.name
          ? `Connected to ${companyOrganization.name}.`
          : 'Company code saved successfully.',
        status: 'success',
        duration: 4000,
      })
    } catch (err) {
      console.error(err)
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

  const handleSignOut = async () => {
    await firebaseSignOut(auth)
    navigate('/login')
  }

  const handleUpgrade = () => {
    navigate('/upgrade')
  }

  const badgeBackground = (earned: boolean) => (earned ? 'green.50' : 'gray.50')

  const headerActions = profileData?.membershipStatus === 'free'

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
    <Box>
      <Box position="sticky" top={0} zIndex={50} bg="white" boxShadow="sm" px={6} py={4} mb={6} borderBottom="1px solid" borderColor="brand.border">
        <Flex justify="space-between" align="center">
          <HStack spacing={3}>
            <Center w="40px" h="40px" bg="brand.primaryMuted" rounded="lg" fontWeight="bold" color="brand.primary">
              MP
            </Center>
            <Text fontWeight="bold" fontSize="lg">
              Member Portal
            </Text>
          </HStack>
          <HStack spacing={3}>
            {headerActions && (
              <Button leftIcon={<Lock size={18} />} variant="secondary" onClick={handleUpgrade}>
                Upgrade
              </Button>
            )}
            <Button variant="ghost" leftIcon={<LogOut size={18} />} onClick={handleSignOut}>
              Sign Out
            </Button>
          </HStack>
        </Flex>
      </Box>

      <Card mb={8} borderColor="brand.border" bg="linear-gradient(135deg, #eef0fb, #ffffff)">
        <CardBody>
          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4}>
            <HStack spacing={4} align="center">
              {editedData.profilePictureUrl ? (
                <Avatar src={editedData.profilePictureUrl} name={editedData.fullName} size="lg" />
              ) : (
                <AvatarInitials name={editedData.fullName} />
              )}
              <Box>
                <Text fontWeight="bold" fontSize="2xl">
                  {profileData.fullName}
                </Text>
                <HStack spacing={3} mt={2} flexWrap="wrap">
                  <Badge colorScheme={roleColorMap[profileData.role] || 'gray'}>{roleDisplayMap[profileData.role]}</Badge>
                  <Badge colorScheme={statusColorMap[profileData.accountStatus] || 'gray'}>{profileData.accountStatus === 'active' ? 'Active' : profileData.accountStatus === 'inactive' ? 'Inactive' : 'Pending'}</Badge>
                  <Badge colorScheme={profileData.membershipStatus === 'paid' ? 'yellow' : 'gray'}>
                    {profileData.membershipStatus === 'paid' ? 'Paid Member' : 'Free Account'}
                  </Badge>
                </HStack>
              </Box>
            </HStack>
            <HStack spacing={3}>
              {headerActions && (
                <Button leftIcon={<Lock size={18} />} onClick={handleUpgrade}>
                  Upgrade
                </Button>
              )}
              <Button variant="secondary" leftIcon={<LogOut size={18} />} onClick={handleSignOut}>
                Sign Out
              </Button>
            </HStack>
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
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
              <GridItem>
                <Card borderColor="brand.border">
                  <CardHeader>
                    <Flex justify="space-between" align="center">
                      <Text fontWeight="semibold" fontSize="lg">
                        Personal Information
                      </Text>
                      {!isEditing ? (
                        <Button size="sm" leftIcon={<Edit size={16} />} variant="secondary" onClick={() => setIsEditing(true)}>
                          Edit
                        </Button>
                      ) : (
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
                  <CardBody>
                    <VStack align="stretch" spacing={6}>
                      <FormControl>
                        <FormLabel>Full Name</FormLabel>
                        {!isEditing ? (
                          <HStack spacing={2} color="brand.text">
                            <Icon as={User} />
                            <Text>{profileData.fullName}</Text>
                          </HStack>
                        ) : (
                          <Input value={editedData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} />
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Profile Picture</FormLabel>
                        {!isEditing ? (
                          <HStack spacing={3}>
                            {profileData.profilePictureUrl ? (
                              <Avatar src={profileData.profilePictureUrl} size="sm" />
                            ) : (
                              <AvatarInitials name={profileData.fullName} />
                            )}
                            <Text color="brand.subtleText">Used across your profile</Text>
                          </HStack>
                        ) : (
                          <HStack spacing={3} align="center">
                            {previewUrl || editedData.profilePictureUrl ? (
                              <Image
                                src={previewUrl || editedData.profilePictureUrl}
                                alt="Profile preview"
                                boxSize="96px"
                                objectFit="cover"
                                rounded="full"
                                border="1px solid"
                                borderColor="brand.border"
                              />
                            ) : (
                              <AvatarInitials name={profileData.fullName} />
                            )}
                            <Button as="label" leftIcon={<Upload size={16} />} variant="secondary">
                              Upload
                              <Input type="file" accept="image/*" display="none" onChange={handleProfilePictureChange} />
                            </Button>
                          </HStack>
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Email Address</FormLabel>
                        {!isEditing ? (
                          <HStack spacing={2} color="brand.text">
                            <Icon as={MailIcon} />
                            <Text>{profileData.email}</Text>
                          </HStack>
                        ) : (
                          <Input type="email" value={editedData.email} onChange={(e) => handleInputChange('email', e.target.value)} />
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Personality Type</FormLabel>
                        {isEditing && (
                          <Alert status="info" borderRadius="lg" mb={3} bg="blue.50" border="1px solid" borderColor="blue.200">
                            <HStack align="start" spacing={3}>
                              <AlertIcon color="blue.500" mt={1} />
                              <VStack align="start" spacing={2}>
                                <Text fontWeight="semibold" color="blue.800">
                                  Required: Take the test first
                                </Text>
                                <Button
                                  as={Link}
                                  href="https://www.16personalities.com/free-personality-test"
                                  isExternal
                                  variant="outline"
                                  colorScheme="blue"
                                  rightIcon={<Icon as={ExternalLink} />}
                                  size="sm"
                                >
                                  Take the 16 Personalities test
                                </Button>
                                <Checkbox
                                  isChecked={Boolean(editedData.hasCompletedPersonalityTest)}
                                  onChange={(e) => {
                                    handleInputChange('hasCompletedPersonalityTest', e.target.checked)
                                    setPersonalityTestError(null)
                                  }}
                                >
                                  I have completed the 16 Personalities test
                                </Checkbox>
                                {personalityTestError && (
                                  <Text fontSize="sm" color="red.500">
                                    {personalityTestError}
                                  </Text>
                                )}
                              </VStack>
                            </HStack>
                          </Alert>
                        )}
                        {!isEditing ? (
                          <HStack spacing={2} color="brand.text">
                            <Icon as={Brain} />
                            <Text>{profileData.personalityType || 'Not set'}</Text>
                          </HStack>
                        ) : (
                          <Tooltip
                            label="Complete the 16 Personalities test to unlock this field."
                            isDisabled={Boolean(editedData.hasCompletedPersonalityTest)}
                            hasArrow
                          >
                            <Box opacity={editedData.hasCompletedPersonalityTest ? 1 : 0.6}>
                              <chakra.select
                                value={editedData.personalityType || ''}
                                onChange={(e) => {
                                  handleInputChange('personalityType', e.target.value)
                                  setPersonalityFormError(null)
                                }}
                                className="chakra-select"
                                style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e6e8f3' }}
                                disabled={!editedData.hasCompletedPersonalityTest}
                              >
                                <option value="">Select personality type</option>
                                {personalityTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </chakra.select>
                            </Box>
                          </Tooltip>
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Core Values (select exactly 5)</FormLabel>
                        {isEditing && (
                          <Alert status="info" borderRadius="lg" mb={3} bg="blue.50" border="1px solid" borderColor="blue.200">
                            <HStack align="start" spacing={3}>
                              <AlertIcon color="blue.500" mt={1} />
                              <VStack align="start" spacing={2}>
                                <Text fontWeight="semibold" color="blue.800">
                                  Required: Take the test first
                                </Text>
                                <Button
                                  as={Link}
                                  href="https://personalvalu.es/"
                                  isExternal
                                  variant="outline"
                                  colorScheme="blue"
                                  rightIcon={<Icon as={ExternalLink} />}
                                  size="sm"
                                >
                                  Take the Personal Values test
                                </Button>
                                <Checkbox
                                  isChecked={Boolean(editedData.hasCompletedValuesTest)}
                                  onChange={(e) => {
                                    handleInputChange('hasCompletedValuesTest', e.target.checked)
                                    setValuesTestError(null)
                                  }}
                                >
                                  I have completed the Personal Values test
                                </Checkbox>
                                {valuesTestError && (
                                  <Text fontSize="sm" color="red.500">
                                    {valuesTestError}
                                  </Text>
                                )}
                              </VStack>
                            </HStack>
                          </Alert>
                        )}
                        {!isEditing ? (
                          <HStack spacing={2} flexWrap="wrap">
                            {profileData.coreValues.length === 0 ? (
                              <Text color="brand.subtleText">No core values selected</Text>
                            ) : (
                              profileData.coreValues.map((value) => (
                                <Tag key={value} colorScheme="yellow" borderRadius="full" px={3} py={1}>
                                  <HStack spacing={1}>
                                    <Icon as={Award} size={14} />
                                    <Text>{value}</Text>
                                  </HStack>
                                </Tag>
                              ))
                            )}
                          </HStack>
                        ) : (
                          <Tooltip
                            label="Complete the Personal Values test to unlock this section."
                            isDisabled={Boolean(editedData.hasCompletedValuesTest)}
                            hasArrow
                          >
                            <Box opacity={editedData.hasCompletedValuesTest ? 1 : 0.6}>
                              <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
                                {coreValueOptions.map((value) => {
                                  const selected = editedData.coreValues.includes(value)
                                  const disabled =
                                    !editedData.hasCompletedValuesTest ||
                                    (!selected && editedData.coreValues.length >= 5)
                                  return (
                                    <Box
                                      key={value}
                                      border="1px solid"
                                      borderColor={selected ? 'yellow.400' : 'brand.border'}
                                      bg={selected ? 'yellow.50' : 'white'}
                                      rounded="lg"
                                      p={3}
                                      cursor={disabled ? 'not-allowed' : 'pointer'}
                                      opacity={disabled ? 0.5 : 1}
                                      onClick={() => !disabled && handleCoreValueToggle(value)}
                                    >
                                      <HStack spacing={2}>
                                        <Icon as={Heart} color={selected ? 'yellow.500' : 'brand.subtleText'} />
                                        <Text fontWeight="medium">{value}</Text>
                                      </HStack>
                                    </Box>
                                  )
                                })}
                              </Grid>
                              <Text fontSize="xs" color="brand.subtleText" textAlign="right" mt={2}>
                                {editedData.coreValues.length}/5 values selected
                              </Text>
                            </Box>
                          </Tooltip>
                        )}
                        {personalityFormError && (
                          <Text fontSize="sm" color="red.500" mt={2}>
                            {personalityFormError}
                          </Text>
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Bio</FormLabel>
                        {!isEditing ? (
                          <Text whiteSpace="pre-wrap" color="brand.text">
                            {profileData.bio || 'No bio provided'}
                          </Text>
                        ) : (
                          <Textarea value={editedData.bio} rows={3} onChange={(e) => handleInputChange('bio', e.target.value)} placeholder="No bio provided" />
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Social Links</FormLabel>
                        {!isEditing ? (
                          <VStack align="flex-start" spacing={2}>
                            {editedData.socialLinks.linkedin || editedData.socialLinks.twitter || editedData.socialLinks.github ? (
                              <>
                                {editedData.socialLinks.linkedin && (
                                  <Link href={editedData.socialLinks.linkedin} isExternal color="brand.primary">
                                    LinkedIn
                                  </Link>
                                )}
                                {editedData.socialLinks.twitter && (
                                  <Link href={editedData.socialLinks.twitter} isExternal color="brand.primary">
                                    Twitter
                                  </Link>
                                )}
                                {editedData.socialLinks.github && (
                                  <Link href={editedData.socialLinks.github} isExternal color="brand.primary">
                                    GitHub
                                  </Link>
                                )}
                              </>
                            ) : (
                              <Text color="brand.subtleText">No social links</Text>
                            )}
                          </VStack>
                        ) : (
                          <VStack spacing={3} align="stretch">
                            <InputGroup>
                              <InputLeftElement pointerEvents="none">
                                <Icon as={Linkedin} color="brand.subtleText" />
                              </InputLeftElement>
                              <Input
                                placeholder="LinkedIn"
                                value={editedData.socialLinks.linkedin || ''}
                                onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                                type="url"
                              />
                            </InputGroup>
                            <InputGroup>
                              <InputLeftElement pointerEvents="none">
                                <Icon as={Twitter} color="brand.subtleText" />
                              </InputLeftElement>
                              <Input
                                placeholder="Twitter"
                                value={editedData.socialLinks.twitter || ''}
                                onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                                type="url"
                              />
                            </InputGroup>
                            <InputGroup>
                              <InputLeftElement pointerEvents="none">
                                <Icon as={Github} color="brand.subtleText" />
                              </InputLeftElement>
                              <Input
                                placeholder="GitHub"
                                value={editedData.socialLinks.github || ''}
                                onChange={(e) => handleSocialLinkChange('github', e.target.value)}
                                type="url"
                              />
                            </InputGroup>
                          </VStack>
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Member Since</FormLabel>
                        <HStack spacing={2} color="brand.text">
                          <Icon as={Calendar} />
                          <Text>{formatDate(profileData.registrationDate)}</Text>
                        </HStack>
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem>
                <VStack spacing={6}>
                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Flex justify="space-between" align="center">
                        <Text fontWeight="semibold">Badges & Achievements</Text>
                      </Flex>
                    </CardHeader>
                    <CardBody>
                      <BadgeDisplay />
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Text fontWeight="semibold">Organization Information</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={4}>
                        <HStack spacing={3} align="center">
                          <Icon as={profileData.membershipStatus === 'paid' ? Check : Lock} color={profileData.membershipStatus === 'paid' ? 'green.500' : 'gray.500'} />
                          <Box>
                            <Text fontWeight="bold">{profileData.membershipStatus === 'paid' ? 'Paid Member' : 'Free Account'}</Text>
                            {profileData.membershipStatus === 'free' && (
                              <Button mt={2} size="sm" variant="secondary" onClick={handleUpgrade}>
                                Upgrade
                              </Button>
                            )}
                          </Box>
                        </HStack>

                        {profileData.membershipStatus === 'paid' && (
                          <VStack align="stretch" spacing={3}>
                            <HStack spacing={2}>
                              <Icon as={Building} />
                              <Text fontWeight="medium">Company</Text>
                            </HStack>
                            <Text color="brand.text">{profileData.companyName || 'Not assigned'}</Text>
                            <HStack spacing={2}>
                              <Icon as={Key} />
                              <Text fontWeight="medium">Company Code</Text>
                            </HStack>
                            <Tag bg="gray.100" color="brand.text" fontFamily="mono">
                              {profileData.companyCode || 'N/A'}
                            </Tag>
                            <HStack spacing={2}>
                              <Icon as={Users} />
                              <Text fontWeight="medium">Village</Text>
                            </HStack>
                            <Text color="brand.text">{profileData.villageName || 'Not assigned'}</Text>
                            {profileData.clusterName && (
                              <>
                                <HStack spacing={2}>
                                  <Icon as={Users} />
                                  <Text fontWeight="medium">Cluster</Text>
                                </HStack>
                                <Text color="brand.text">{profileData.clusterName}</Text>
                              </>
                            )}
                          </VStack>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                </VStack>
              </GridItem>
            </Grid>
          </TabPanel>

          <TabPanel px={0}>
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
              <GridItem>
                <VStack spacing={6}>
                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Flex justify="space-between" align="center">
                        <Box>
                          <Text fontWeight="semibold">Email Settings</Text>
                          <Text fontSize="sm" color="brand.subtleText">
                            Keep your contact email up to date
                          </Text>
                        </Box>
                        <Button size="sm" variant="secondary" onClick={() => setEmailFormOpen((prev) => !prev)}>
                          {emailFormOpen ? 'Close' : 'Change Email'}
                        </Button>
                      </Flex>
                    </CardHeader>
                    <CardBody>
                      {!emailFormOpen ? (
                        <HStack spacing={2} color="brand.text">
                          <Icon as={MailIcon} />
                          <Text>{profileData.email}</Text>
                        </HStack>
                      ) : (
                        <VStack align="stretch" spacing={4} as="form" onSubmit={handleChangeEmail}>
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
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Flex justify="space-between" align="center">
                        <Box>
                          <Text fontWeight="semibold">Password Settings</Text>
                          <Text fontSize="sm" color="brand.subtleText">
                            Keep your account secure
                          </Text>
                        </Box>
                        <Button size="sm" variant="secondary" onClick={() => setPasswordFormOpen((prev) => !prev)}>
                          {passwordFormOpen ? 'Close' : 'Change Password'}
                        </Button>
                      </Flex>
                    </CardHeader>
                    <CardBody>
                      {!passwordFormOpen ? (
                        <HStack spacing={2} color="brand.text">
                          <Icon as={Key} />
                          <Text>••••••••</Text>
                        </HStack>
                      ) : (
                        <VStack align="stretch" spacing={4} as="form" onSubmit={handleChangePassword}>
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
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Flex justify="space-between" align="center">
                        <Box>
                          <Text fontWeight="semibold">Company Code</Text>
                          <Text fontSize="sm" color="brand.subtleText">
                            Add or update your company code to unlock corporate perks.
                          </Text>
                        </Box>
                      </Flex>
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
                          <Input
                            value={companyCode}
                            onChange={(event) => setCompanyCode(event.target.value.toUpperCase().slice(0, 6))}
                            placeholder="Enter 6-character code"
                          />
                        </FormControl>
                        {companyCodeValid && companyOrganization && !companyCodeChecking && (
                          <Box bg="green.50" border="1px solid" borderColor="green.100" p={3} rounded="md">
                            <HStack spacing={2} color="green.600">
                              <Icon as={CheckCircle} />
                              <Text fontSize="sm">Valid company code ({companyOrganization.name})</Text>
                            </HStack>
                          </Box>
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
                        <Button
                          onClick={handleCompanyCodeSave}
                          isLoading={companyCodeSaving}
                          loadingText="Saving..."
                          isDisabled={!companyCode.trim()}
                        >
                          Save Company Code
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Text fontWeight="semibold">Peer Matching Preferences</Text>
                      <Text fontSize="sm" color="brand.subtleText" mt={1}>
                        Control how often you receive a new peer match and how we notify you.
                      </Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={4}>
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

                        <FormControl>
                          <FormLabel>Refresh frequency</FormLabel>
                          <Select
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
                        </FormControl>

                        <FormControl isDisabled={!['weekly', 'biweekly'].includes(editedData.matchRefreshPreference || '')}>
                          <FormLabel>Preferred match day</FormLabel>
                          <Select
                            value={editedData.preferredMatchDay ?? 1}
                            onChange={(event) => handleInputChange('preferredMatchDay', Number(event.target.value))}
                          >
                            {weekdayOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl>
                          <FormLabel>Notification preference</FormLabel>
                          <Select
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
                        </FormControl>

                        <FormControl>
                          <FormLabel>Match timezone</FormLabel>
                          <Select
                            value={editedData.timezone || ''}
                            onChange={(event) => handleInputChange('timezone', event.target.value)}
                          >
                            {timezoneOptions.map((zone) => (
                              <option key={zone} value={zone}>
                                {zone}
                              </option>
                            ))}
                          </Select>
                          <FormHelperText>
                            Match timing is calculated using this timezone.
                          </FormHelperText>
                        </FormControl>

                        <Button onClick={handleSaveMatchPreferences} isLoading={matchPreferencesSaving} loadingText="Saving...">
                          Save Peer Matching Preferences
                        </Button>

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
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Text fontWeight="semibold">Leaderboard Privacy</Text>
                      <Text fontSize="sm" color="brand.subtleText" mt={1}>
                        Decide who can view your ranking and recent activity on public leaderboards.
                      </Text>
                    </CardHeader>
                    <CardBody>
                      <RadioGroup
                        value={editedData.leaderboardVisibility}
                        onChange={(value) => handleInputChange('leaderboardVisibility', value as ProfileData['leaderboardVisibility'])}
                      >
                        <VStack align="stretch" spacing={3}>
                          <Box
                            border="2px solid"
                            borderColor={editedData.leaderboardVisibility === 'public' ? 'brand.primary' : 'brand.border'}
                            rounded="lg"
                            p={4}
                          >
                            <Radio value="public" colorScheme="purple">
                              <Text fontWeight="medium">Public</Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                Visible on company and village leaderboards across the community.
                              </Text>
                            </Radio>
                          </Box>
                          <Box
                            border="2px solid"
                            borderColor={editedData.leaderboardVisibility === 'company' ? 'brand.primary' : 'brand.border'}
                            rounded="lg"
                            p={4}
                          >
                            <Radio value="company" colorScheme="purple">
                              <Text fontWeight="medium">Company Only</Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                Only teammates and cohort members can see your ranking and activity.
                              </Text>
                            </Radio>
                          </Box>
                          <Box
                            border="2px solid"
                            borderColor={editedData.leaderboardVisibility === 'private' ? 'brand.primary' : 'brand.border'}
                            rounded="lg"
                            p={4}
                          >
                            <Radio value="private" colorScheme="purple">
                              <Text fontWeight="medium">Hidden</Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                Keep your ranking private while you continue to earn points.
                              </Text>
                            </Radio>
                          </Box>
                        </VStack>
                      </RadioGroup>
                      <Button mt={4} onClick={handleSaveVisibilityPreference} isLoading={visibilitySaving} loadingText="Saving...">
                        Save Visibility Preference
                      </Button>
                      {visibilityMessage && (
                        <Box
                          mt={3}
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
                    </CardBody>
                  </Card>
                </VStack>
              </GridItem>

              <GridItem>
                <VStack spacing={6}>
                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Text fontWeight="semibold">Account Security</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={4}>
                        <HStack spacing={3}>
                          <Icon as={Settings} />
                          <Box>
                            <Text fontWeight="medium">Last Login</Text>
                            <Text color="brand.subtleText" fontSize="sm">
                              {profile?.lastActiveAt ? new Date(profile.lastActiveAt).toLocaleString() : 'Not available'}
                            </Text>
                          </Box>
                        </HStack>
                        <Divider />
                        <HStack spacing={3}>
                          <Icon as={Shield} />
                          <Box>
                            <Text fontWeight="medium">Account Status</Text>
                            <Badge colorScheme={statusColorMap[profileData.accountStatus] || 'gray'}>
                              {profileData.accountStatus === 'active' ? 'Active' : profileData.accountStatus === 'inactive' ? 'Inactive' : 'Pending'}
                            </Badge>
                          </Box>
                        </HStack>
                        <Divider />
                        <HStack spacing={3}>
                          <Icon as={Settings} />
                          <Box>
                            <Text fontWeight="medium">Account ID</Text>
                            <Text fontSize="sm" fontFamily="mono" bg="brand.primaryMuted" p={2} rounded="md">
                              {profileData.id}
                            </Text>
                          </Box>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border">
                    <CardBody>
                      <Button variant="ghost" leftIcon={<LogOut size={16} />} width="full" onClick={handleSignOut}>
                        Sign Out
                      </Button>
                    </CardBody>
                  </Card>
                </VStack>
              </GridItem>
            </Grid>
          </TabPanel>

          <TabPanel px={0}>
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
              <GridItem>
                <VStack spacing={6}>
                  <Card borderColor="brand.border">
                    <CardBody>
                      <Box
                        border="1px solid"
                        borderColor={profileData.membershipStatus === 'paid' ? 'green.300' : 'orange.200'}
                        bg={profileData.membershipStatus === 'paid' ? 'green.50' : 'orange.50'}
                        p={5}
                        rounded="lg"
                      >
                        <Flex justify="space-between" align="center" mb={3}>
                          <Box>
                            <Text fontWeight="bold">{membershipCopy[profileData.membershipStatus].title}</Text>
                            <Text color="brand.subtleText">
                              {membershipCopy[profileData.membershipStatus].description}
                            </Text>
                          </Box>
                          <Tag colorScheme={profileData.membershipStatus === 'paid' ? 'green' : 'orange'}>
                            {membershipCopy[profileData.membershipStatus].badge}
                          </Tag>
                        </Flex>

                        {profileData.membershipStatus === 'paid' ? (
                          <VStack align="stretch" spacing={2}>
                            <Box>
                              <Text fontWeight="semibold">Company Code</Text>
                              <Text fontFamily="mono" bg="white" border="1px solid" borderColor="brand.border" p={2} rounded="md">
                                {profileData.companyCode || 'N/A'}
                              </Text>
                            </Box>
                            <Text>Organization: {profileData.companyName || 'Not assigned'}</Text>
                            <Text>Village: {profileData.villageName || 'Not assigned'}</Text>
                            {profileData.clusterName && <Text>Cluster: {profileData.clusterName}</Text>}
                          </VStack>
                        ) : (
                          <Button mt={4} leftIcon={<Lock size={16} />} onClick={handleUpgrade}>
                            Upgrade to Full Access
                          </Button>
                        )}
                      </Box>
                    </CardBody>
                  </Card>

                  <Card borderColor="brand.border">
                    <CardHeader>
                      <Text fontWeight="semibold">Feature Comparison</Text>
                    </CardHeader>
                    <CardBody>
                      <Grid templateColumns={{ base: 'repeat(3, 1fr)' }} gap={3} fontWeight="semibold" mb={2}>
                        <Text>Feature</Text>
                        <Text textAlign="center">Free</Text>
                        <Text textAlign="center" bg="brand.primary" color="white" rounded="md" py={1}>
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
                        <Grid templateColumns={{ base: 'repeat(3, 1fr)' }} gap={3} alignItems="center" py={2} key={row.label} borderBottom="1px solid" borderColor="brand.border">
                          <Text fontWeight="medium">{row.label}</Text>
                          <Center>
                            {row.free ? <Icon as={Check} color="green.500" /> : <Text color="brand.subtleText">—</Text>}
                          </Center>
                          <Center>
                            {row.paid ? <Icon as={Check} color="green.500" /> : <Text color="brand.subtleText">—</Text>}
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

                  <PaymentHistory />

                  {profileData.membershipStatus === 'free' && (
                    <Card borderColor="brand.border" bg="yellow.50">
                      <CardHeader>
                        <Text fontWeight="semibold">How to Upgrade</Text>
                      </CardHeader>
                      <CardBody>
                        <VStack align="stretch" spacing={4}>
                          {[1, 2, 3].map((step) => (
                            <HStack align="flex-start" spacing={3} key={step}>
                              <Center bg="yellow.200" color="yellow.700" rounded="full" w="32px" h="32px" fontWeight="bold">
                                {step}
                              </Center>
                              <Box>
                                <Text fontWeight="semibold">
                                  {step === 1 && 'Get a Company Code'}
                                  {step === 2 && 'Enter Your Code'}
                                  {step === 3 && 'Enjoy Full Access'}
                                </Text>
                                <Text color="brand.subtleText">
                                  {step === 1 && 'Contact your organization administrator or our sales team to get a valid company code'}
                                  {step === 2 && 'Go to the upgrade page and enter your company code'}
                                  {step === 3 && 'Immediately gain access to all premium features and content'}
                                </Text>
                              </Box>
                            </HStack>
                          ))}
                          <Button variant="secondary" leftIcon={<CreditCard size={16} />} onClick={handleUpgrade}>
                            Go to Upgrade Page
                          </Button>
                        </VStack>
                      </CardBody>
                    </Card>
                  )}
                </VStack>
              </GridItem>

              <GridItem>
                <VStack spacing={6}>
                  <Button variant="ghost" rightIcon={<ChevronRight />} onClick={() => navigate('/app/leaderboard')}>
                    Back to Dashboard
                  </Button>
                </VStack>
              </GridItem>
            </Grid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}
