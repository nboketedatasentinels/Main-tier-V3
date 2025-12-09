# T4L Platform - Technical Architecture Document

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Patterns](#architecture-patterns)
4. [Data Model](#data-model)
5. [Authentication & Authorization](#authentication--authorization)
6. [Routing & Navigation](#routing--navigation)
7. [State Management](#state-management)
8. [UI/UX Guidelines](#uiux-guidelines)
9. [API Integration](#api-integration)
10. [Deployment & Environment](#deployment--environment)

---

## System Overview

T4L (Transformation 4 Leaders) is a comprehensive leadership transformation platform built as a modern single-page application (SPA) with a serverless backend.

### Key Characteristics
- **Architecture**: Client-server with serverless backend
- **Rendering**: Client-side rendering (CSR) with React
- **State**: Context API + local state management
- **Database**: Firestore (NoSQL) with Security Rules
- **Real-time**: WebSocket subscriptions for live updates
- **Authentication**: JWT-based with Firebase Auth

---

## Technology Stack

### Frontend Core
```
React 18.2.0          - UI library
TypeScript 5.3.3      - Type safety
Vite 5.0.12           - Build tool and dev server
```

### UI Framework & Styling
```
Chakra UI 2.8.2       - Component library
Tailwind CSS 3.4.1    - Utility-first CSS
Framer Motion 10.18.0 - Animations
Lucide React 0.309.0  - Icon system
```

### Routing & Navigation
```
React Router v6.21.3  - Client-side routing
```

### Data Visualization
```
Recharts 2.10.4       - Charts and graphs
```

### Utilities
```
date-fns 3.0.6        - Date manipulation
canvas-confetti 1.9.2 - Celebration effects
intro.js 7.2.0        - Guided tours
```

### Backend Services
```
Firebase                  - Firestore NoSQL database
Firebase Auth             - Authentication
Firebase Storage          - File storage
Firebase Cloud Functions  - Serverless functions
```

### External Services
```
Stripe                - Payment processing
SendGrid              - Transactional emails
```

---

## Architecture Patterns

### Folder Structure
```
src/
├── components/       # Reusable UI components
│   └── ProtectedRoute.tsx
├── contexts/         # React contexts
│   ├── AuthContextType.ts
│   └── AuthContext.tsx
├── hooks/            # Custom React hooks
│   └── useAuth.ts
├── layouts/          # Page layouts
│   ├── MainLayout.tsx
│   └── AuthLayout.tsx
├── pages/            # Page components
│   ├── auth/
│   ├── dashboards/
│   ├── journeys/
│   ├── impact/
│   ├── leaderboard/
│   └── ...
├── routes/           # Route configuration
│   └── index.tsx
├── services/         # API services
│   └── firebase.ts
├── theme/            # Chakra UI theme
│   └── index.ts
├── types/            # TypeScript types
│   └── index.ts
└── utils/            # Utility functions
```

### Component Patterns

#### 1. Page Components
- Located in `src/pages/`
- Handle page-level logic and layout
- Use hooks for data fetching
- Example: `LoginPage.tsx`, `FreeDashboard.tsx`

#### 2. Layout Components
- Wrap page content with common UI
- Handle navigation and shell
- Example: `MainLayout`, `AuthLayout`

#### 3. Feature Components
- Reusable components with specific functionality
- Located in `src/components/`
- Example: `ProtectedRoute`

#### 4. Context Providers
- Global state management
- Authentication, theme, user preferences
- Located in `src/contexts/`

---

## Data Model

### Core Entities

#### User & Profile
```typescript
UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  totalPoints: number
  level: number
  currentJourneyId?: string
  currentWeek?: number
  companyId?: string
  villageId?: string
  isOnboarded: boolean
  // ... more fields
}
```

#### Journey
```typescript
Journey {
  id: string
  name: string
  type: JourneyType
  durationWeeks: number
  totalPointsTarget: number
  weeklyPointsTarget: number
  isPremium: boolean
  courses?: Course[]
  // ... more fields
}
```

#### Activity & Points
```typescript
Activity {
  id: string
  name: string
  type: ActivityType
  points: number
  requiresProof: boolean
}

WeeklyActivity {
  userId: string
  journeyId: string
  weekNumber: number
  activityId: string
  status: ActivityStatus
  pointsEarned: number
}
```

#### Impact Log
```typescript
ImpactLog {
  id: string
  userId: string
  title: string
  category: ImpactCategory
  hoursInvested: number
  usdValue: number
  peopleImpacted: number
  isCompanyImpact: boolean
}
```

### User Roles Hierarchy
```
FREE_USER          - Basic access
PAID_MEMBER        - Full journey access
MENTOR             - Can mentor learners
AMBASSADOR         - Community leadership
COMPANY_ADMIN      - Org management
SUPER_ADMIN        - Platform administration
```

---

## Authentication & Authorization

### Authentication Flow

1. **Login Methods**
   - Email/Password
   - Magic Link (passwordless)
   - OAuth (future)

2. **Session Management**
   - JWT tokens stored in localStorage
   - Automatic token refresh
   - Real-time auth state changes

3. **Password Recovery**
   - Email-based reset link
   - Secure token validation

### Authorization (RBAC)

#### Route Protection
```typescript
<ProtectedRoute requiredRoles={[UserRole.PAID_MEMBER]}>
  <PaidMemberDashboard />
</ProtectedRoute>
```

#### Role Checking Utilities
```typescript
// In components
const { hasRole, hasAnyRole } = useAuth()

if (hasRole(UserRole.SUPER_ADMIN)) {
  // Show admin controls
}

if (hasAnyRole([UserRole.MENTOR, UserRole.AMBASSADOR])) {
  // Show mentor/ambassador features
}
```

#### Database Security
- Firestore Security Rules on all collections
- Policies match application roles
- User can only access their own data
- Admins have elevated permissions

---

## Routing & Navigation

### Route Structure
```
/login                    - Login page
/signup                   - Registration
/reset-password           - Password recovery
/onboarding               - First-time user setup

/dashboard/free           - Free user dashboard
/dashboard/member         - Paid member dashboard
/dashboard/mentor         - Mentor dashboard
/dashboard/ambassador     - Ambassador dashboard
/dashboard/company-admin  - Company admin dashboard
/dashboard/super-admin    - Super admin dashboard

/journeys                 - Journey selection
/impact                   - Impact log
/leaderboard              - Leaderboards
/profile                  - User profile
/settings                 - Account settings

/unauthorized             - Access denied page
```

### Navigation Patterns

#### Desktop Navigation
- Fixed sidebar with navigation links
- User profile and points display
- Settings and logout at bottom

#### Mobile Navigation
- Hamburger menu with drawer
- Top bar with logo and user menu
- Responsive breakpoints

---

## State Management

### Global State (Context API)

#### AuthContext
```typescript
{
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signIn: (email, password) => Promise
  signUp: (email, password, userData) => Promise
  signOut: () => Promise
  // ... more methods
}
```

#### Future Contexts
- ThemeContext (dark/light mode)
- NotificationContext (in-app notifications)
- JourneyContext (current journey state)

### Local State
- Component-level state with `useState`
- Form state
- UI toggles (modals, drawers)

### Server State
- Data fetching with custom hooks
- Real-time subscriptions via Firebase
- Optimistic updates for better UX

---

## UI/UX Guidelines

### Brand Colors

```css
Deep Plum:     #27062e  /* Primary backgrounds */
Flame Orange:  #f4540c  /* CTAs, primary actions */
Royal Purple:  #350e6f  /* Secondary accents */
Gold:          #eab130  /* Achievements, success */
Soft Gold:     #f9db59  /* Highlights, gradients */
```

### Color Usage Rules

1. **Backgrounds**
   - Deep Plum for main backgrounds
   - Royal Purple for cards and surfaces
   - Gradients: Deep Plum → Royal Purple → Gold

2. **Actions**
   - Flame Orange for primary buttons
   - Gold borders for secondary buttons
   - Ghost buttons with gold hover

3. **Feedback**
   - Gold for success and achievements
   - Orange for warnings
   - Purple for info

4. **Data Visualization**
   - Gold for primary data
   - Orange for secondary data
   - Purple for backgrounds

### Component Guidelines

#### Buttons
```tsx
<Button variant="primary">   {/* Flame Orange */}
<Button variant="secondary"> {/* Deep Plum + Gold border */}
<Button variant="ghost">     {/* Transparent + Gold hover */}
```

#### Cards
```tsx
<Card bg="brand.royalPurple">
  <CardBody>
    {/* Dark purple background with gold border */}
  </CardBody>
</Card>
```

#### Progress Bars
```tsx
<Progress 
  value={75} 
  colorScheme="gold"  {/* Gold fill */}
/>
```

### Accessibility

- **WCAG 2.1 AA compliance**
- Keyboard navigation support
- ARIA labels on interactive elements
- Sufficient color contrast
- Focus indicators
- Screen reader friendly

### Responsive Design

#### Breakpoints
```
sm:  30em  (480px)
md:  48em  (768px)
lg:  62em  (992px)
xl:  80em  (1280px)
2xl: 96em  (1536px)
```

#### Mobile-First Approach
```tsx
<Box 
  display={{ base: 'none', md: 'block' }}  // Desktop sidebar
  p={{ base: 4, md: 8 }}                   // Responsive padding
/>
```

---

## API Integration

### Firebase Client

#### Configuration
```typescript
// src/services/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  // ... more config
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

#### Usage Patterns

**Query Data**
```typescript
import { collection, query, where, getDocs } from 'firebase/firestore'

const q = query(
  collection(db, 'profiles'),
  where('userId', '==', userId)
)
const snapshot = await getDocs(q)
```

**Insert Data**
```typescript
import { doc, setDoc } from 'firebase/firestore'

await setDoc(doc(db, 'impact_logs', docId), {
  userId: userId,
  title: 'My Impact',
  // ... more fields
})
```

**Update Data**
```typescript
import { doc, updateDoc } from 'firebase/firestore'

await updateDoc(doc(db, 'profiles', userId), {
  totalPoints: newPoints
})
```

**Real-time Subscription**
```typescript
import { collection, onSnapshot } from 'firebase/firestore'

const unsubscribe = onSnapshot(
  collection(db, 'notifications'),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      // Handle new notification
    })
  }
)
```

### Error Handling

```typescript
try {
  const docRef = doc(db, 'collection', 'docId')
  const docSnap = await getDoc(docRef)
  
  if (!docSnap.exists()) {
    throw new Error('Document not found')
  }
  
  return { data: docSnap.data(), error: null }
} catch (error) {
  console.error('Firestore error:', error)
  return { data: null, error: error as Error }
}
```

---

## Deployment & Environment

### Environment Variables

```env
# .env.example
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_STRIPE_PUBLIC_KEY=your_stripe_key
```

### Build Process

```bash
# Development
npm run dev          # Start dev server on :3000

# Production
npm run build        # TypeScript compile + Vite build
npm run preview      # Preview production build

# Code Quality
npm run lint         # ESLint
npm run format       # Prettier
```

### Deployment Targets

- **Frontend**: Vercel, Netlify, or Firebase Hosting
- **Backend**: Firebase (managed Firestore + Cloud Functions)
- **Storage**: Firebase Storage

### Performance Considerations

1. **Code Splitting**
   - Lazy load route components
   - Dynamic imports for heavy features

2. **Asset Optimization**
   - Image optimization
   - Tree-shaking unused code
   - Minification in production

3. **Caching**
   - Browser caching for static assets
   - Service worker for offline support (future)

---

## Development Workflow

### Adding a New Feature

1. **Create Types** (if needed)
   ```typescript
   // src/types/index.ts
   export interface MyFeature { ... }
   ```

2. **Create Service** (if API needed)
   ```typescript
   // src/services/myFeatureService.ts
   export const getMyFeature = async () => { ... }
   ```

3. **Create Hook** (if reusable logic)
   ```typescript
   // src/hooks/useMyFeature.ts
   export const useMyFeature = () => { ... }
   ```

4. **Create Component**
   ```typescript
   // src/pages/myFeature/MyFeaturePage.tsx
   export const MyFeaturePage = () => { ... }
   ```

5. **Add Route**
   ```typescript
   // src/routes/index.tsx
   <Route path="/my-feature" element={<MyFeaturePage />} />
   ```

### Code Standards

- **TypeScript strict mode** - No implicit any
- **Functional components** - Use hooks, not classes
- **Props destructuring** - Clear component interfaces
- **Error boundaries** - Wrap critical sections
- **Loading states** - Always show loading feedback
- **Empty states** - Handle no-data scenarios

---

## Security Best Practices

1. **Input Validation**
   - Validate all user inputs
   - Sanitize before database operations
   - Use TypeScript for type safety

2. **Authentication**
   - Secure token storage
   - Automatic session timeout
   - CSRF protection

3. **Authorization**
   - Check permissions on every request
   - RLS policies in database
   - Role-based UI rendering

4. **Data Protection**
   - HTTPS only in production
   - Encrypted data at rest
   - Secure environment variables

5. **XSS Prevention**
   - React's built-in XSS protection
   - Sanitize user-generated content
   - CSP headers

---

## Future Enhancements

### Planned Features
- [ ] Progressive Web App (PWA)
- [ ] Offline support
- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] AI-powered recommendations
- [ ] Mobile native apps (React Native)

### Performance Improvements
- [ ] Implement code splitting
- [ ] Add service worker
- [ ] Optimize bundle size
- [ ] Implement virtual scrolling for long lists
- [ ] Add request caching layer

### Developer Experience
- [ ] Storybook for component library
- [ ] Unit testing with Vitest
- [ ] E2E testing with Playwright
- [ ] CI/CD pipeline
- [ ] Automated deployments

---

## Conclusion

This architecture provides a solid foundation for building a scalable, maintainable leadership transformation platform. The modular structure, clear separation of concerns, and type-safe codebase enable rapid feature development while maintaining code quality.

For questions or clarifications, refer to the main README.md or consult the inline code documentation.
