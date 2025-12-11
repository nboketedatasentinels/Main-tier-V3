# Firestore Database Structure

This document outlines the Firestore collection structure for the T4L platform.

## Collections

### profiles
User profile documents (indexed by user UID)
```typescript
{
  id: string                    // User UID
  email: string
  firstName: string
  lastName: string
  fullName: string
  role: 'free_user' | 'paid_member' | 'mentor' | 'ambassador' | 'company_admin' | 'super_admin'
  avatarUrl?: string
  bio?: string
  phoneNumber?: string
  linkedinUrl?: string
  
  // Journey & Progress
  currentJourneyId?: string
  currentWeek?: number
  totalPoints: number
  level: number
  
  // Organization
  companyId?: string
  villageId?: string
  clusterId?: string
  
  // Settings
  isOnboarded: boolean
  personalityType?: string
  showOnLeaderboard: boolean
  allowPeerMatching: boolean
  shareImpactPublicly: boolean
  
  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
  lastActiveAt?: Timestamp
}
```

### journeys
Available journey templates
```typescript
{
  id: string
  name: string
  type: 'free' | 'intro_4_week' | 'sprint_6_week' | 'three_month' | 'six_month' | 'nine_month' | 'twelve_month' | 'custom'
  description: string
  durationWeeks: number
  totalPointsTarget: number
  weeklyPointsTarget: number
  minPointsPerWeek: number
  maxPointsPerWeek?: number
  badgeId?: string
  isActive: boolean
  isPremium: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### userJourneys
User enrollment in journeys (subcollection under profiles)
```typescript
profiles/{userId}/userJourneys/{journeyId}
{
  journeyId: string
  startDate: Timestamp
  endDate?: Timestamp
  currentWeek: number
  totalPoints: number
  status: 'active' | 'completed' | 'paused' | 'abandoned'
  completedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### activities
Available activities
```typescript
{
  id: string
  name: string
  type: 'podcast_watch' | 'podcast_workbook' | 'webinar_attend' | etc.
  description: string
  points: number
  requiresProof: boolean
  isRecurring: boolean
  createdAt: Timestamp
}
```

### weeklyActivities
User activity completion tracking (subcollection under profiles)
```typescript
profiles/{userId}/weeklyActivities/{activityId}
{
  journeyId: string
  weekNumber: number
  activityId: string
  status: 'not_started' | 'pending' | 'completed'
  pointsEarned: number
  proofUrl?: string
  completedAt?: Timestamp
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### courses
Available courses
```typescript
{
  id: string
  name: string
  description: string
  totalPoints: number
  estimatedHours: number
  isActive: boolean
  createdAt: Timestamp
}
```

### impactLogs
User impact tracking (subcollection under profiles)
```typescript
profiles/{userId}/impactLogs/{logId}
{
  title: string
  description: string
  category: 'personal' | 'professional' | 'community' | 'environmental'
  esgCategory?: 'environmental' | 'social' | 'governance'
  businessCategory?: 'efficiency' | 'revenue' | 'cost_savings' | etc.
  hoursInvested: number
  usdValue: number
  peopleImpacted: number
  isCompanyImpact: boolean
  companyId?: string
  proofUrls?: string[]
  tags?: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### badges
Achievement badges
```typescript
{
  id: string
  name: string
  description: string
  iconUrl?: string
  color: string
  type: 'journey' | 'activity' | 'milestone' | 'special'
  criteria: string
  pointsRequired?: number
  createdAt: Timestamp
}
```

### userBadges
Badges earned by users (subcollection under profiles)
```typescript
profiles/{userId}/userBadges/{badgeId}
{
  badgeId: string
  earnedAt: Timestamp
  journey?: string
}
```

### villages
Community groups
```typescript
{
  id: string
  name: string
  description: string
  creatorId: string
  companyId?: string
  memberCount: number
  isActive: boolean
  createdAt: Timestamp
}
```

### companies
Organization profiles
```typescript
{
  id: string
  name: string
  description: string
  logoUrl?: string
  website?: string
  isActive: boolean
  createdAt: Timestamp
}
```

### events
Platform events
```typescript
{
  id: string
  title: string
  description: string
  eventType: 'webinar' | 'workshop' | 'networking' | 'book_club' | 'other'
  startTime: Timestamp
  endTime: Timestamp
  location?: string
  isVirtual: boolean
  meetingUrl?: string
  points: number
  maxAttendees?: number
  currentAttendees: number
  qrCode?: string
  isPublic: boolean
  organizerId: string
  createdAt: Timestamp
}
```

### notifications
User notifications (subcollection under profiles)
```typescript
profiles/{userId}/notifications/{notificationId}
{
  type: 'achievement' | 'below_target' | 'event_reminder' | 'announcement' | 'mentor_message' | 'system'
  title: string
  message: string
  actionUrl?: string
  isRead: boolean
  createdAt: Timestamp
}
```

### user_points
Points awarded to users.
```typescript
user_points/{pointsId}
{
  userId: string
  source: string
  points: number
  recordedAt: Timestamp
}
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function hasRole(role) {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role == role;
    }
    
    // Profiles collection
    match /profiles/{userId} {
      allow read: if isAuthenticated() && (isOwner(userId) || hasRole('super_admin'));
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isAuthenticated() && (isOwner(userId) || hasRole('super_admin'));
      allow delete: if hasRole('super_admin');
      
      // Subcollections
      match /userJourneys/{journeyId} {
        allow read, write: if isAuthenticated() && isOwner(userId);
      }
      
      match /weeklyActivities/{activityId} {
        allow read, write: if isAuthenticated() && isOwner(userId);
      }
      
      match /impactLogs/{logId} {
        allow read, write: if isAuthenticated() && isOwner(userId);
      }
      
      match /userBadges/{badgeId} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow write: if hasRole('super_admin');
      }
      
      match /notifications/{notificationId} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow update: if isAuthenticated() && isOwner(userId);
        allow create: if hasRole('super_admin');
      }
    }
    
    // Public read collections
    match /journeys/{journeyId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin');
    }
    
    match /activities/{activityId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin');
    }
    
    match /courses/{courseId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin');
    }
    
    match /badges/{badgeId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin');
    }
    
    // Community collections
    match /villages/{villageId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if hasRole('super_admin') || hasRole('company_admin');
    }
    
    match /companies/{companyId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin') || hasRole('company_admin');
    }
    
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if hasRole('super_admin') || hasRole('company_admin');
    }

    match /user_points/{pointsId} {
      allow read: if isAuthenticated() && (request.auth.uid == resource.data.userId || hasRole('super_admin'));
      allow create, update: if isAuthenticated() && (request.resource.data.userId == request.auth.uid || hasRole('super_admin'));
    }
  }
}
```

## Indexes

Create composite indexes for common queries:

1. **profiles** collection:
   - `role`, `totalPoints` (descending)
   - `companyId`, `totalPoints` (descending)
   - `villageId`, `totalPoints` (descending)

2. **impactLogs** subcollection:
   - `createdAt` (descending)
   - `category`, `createdAt` (descending)

3. **events** collection:
   - `startTime` (ascending)
   - `isPublic`, `startTime` (ascending)

## Initial Data Setup

Use Firebase Admin SDK or console to populate initial data:

```typescript
// Sample initial activities
const activities = [
  { name: 'Watch Podcast', type: 'podcast_watch', points: 1000, requiresProof: false },
  { name: 'Complete Podcast Workbook', type: 'podcast_workbook', points: 1000, requiresProof: true },
  { name: 'Attend Webinar', type: 'webinar_attend', points: 2000, requiresProof: false },
  // ... more activities
];

// Sample initial badges
const badges = [
  { name: 'Starter ⭐', description: 'Completed 4-Week Intro Journey', type: 'journey', color: '#f9db59' },
  { name: 'Sprint Champion 🏃', description: 'Completed 6-Week Sprint', type: 'journey', color: '#f4540c' },
  // ... more badges
];

// Sample journeys
const journeys = [
  { name: 'Curious Cat Path', type: 'free', durationWeeks: 0, totalPointsTarget: 0, weeklyPointsTarget: 0, isPremium: false },
  { name: '4-Week Intro Journey', type: 'intro_4_week', durationWeeks: 4, totalPointsTarget: 10000, weeklyPointsTarget: 2500, isPremium: true },
  // ... more journeys
];
```
