# T4L Platform - Quick Start Guide

## Prerequisites
- Node.js 18 or higher
- npm or yarn
- A Firebase account (free tier is fine for development)
- Git

## Setup Steps

### 1. Clone and Install
```bash
git clone <repository-url>
cd Man-tier-v2
npm install
```

### 2. Set Up Firebase
1. Go to https://console.firebase.google.com and create a new project
2. Enable Firestore Database (Start in production mode)
3. Enable Authentication > Email/Password provider
4. Go to Project Settings > General
5. Copy your Firebase configuration values

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# To create one or more super admins on first login, add their emails here.
# For example: VITE_BOOTSTRIP_ADMIN_EMAILS=admin1@example.com,admin2@example.com
VITE_BOOTSTRIP_ADMIN_EMAILS=
```

### 4. Set Up Firestore Security Rules
1. In Firebase console, go to Firestore Database > Rules
2. Copy the security rules from `firestore.rules` at the root of the project.
3. Publish the rules. The new rules fix a critical bug that prevented admins from logging in.

### 5. Creating an Admin Account
There are two ways to create a Super Admin:

**A) Environment Variable (Recommended for setup)**
1.  Open your `.env` file.
2.  Add the email of the user you want to be an admin to the `VITE_BOOTSTRIP_ADMIN_EMAILS` variable.
3.  When that user signs up or logs in for the first time, they will automatically be granted the Super Admin role.

**B) Manual Promotion (After setup)**
1.  Have the user sign up for a regular account.
2.  Go to your Firebase Console > Firestore Database.
3.  Navigate to the `profiles` collection and find the user's document by their UID.
4.  Edit the `role` field and set it to `super_admin`.

### 6. Start Development Server
```bash
npm run dev
```

The app will open at http://localhost:3000

## First Test

### Create a Test Account
1. Go to http://localhost:3000/signup
2. Fill in the form:
   - First Name: Test
   - Last Name: User
   - Email: test@example.com
   - Password: test123
3. Click "Sign Up"
4. Check your Firebase console > Authentication to see the new user

### Login
1. Go to http://localhost:3000/login
2. Enter the credentials you just created
3. You should be redirected to the Free User Dashboard

## Project Structure

```
src/
├── components/      # Reusable components
│   └── ProtectedRoute.tsx
├── contexts/        # React contexts
│   ├── AuthContextType.ts
│   └── AuthContext.tsx
├── hooks/           # Custom hooks
│   └── useAuth.ts
├── layouts/         # Page layouts
│   ├── MainLayout.tsx (logged in)
│   └── AuthLayout.tsx (login/signup)
├── pages/           # Route pages
│   ├── auth/        # Login, signup, reset
│   ├── dashboards/  # Role-based dashboards
│   └── ...
├── routes/          # Route configuration
├── services/        # API/Firebase
├── theme/           # Chakra UI theme
├── types/           # TypeScript types
└── App.tsx          # Root component
```

## Key Files

- **`src/types/index.ts`** - All TypeScript types
- **`src/theme/index.ts`** - T4L brand colors and Chakra theme
- **`src/routes/index.tsx`** - All application routes
- **`src/contexts/AuthContext.tsx`** - Authentication logic
- **`src/services/firebase.ts`** - Firebase configuration
- **`database/firestore-schema.md`** - Database schema

## Available Scripts

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
```

## Testing the App

### Test Role-Based Access
The app has 6 user roles. To test different dashboards:

1. In Firebase console, go to Firestore Database
2. Navigate to the `profiles` collection
3. Find your test user document
4. Edit the `role` field to different values:
   - `free_user` → /dashboard/free
   - `paid_member` → /dashboard/member
   - `mentor` → /dashboard/mentor
   - `ambassador` → /dashboard/ambassador
   - `company_admin` → /dashboard/company-admin
   - `super_admin` → /dashboard/super-admin

5. Logout and login again to see the new dashboard

### Test Authentication Flows

**Password Reset:**
1. Go to /reset-password
2. Enter your email
3. Check your email for the reset link from Firebase

**Magic Link:**
1. On login page, enter email and click "Send Magic Link"
2. Check your email for the login link

## Common Issues

### "Failed to fetch" error
- Check that Firebase configuration is correct in `.env`
- Verify your Firebase project has Authentication enabled
- Check browser console for CORS errors

### "Permission denied" error
- Ensure Firestore Security Rules are properly configured
- Verify user is authenticated
- Check that the user's profile document exists in Firestore

### Linting errors
- Run `npm run lint` to see errors
- Run `npm run format` to auto-fix formatting
- Check that imports follow the pattern in existing files

### Build errors
- Delete `node_modules` and run `npm install` again
- Clear Vite cache: `rm -rf node_modules/.vite`
- Check that all imports use `@/` path alias correctly

## Next Steps

Once you have the app running:

1. Review `ARCHITECTURE.md` for technical details
2. Check `README.md` for feature list
3. Look at `database/firestore-schema.md` to understand data model
4. Start building features from the roadmap in the PR description

## Getting Help

- Check the ARCHITECTURE.md for detailed technical info
- Review the inline code comments
- Look at existing components for patterns
- Check the problem statement in the PR for requirements

## Development Workflow

1. Create a new branch for your feature
2. Build the feature following existing patterns
3. Run `npm run lint` and `npm run build` to verify
4. Test the feature in the browser
5. Commit with clear messages
6. Push and create a PR

Happy coding! 🚀
