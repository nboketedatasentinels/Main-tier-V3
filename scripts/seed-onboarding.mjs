import admin from 'firebase-admin'
import { readFile } from 'node:fs/promises'

const { GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID } = process.env

async function initializeFirebase() {
  if (admin.apps.length) return admin.app()

  try {
    let credential

    if (FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT)
      credential = admin.credential.cert(serviceAccount)
    } else if (GOOGLE_APPLICATION_CREDENTIALS) {
      const file = await readFile(GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
      credential = admin.credential.cert(JSON.parse(file))
    } else {
      throw new Error('Service account credentials not provided. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.')
    }

    return admin.initializeApp({
      credential,
      projectId: FIREBASE_PROJECT_ID,
    })
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error)
    throw error
  }
}

const freeSteps = [
  {
    id: 'orientation_free',
    title: 'Welcome & Orientation',
    description: 'Preview the platform and learn how to unlock more value.',
    iconName: 'Compass',
    order: 1,
    points: 120,
    items: [
      {
        id: 'watch-welcome-preview',
        title: 'Watch the welcome preview',
        description: 'View the intro walkthrough to understand the experience.',
        points: 60,
        link: 'https://www.youtube.com/watch?v=IxK0rcpKrKQ',
        microTask: {
          type: 'button',
          actionLabel: 'Play Preview',
          successLabel: 'Preview watched—nice start! 🎉',
        },
      },
      {
        id: 'see-upgrade-benefits',
        title: 'See what paid members unlock',
        description: 'Review premium benefits and decide when to upgrade.',
        points: 60,
        link: 'https://t4l.world/upgrade',
        microTask: {
          type: 'confirm',
          actionLabel: "I've reviewed the benefits",
          successLabel: 'Great! You know what’s waiting for you.',
        },
      },
    ],
  },
  {
    id: 'explore_free_resources',
    title: 'Explore Free Resources',
    description: 'Sample our starter content and tools.',
    iconName: 'BookOpen',
    order: 2,
    points: 140,
    items: [
      {
        id: 'browse-starter-toolkit',
        title: 'Browse the starter toolkit',
        description: 'Open the free resource library and mark one item to revisit.',
        points: 70,
        link: 'https://t4l.world/free-library',
        microTask: {
          type: 'confirm',
          actionLabel: 'I browsed the toolkit',
          successLabel: 'Toolkit explored—pick your next action!',
        },
      },
      {
        id: 'set-weekly-reminder',
        title: 'Set a weekly reminder',
        description: 'Add a 10-minute reminder to keep momentum for the next 2 weeks.',
        points: 70,
        microTask: {
          type: 'input',
          placeholder: 'Where did you set the reminder?',
          helperText: 'Calendar, phone, or task app all work.',
          minLength: 3,
          successLabel: 'Reminder logged—consistency wins.',
        },
      },
    ],
  },
  {
    id: 'community_free',
    title: 'Join the Community',
    description: 'Meet peers and find a space to ask questions.',
    iconName: 'Users',
    order: 3,
    points: 120,
    items: [
      {
        id: 'join-community-chat',
        title: 'Join a community chat',
        description: 'Pick a WhatsApp or Discord space to say hello.',
        points: 70,
        link: 'https://t4l.world/community',
        microTask: {
          type: 'confirm',
          actionLabel: "I've joined a chat",
          successLabel: 'Welcome aboard—introduce yourself when ready!',
        },
      },
      {
        id: 'share-upgrade-intent',
        title: 'Share what would make you upgrade',
        description: 'Tell us the one premium feature you’d try first.',
        points: 50,
        microTask: {
          type: 'input',
          placeholder: 'e.g., coaching huddles, accountability partner…',
          minLength: 3,
          successLabel: 'Noted! We’ll tailor recommendations.',
        },
      },
    ],
  },
]

const paidSteps = [
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

async function seedSteps(roleKey, steps) {
  const db = admin.firestore()
  const batch = db.batch()

  steps.forEach((step) => {
    const docRef = db.collection('onboarding_steps').doc(`${roleKey}_${step.id}`)
    batch.set(docRef, {
      ...step,
      roles: [roleKey],
      role: roleKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })

  await batch.commit()
  console.log(`Seeded ${steps.length} onboarding steps for role: ${roleKey}`)
}

async function main() {
  try {
    await initializeFirebase()
    await seedSteps('individual_free', freeSteps)
    await seedSteps('individual_paid', paidSteps)
    console.log('Onboarding seeding completed successfully.')
    process.exit(0)
  } catch (error) {
    console.error('Onboarding seeding failed:', error)
    process.exit(1)
  }
}

main()
