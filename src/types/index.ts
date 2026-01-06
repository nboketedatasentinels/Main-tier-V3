// Import and re-export role types and values
import { UserRole, ALL_STANDARD_ROLES } from './roles';
import type { StandardRole, AllRoles } from './roles';
export * from './admin'
export * from './tutorials'

export { UserRole, ALL_STANDARD_ROLES };
export type { StandardRole, AllRoles };

// Transformation Tier Types
export enum TransformationTier {
  INDIVIDUAL_FREE = 'individual_free',
  INDIVIDUAL_PAID = 'individual_paid',
  CORPORATE_MEMBER = 'corporate_member',
  CORPORATE_LEADER = 'corporate_leader',
}

// Account Status Types
export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

// Dashboard Preferences
export interface DashboardPreferences {
  defaultRoute?: string
  lockedToFreeExperience?: boolean
  source?: string
  lastUpdatedAt?: string
}

// User Profile
export interface UserProfile {
  id: string
  email:string
  firstName: string
  lastName: string
  fullName: string
  role: StandardRole
  membershipStatus?: 'free' | 'paid'
  avatarUrl?: string
  photoURL?: string
  bio?: string
  phoneNumber?: string
  linkedinUrl?: string
  emailVerified?: boolean
  
  // Journey & Progress
  journeyType: "4W" | "6W" | "3M" | "6M" | "9M" | "12M";
  programDurationWeeks?: number;
  journeyStartDate?: string;
  currentJourneyId?: string
  currentWeek?: number
  totalPoints: number
  level: number
  referralCount?: number
  referralCode?: string | null
  referredBy?: string | null
  
  // Organization
  companyId?: string | null
  companyCode?: string | null
  companyName?: string | null
  villageId?: string
  clusterId?: string
  corporateVillageId?: string
  cohortIdentifier?: string

  // Availability & preferences
  timezone?: string
  availabilityStatus?: string
  notes?: string

  // Leadership relations
  mentorId?: string
  ambassadorId?: string
  isActiveAmbassador?: boolean
  
  // Account Management
  accountStatus?: AccountStatus | string
  lastInteraction?: string
  registrationDate?: string
  lastActive?: string
  mustChangePassword?: boolean
  
  // Onboarding
  onboardingComplete?: boolean
  onboardingSkipped?: boolean
  hasSeenDashboardTour?: boolean
  
  // Role-Based Features
  transformationTier?: TransformationTier | string
  assignedOrganizations?: string[]
  dashboardPreferences?: DashboardPreferences
  defaultDashboardRoute?: string
  
  // Settings
  /**
   * @deprecated Legacy onboarding flag. Always true for all users.
   */
  isOnboarded: boolean
  fcmTokens?: string[]
  personalityType?: string
  privacySettings?: PrivacySettings

  // Timestamps
  createdAt: string
  updatedAt: string
  lastActiveAt?: string
}

export type GenderOption =
  | 'prefer_not_to_say'
  | 'male'
  | 'female'
  | 'non_binary'
  | 'other'

export interface Organization {
  id: string
  code: string
  name: string
  status: 'active' | 'inactive' | 'suspended'
  createdAt: string
  updatedAt: string
  memberCount: number
  settings?: Record<string, unknown>
  transformation_partner_id?: string | null
}

export interface PrivacySettings {
  showOnLeaderboard: boolean
  allowPeerMatching: boolean
  shareImpactPublicly: boolean
}

import { JourneyType } from "@/config/pointsConfig";

export interface Journey {
  id: string
  name: string
  type: JourneyType;
  description: string
  durationWeeks: number
  totalPointsTarget: number
  weeklyPointsTarget: number
  minPointsPerWeek: number
  maxPointsPerWeek?: number
  maxPointsTotal?: number
  completionThresholdPct?: number
  badgeId?: string
  isActive: boolean
  isPremium: boolean
  courses?: Course[]
  phases?: JourneyPhase[]
  createdAt: string
  updatedAt: string
}

export interface JourneyPhase {
  id: string
  journeyId: string
  name: string
  description: string
  weekStart: number
  weekEnd: number
  pointsTarget: number
}

// User Journey Progress
export interface UserJourney {
  id: string
  userId: string
  journeyId: string
  startDate: string
  endDate?: string
  currentWeek: number
  totalPoints: number
  status: 'active' | 'completed' | 'paused' | 'abandoned'
  completedAt?: string
  createdAt: string
  updatedAt: string
}

// Activity Types
export enum ActivityType {
  PODCAST_WATCH = 'podcast_watch',
  PODCAST_WORKBOOK = 'podcast_workbook',
  WEBINAR_ATTEND = 'webinar_attend',
  WEBINAR_WORKBOOK = 'webinar_workbook',
  PEER_MATCHING = 'peer_matching',
  IMPACT_LOG = 'impact_log',
  BOOK_CLUB = 'book_club',
  PEER_TO_PEER_MONTHLY = 'peer_to_peer_monthly',
  LINKEDIN_ENGAGEMENT = 'linkedin_engagement',
  COURSE_MODULE = 'course_module',
  EVENT_ATTENDANCE = 'event_attendance',
  COMMUNITY_POST = 'community_post',
}

export interface Activity {
  id: string
  name: string
  type: ActivityType
  description: string
  points: number
  requiresProof: boolean
  isRecurring: boolean
  createdAt: string
}

