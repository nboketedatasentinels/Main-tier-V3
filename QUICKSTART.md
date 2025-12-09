# T4L Platform - Quick Start Guide

## Prerequisites
- Node.js 18 or higher
- npm or yarn
- A Supabase account (free tier is fine for development)
- Git

## Setup Steps

### 1. Clone and Install
```bash
git clone <repository-url>
cd Man-tier-v2
npm install
```

### 2. Set Up Supabase
1. Go to https://supabase.com and create a new project
2. Wait for the project to finish setting up (~2 minutes)
3. Navigate to Project Settings > API
4. Copy your Project URL and anon/public key

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database
1. In Supabase dashboard, go to SQL Editor
2. Create a new query
3. Copy the contents of `database/schema.sql`
4. Run the query to create all tables

### 5. Start Development Server
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
4. Check your Supabase dashboard > Authentication > Users to see the new user

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
├── services/        # API/Supabase
├── theme/           # Chakra UI theme
├── types/           # TypeScript types
└── App.tsx          # Root component
```

## Key Files

- **`src/types/index.ts`** - All TypeScript types
- **`src/theme/index.ts`** - T4L brand colors and Chakra theme
- **`src/routes/index.tsx`** - All application routes
- **`src/contexts/AuthContext.tsx`** - Authentication logic
- **`database/schema.sql`** - Database schema

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

1. In Supabase dashboard, go to Table Editor > profiles
2. Find your test user
3. Change the `role` field to different values:
   - `free_user` → /dashboard/free
   - `paid_member` → /dashboard/member
   - `mentor` → /dashboard/mentor
   - `ambassador` → /dashboard/ambassador
   - `company_admin` → /dashboard/company-admin
   - `super_admin` → /dashboard/super-admin

4. Logout and login again to see the new dashboard

### Test Authentication Flows

**Password Reset:**
1. Go to /reset-password
2. Enter your email
3. Check Supabase for the reset email (or check logs)

**Magic Link:**
1. On login page, enter email and click "Send Magic Link"
2. Check your email for the login link

## Common Issues

### "Failed to fetch" error
- Check that Supabase URL and key are correct in `.env`
- Verify your Supabase project is running
- Check browser console for CORS errors

### "Table does not exist" error
- Run the `database/schema.sql` in Supabase SQL Editor
- Verify all tables were created in Table Editor

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
3. Look at `database/schema.sql` to understand data model
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
