# T4L - Transformation 4 Leaders

A comprehensive leadership transformation and professional development platform built with modern web technologies.

## 🎯 Overview

T4L (Transformation 4 Leaders) is a full-stack web application designed to facilitate leadership development through:

- **Structured Learning Journeys**: 4-week to 12-month transformation programs
- **Gamification**: Points, badges, levels, and leaderboards
- **Impact Tracking**: Log and visualize professional and personal impact
- **Community Features**: Villages, peer matching, book clubs, and leadership councils
- **Role-Based Dashboards**: Tailored experiences for different user roles
- **Analytics**: Personal and organizational performance tracking

## 🛠️ Tech Stack

### Frontend
- **React 18** with **TypeScript**
- **React Router v6** for navigation
- **Chakra UI** for components
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for data visualization
- **Lucide React** for icons
- **Intro.js** for guided tours
- **date-fns** for date manipulation
- **Canvas Confetti** for celebratory effects

### Backend & Database
- **Firebase** (Firestore) for database and authentication
- **Firebase Cloud Functions** for serverless logic
- **Firebase Storage** for file uploads
- Real-time subscriptions

### Payments & Email
- **Stripe** for payment processing
- **SendGrid** for transactional emails

## 🎨 Brand Colors

The application uses a distinctive color palette:

- **Deep Plum**: `#27062e` - Primary brand base and hero accents
- **Flame Orange**: `#f4540c` - CTAs and primary actions
- **Royal Purple**: `#350e6f` - Secondary accents and cards
- **Gold**: `#eab130` - Achievement colors and success states
- **Soft Gold**: `#f9db59` - Gradients and subtle highlights

## 📁 Project Structure

```
src/
├── components/      # Reusable UI components
├── contexts/        # React contexts (Auth, etc.)
├── hooks/           # Custom React hooks
├── layouts/         # Page layouts (Main, Auth)
├── pages/           # Page components
│   ├── auth/        # Authentication pages
│   ├── dashboards/  # Role-based dashboards
│   ├── journeys/    # Journey management
│   ├── impact/      # Impact logging
│   ├── leaderboard/ # Leaderboards
│   └── ...
├── routes/          # Route configuration
├── services/        # API services
├── theme/           # Chakra UI theme
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase account
- Stripe account (for payments)
- SendGrid account (for emails)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Chalebgwa/Man-tier-v2.git
   cd Man-tier-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your configuration:
   - `VITE_FIREBASE_API_KEY`: Your Firebase API key
   - `VITE_FIREBASE_AUTH_DOMAIN`: Your Firebase auth domain
   - `VITE_FIREBASE_PROJECT_ID`: Your Firebase project ID
   - `VITE_FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase messaging sender ID
   - `VITE_FIREBASE_APP_ID`: Your Firebase app ID
   - `VITE_STRIPE_PUBLIC_KEY`: Your Stripe publishable key

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🏗️ Building for Production

```bash
npm run build
```

The build output will be in the `dist` directory.

## 👥 User Roles

The platform supports six distinct user roles:

1. **Free Users**: Basic access to explore features
2. **Paid Members**: Full access to journeys and courses
3. **Mentors**: Guide and support learners
4. **Ambassadors**: Community leadership and referrals
5. **Company Admins**: Manage organizational users
6. **Super Admins**: Platform-wide administration

## 🎓 Key Features

### Journeys
- 4-Week Intro Journey
- 6-Week Sprint
- 3-Month, 6-Month, 9-Month, and 12-Month Journeys
- Custom journey builder

### Gamification
- Points system with minimum points required per week (with clear caps)
- Achievement badges
- Global, company, village, and cluster leaderboards
- Challenge system

### Impact Tracking
- Log hours invested, USD value, and people impacted
- Categorize by ESG and business categories
- Visualize with charts and analytics
- Export to CSV

### Community
- Villages and clusters
- Peer matching
- Book clubs
- Leadership councils

## 🔒 Security

- Firestore Security Rules for data access control
- Role-based access control (RBAC)
- Input validation and sanitization
- Encrypted data at rest and in transit
- Secure authentication flows with Firebase Auth

## 📝 Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🤝 Contributing

This project follows best practices for:

- TypeScript strict mode
- Component-based architecture
- Accessibility (WCAG 2.1 AA)
- Mobile-first responsive design
- Error handling and loading states

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with modern web technologies and best practices to deliver a world-class leadership development platform.