// Weekly Activity Tracking
export interface WeeklyProgress {
  uid: string;
  weekNumber: number;
  monthNumber: number;
  weeklyTarget: number;
  pointsEarned: number;
  status: "on_track" | "warning" | "alert" | "recovery";
  updatedAt: string | Date | { toDate: () => Date };
}

export enum ActivityStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export interface WeeklyActivity {
  id: string
  userId: string
  journeyId: string
  weekNumber: number
  activityId: string
  status: ActivityStatus
  pointsEarned: number
  proofUrl?: string
  completedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// Courses
export interface Course {
  id: string
  name: string
  description: string
  modules: CourseModule[]
  totalPoints: number
  estimatedHours: number
  isActive: boolean
  createdAt: string
}

export interface CourseModule {
  id: string
  courseId: string
  name: string
  description: string
  content: string
  points: number
  order: number
  isActive: boolean
}

export interface UserCourseProgress {
  id: string
  userId: string
  courseId: string
  moduleId: string
  isCompleted: boolean
  pointsEarned: number
  completedAt?: string
  createdAt: string
}

// Impact Log
export enum ImpactCategory {
  PERSONAL = 'personal',
  PROFESSIONAL = 'professional',
  COMMUNITY = 'community',
  ENVIRONMENTAL = 'environmental',
}

export enum ESGCategory {
  ENVIRONMENTAL = 'environmental',
  SOCIAL = 'social',
  GOVERNANCE = 'governance',
}

export enum BusinessCategory {
  EFFICIENCY = 'efficiency',
  REVENUE = 'revenue',
  COST_SAVINGS = 'cost_savings',
  QUALITY = 'quality',
  INNOVATION = 'innovation',
  CUSTOMER_SATISFACTION = 'customer_satisfaction',
}

export interface ImpactLog {
  id: string
  userId: string
  title: string
  description: string
  category: ImpactCategory
  esgCategory?: ESGCategory
  businessCategory?: BusinessCategory
  hoursInvested: number
  usdValue: number
  peopleImpacted: number
  isCompanyImpact: boolean
  companyId?: string
  proofUrls?: string[]
  tags?: string[]
  createdAt: string
  updatedAt: string
}

// Badges & Achievements
export interface Badge {
  id: string
  name: string
  description: string
  iconUrl: string
  color: string
  type: 'journey' | 'activity' | 'milestone' | 'special'
  criteria: string
  pointsRequired?: number
  createdAt: string
}

export interface UserBadge {
  id: string
  userId: string
  badgeId: string
  earnedAt: string
  journey?: string
}

// Leaderboard
export interface LeaderboardEntry {
  userId: string
  user: UserProfile
  points: number
  level: number
  rank: number
  badgeCount: number
  journeyName?: string
}

export enum LeaderboardView {
  GLOBAL = 'global',
  COMPANY = 'company',
  VILLAGE = 'village',
  CLUSTER = 'cluster',
}

export enum LeaderboardTimeframe {
  ALL_TIME = 'all_time',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  CURRENT_JOURNEY = 'current_journey',
}

// Community
export interface Village {
  id: string
  name: string
  description: string
  creatorId: string
  companyId?: string
  memberCount: number
  isActive: boolean
  createdAt: string
}

export interface Cluster {
  id: string
  name: string
  description: string
  companyId: string
  villageId?: string
  memberCount: number
  isActive: boolean
  createdAt: string
}

// Events
export interface Event {
  id: string
  title: string
  description: string
  eventType: 'webinar' | 'workshop' | 'networking' | 'book_club' | 'other'
  startTime: string
  endTime: string
  location?: string
  isVirtual: boolean
  meetingUrl?: string
  points: number
  maxAttendees?: number
  currentAttendees: number
  qrCode?: string
  isPublic: boolean
  organizerId: string
  createdAt: string
}

export interface EventAttendance {
  id: string
  eventId: string
  userId: string
  checkInTime: string
  pointsAwarded: number
}

// Notifications
export enum NotificationType {
  ACHIEVEMENT = 'achievement',
  BELOW_TARGET = 'below_target',
  EVENT_REMINDER = 'event_reminder',
  ANNOUNCEMENT = 'announcement',
  MENTOR_MESSAGE = 'mentor_message',
  SYSTEM = 'system',
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  isRead: boolean
  createdAt: string
}

// Subscription & Payment
export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export interface Subscription {
  id: string
  userId: string
  tier: SubscriptionTier
  stripeSubscriptionId?: string
  stripePriceId?: string
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

// Analytics
export interface UserAnalytics {
  userId: string
  totalPoints: number
  weeklyAverage: number
  monthlyAverage: number
  currentStreak: number
  longestStreak: number
  activitiesCompleted: number
  badgesEarned: number
  impactHours: number
  impactValue: number
  peopleImpacted: number
  joinedAt: string
}

export interface CompanyAnalytics {
  companyId: string
  totalMembers: number
  activeMembers: number
  totalPoints: number
  averagePointsPerMember: number
  completionRate: number
  engagementRate: number
  topPerformers: LeaderboardEntry[]
  riskUsers: UserProfile[]
  totalImpactHours: number
  totalImpactValue: number
}

// API Response Types
export interface ApiResponse<T> {
  data?: T
  error?: ApiError
  success: boolean
}

export interface ApiError {
  message: string
  code?: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Inspiration Quote
export interface InspirationQuote {
  id: string
  week_number: number
  quote_text: string
  author?: string
  category?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  year?: number
}
