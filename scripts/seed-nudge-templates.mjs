import admin from 'firebase-admin'

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id,
  })
}

const db = admin.firestore()
const { serverTimestamp } = admin.firestore.FieldValue

const templates = [
  {
    name: 'Initial Outreach: Welcome Back',
    subject: 'We’re glad you’re here at {{organizationName}}',
    message_body:
      'Hi {{userName}}, we noticed you’ve been away for {{daysInactive}} days. Let’s get you reconnected with your goals.',
    template_type: 'Initial Outreach',
    target_audience: 'Newly inactive users',
    is_active: true,
  },
  {
    name: 'Follow-up: Gentle Reminder',
    subject: 'Checking in from {{organizationName}}',
    message_body:
      'Hi {{userName}}, just a quick reminder to jump back in. Your engagement score is {{engagementScore}}—we can help boost it.',
    template_type: 'Follow-up',
    target_audience: 'Users awaiting response',
    is_active: true,
  },
  {
    name: 'Critical Alert: Immediate Attention',
    subject: 'Action needed to stay on track',
    message_body:
      '{{userName}}, your engagement score dropped to {{engagementScore}} and you’ve been inactive for {{daysInactive}} days. Let’s create a quick recovery plan today.',
    template_type: 'Critical Alert',
    target_audience: 'High-risk users',
    is_active: true,
  },
  {
    name: 'Encouragement: Keep Going',
    subject: 'You’re making progress at {{organizationName}}',
    message_body:
      'Great job {{userName}}! Your engagement score is improving at {{engagementScore}}. Keep up the momentum this week.',
    template_type: 'Encouragement',
    target_audience: 'Improving users',
    is_active: true,
  },
  {
    name: 'Resource Sharing: Helpful Tips',
    subject: 'Resources to support your next steps',
    message_body:
      'Hi {{userName}}, here are curated resources to help you re-engage after {{daysInactive}} days. Let us know what you need.',
    template_type: 'Resource Sharing',
    target_audience: 'Users requesting guidance',
    is_active: true,
  },
]

const seedTemplates = async () => {
  console.log('Seeding nudge templates...')

  let created = 0
  for (const template of templates) {
    const existing = await db.collection('nudge_templates').where('name', '==', template.name).limit(1).get()
    if (!existing.empty) {
      console.log(`Skipping existing template: ${template.name}`)
      continue
    }

    await db.collection('nudge_templates').add({
      ...template,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
    created += 1
    console.log(`Created template: ${template.name}`)
  }

  console.log(`Seed complete. Created ${created} templates.`)
}

seedTemplates().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
