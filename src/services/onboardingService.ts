import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { OnboardingAnalyticsEvent, OnboardingSnapshot, OnboardingStep } from '@/types/onboarding'

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome_paid',
    title: 'Welcome & Agreements',
    description: 'Start with orientation and commit to the learning pact.',
    iconName: 'Handshake',
    order: 1,
    points: 220,
    items: [
      {
        id: 'welcome-video',
        title: 'Watch the welcome walkthrough',
        description: 'Preview the onboarding journey and premium benefits.',
        points: 100,
        link: 'https://www.youtube.com/watch?v=IxK0rcpKrKQ',
        microTask: {
          type: 'button',
          actionLabel: 'Play Intro',
          successLabel: 'You’re oriented and ready to go!',
        },
      },
      {
        id: 'learning-agreement',
        title: 'Sign the learning agreement',
        description: 'Commit to finishing the first 14 days strong.',
        points: 120,
        microTask: {
          type: 'input',
          placeholder: 'Type your name to sign…',
          helperText: 'A signature keeps you accountable.',
          minLength: 2,
          multiline: false,
          successLabel: 'Agreement acknowledged!',
        },
      },
    ],
  },
  {
    id: 'community_paid',
    title: 'Community & Calendar',
    description: 'Join the conversations and plan your sessions.',
    iconName: 'CalendarClock',
    order: 2,
    points: 220,
    items: [
      {
        id: 'chat-group',
        title: 'Say hello in your cohort channel',
        description: 'Introduce yourself in the WhatsApp or Discord cohort space.',
        points: 100,
        microTask: {
          type: 'confirm',
          actionLabel: "I've greeted my cohort",
          successLabel: 'Community activated—nice intro!',
        },
      },
      {
        id: 'calendar-sync',
        title: 'Sync the huddle calendar',
        description: 'Add the leadership huddles and office hours to your calendar.',
        points: 120,
        link: 'https://calendar.google.com',
      },
    ],
  },
  {
    id: 'premium_setup',
    title: 'Premium Setup',
    description: 'Dive into premium resources and choose a focus path.',
    iconName: 'Sparkles',
    order: 3,
    points: 240,
    items: [
      {
        id: 'access-premium-library',
        title: 'Access the premium library',
        description: 'Open a premium playbook or course to bookmark your first lesson.',
        points: 120,
        link: 'https://t4l.world/premium-library',
        microTask: {
          type: 'confirm',
          actionLabel: 'I opened the library',
          successLabel: 'Premium content queued up!',
        },
      },
      {
        id: 'select-learning-path',
        title: 'Select your learning path',
        description: 'Choose the journey that matches your next leadership milestone.',
        points: 120,
        microTask: {
          type: 'input',
          placeholder: 'Which path did you pick?',
          helperText: 'e.g., Career growth, Team leadership, Product delivery…',
          minLength: 3,
          successLabel: 'Path saved—focus locked in.',
        },
      },
    ],
  },
  {
    id: 'huddles_accountability',
    title: 'Huddles & Accountability',
    description: 'Schedule your first huddle and set up a partner.',
    iconName: 'UsersRound',
    order: 4,
    points: 260,
    items: [
      {
        id: 'schedule-huddle',
        title: 'Schedule your first huddle',
        description: 'Book a 20-minute session to practice with peers.',
        points: 130,
        microTask: {
          type: 'input',
          placeholder: 'Drop your calendar invite text…',
          minLength: 10,
          multiline: true,
          successLabel: 'Huddle scheduled—see you there!',
        },
      },
      {
        id: 'accountability-partner',
        title: 'Set up accountability partner',
        description: 'Pair up with someone from your cohort and agree on check-ins.',
        points: 130,
        microTask: {
          type: 'confirm',
          actionLabel: 'Partner confirmed',
          successLabel: 'Accountability locked in.',
        },
      },
    ],
  },
  {
    id: 'impact_progress',
    title: 'Impact & Progress',
    description: 'Capture early wins and measure your momentum.',
    iconName: 'Activity',
    order: 5,
    points: 260,
    items: [
      {
        id: 'impact-log',
        title: 'Log your first impact',
        description: 'Use the impact tracker to submit a quick win.',
        points: 130,
        microTask: {
          type: 'confirm',
          actionLabel: 'I logged an impact',
          successLabel: 'Impact logged—keep going!',
        },
      },
      {
        id: 'set-impact-goal',
        title: 'Set your 14-day impact goal',
        description: 'Write a measurable outcome you want to reach in two weeks.',
        points: 130,
        microTask: {
          type: 'input',
          placeholder: 'Describe your goal…',
          minLength: 10,
          multiline: true,
          successLabel: 'Goal captured—aim high!',
        },
      },
    ],
  },
]

export const fetchOnboardingSteps = async (roleKey: string): Promise<OnboardingStep[]> => {
  try {
    const stepsRef = collection(db, 'onboarding_steps')
    const q = query(stepsRef, where('roles', 'array-contains', roleKey), orderBy('order', 'asc'))
    const snapshot = await getDocs(q)

    if (snapshot.empty) return DEFAULT_STEPS

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as OnboardingStep[]
  } catch (error) {
    console.error('Error fetching onboarding steps; falling back to defaults.', error)
    return DEFAULT_STEPS
  }
}

export const fetchOnboardingProgress = async (
  userId: string,
): Promise<OnboardingSnapshot | null> => {
  const progressRef = doc(db, 'onboarding_progress', userId)
  const progressSnap = await getDoc(progressRef)

  if (!progressSnap.exists()) {
    const initial: OnboardingSnapshot = {
      completedSteps: [],
      completedItems: [],
      totalPoints: 0,
      onboardingStartTime: new Date().toISOString(),
      pointsDeducted: false,
      pointsDeductedAmount: null,
      onboardingComplete: false,
      onboardingSkipped: false,
      updatedAt: new Date().toISOString(),
      lastStepId: null,
    }

    await setDoc(progressRef, initial)
    return initial
  }

  return progressSnap.data() as OnboardingSnapshot
}

export const persistOnboardingProgress = async (userId: string, progress: OnboardingSnapshot) => {
  const batch = writeBatch(db)
  const progressRef = doc(db, 'onboarding_progress', userId)
  const userRef = doc(db, 'profiles', userId)

  batch.set(progressRef, {
    ...progress,
    updatedAt: serverTimestamp(),
  })

  batch.set(
    userRef,
    {
      onboardingSnapshot: progress,
      isOnboarded: progress.onboardingComplete,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  if (progress.totalPoints) {
    const pointsRef = doc(collection(db, 'user_points'))
    batch.set(pointsRef, {
      userId,
      source: 'onboarding',
      points: progress.totalPoints,
      recordedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

export const logOnboardingAnalytics = async (event: OnboardingAnalyticsEvent) => {
  const analyticsRef = doc(collection(db, 'onboarding_analytics'))
  await setDoc(analyticsRef, event)
}

export const applyDeadlinePenalty = async (userId: string, amount: number) => {
  const progressRef = doc(db, 'onboarding_progress', userId)
  const userPointsRef = doc(collection(db, 'user_points'))
  const batch = writeBatch(db)

  batch.update(progressRef, {
    pointsDeducted: true,
    pointsDeductedAmount: amount,
  })

  batch.set(userPointsRef, {
    userId,
    source: 'onboarding_deadline',
    points: amount,
    recordedAt: serverTimestamp(),
  })

  await batch.commit()
}
