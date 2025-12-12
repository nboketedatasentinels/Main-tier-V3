import admin from 'firebase-admin'
import { UserRole } from '../src/types'
import { normalizeUserRole } from '../src/utils/roles'

const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })

const db = app.firestore()
const profiles = db.collection('profiles')

const run = async () => {
  const snapshot = await profiles.get()
  const updates: Array<Promise<unknown>> = []
  const report: Array<{ id: string; rawRole: unknown; normalized: UserRole | null }> = []

  snapshot.forEach((doc) => {
    const data = doc.data()
    const rawRole = data.role
    const normalized = normalizeUserRole(rawRole)

    report.push({ id: doc.id, rawRole, normalized })

    if (!normalized) {
      console.warn(`[audit] ${doc.id} has invalid role`, { rawRole })
      return
    }

    if (rawRole !== normalized) {
      console.log(`[fix] updating ${doc.id} role to ${normalized} (was ${rawRole})`)
      updates.push(
        doc.ref.update({
          role: normalized,
          roleAudit: {
            previous: rawRole ?? null,
            normalized,
            auditedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        })
      )
    }
  })

  await Promise.all(updates)
  console.log(`Processed ${report.length} profiles, updated ${updates.length}`)
}

run()
  .then(() => {
    console.log('Role audit complete.')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
