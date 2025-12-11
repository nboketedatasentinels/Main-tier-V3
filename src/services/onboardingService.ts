import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { OnboardingAnalyticsEvent, OnboardingSnapshot, OnboardingStep } from '@/types/onboarding'

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome & Orientation',
    description: 'Watch the welcome video and agree to the learning pledge.',
    iconName: 'Video',
    order: 1,
    points: 150,
    items: [
      {
        id: 'welcome-video',
        title: 'Preview welcome message',
        description: 'Watch the welcome walkthrough and scroll to the end.',
        points: 100,
        link: 'https://www.youtube.com/watch?v=IxK0rcpKrKQ',
        microTask: {
          type: 'button',
          actionLabel: 'Play Intro Preview',
          successLabel: 'Great! You know how to launch the welcome video now.',
        },
      },
      {
        id: 'learning-agreement',
        title: 'Sign the learning agreement',
        description: 'A quick pledge to stay accountable during the sprint.',
        points: 120,
        microTask: {
          type: 'input',
          placeholder: 'Type your name to sign…',
          minLength: 2,
          multiline: false,
          helperText: 'A signature helps you commit to finishing strong.',
          successLabel: 'Agreement acknowledged!',
        },
      },
    ],
  },
  {
    id: 'community',
    title: 'Community & Calendar',
    description: 'Join the conversations and sync your calendar.',
    iconName: 'Chat',
    order: 2,
    points: 150,
    items: [
      {
        id: 'chat-group',
        title: 'Explore the chat group',
        description: 'Confirm you visited the WhatsApp or community chat.',
        points: 80,
        microTask: {
          type: 'confirm',
          actionLabel: "I've explored the chat",
          successLabel: 'Community awaits you—nice scouting mission!',
        },
      },
      {
        id: 'calendar-sync',
        title: 'Sync your calendar',
        description: 'Add our leadership huddles to your calendar.',
        points: 100,
        link: 'https://calendar.google.com',
      },
    ],
  },
  {
    id: 'activation',
    title: 'Activation Tasks',
    description: 'Take your first action toward transformation.',
    iconName: 'Spark',
    order: 3,
    points: 200,
    items: [
      {
        id: 'impact-log',
        title: 'Log your first impact',
        description: 'Submit a quick win using the impact tracker.',
        points: 150,
        microTask: {
          type: 'confirm',
          actionLabel: 'I logged an impact',
          successLabel: 'Impact logged! Keep the momentum.',
        },
      },
      {
        id: 'schedule-huddle',
        title: 'Schedule your first huddle',
        description: 'Plan your first leadership huddle with your team.',
        points: 120,
        microTask: {
          type: 'input',
          placeholder: 'Draft your invite message…',
          minLength: 10,
          multiline: true,
          successLabel: 'Huddle scheduled! Leadership awaits.',
        },
      },
    ],
  },
]

export const fetchOnboardingSteps = async (roleKey: string): Promise<OnboardingStep[]> => {
  const stepsRef = collection(db, 'onboarding_steps')
  const q = query(stepsRef, where('roles', 'array-contains', roleKey), orderBy('order', 'asc'))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return DEFAULT_STEPS

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as OnboardingStep[]
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
