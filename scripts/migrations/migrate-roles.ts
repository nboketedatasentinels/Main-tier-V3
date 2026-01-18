import * as admin from 'firebase-admin';
import { resolve } from 'path';

// Note: Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set or provide path to service account key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountPath) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(resolve(serviceAccountPath)),
});

const db = admin.firestore();

async function migrateRoles(dryRun = true) {
  console.log(`Starting role migration (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  const collections = ['profiles', 'users'];
  const stats = {
    profiles: { checked: 0, updated: 0 },
    users: { checked: 0, updated: 0 },
  };

  for (const collectionName of collections) {
    console.log(`\nProcessing collection: ${collectionName}`);
    const snapshot = await db.collection(collectionName).get();

    const batchSize = 500;
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const role = data.role;
      let newRole = null;

      if (role === 'admin' || role === 'company_admin') {
        newRole = 'partner';
      } else if (role === 'team_leader' || role === 'teamleader') {
        newRole = 'user';
      }

      stats[collectionName].checked++;

      if (newRole) {
        console.log(`  [${collectionName}] Mapping doc ${doc.id}: ${role} -> ${newRole}`);
        stats[collectionName].updated++;

        if (!dryRun) {
          batch.update(doc.ref, {
            role: newRole,
            role_migrated_from: role,
            role_migrated_at: admin.firestore.FieldValue.serverTimestamp()
          });
          count++;

          if (count >= batchSize) {
            await batch.commit();
            batch = db.batch();
            count = 0;
            console.log(`    Committed batch of ${batchSize} updates for ${collectionName}`);
          }
        }
      }
    }

    if (!dryRun && count > 0) {
      await batch.commit();
      console.log(`    Committed final batch of ${count} updates for ${collectionName}`);
    }
  }

  console.log('\nMigration Summary:');
  console.table(stats);
  console.log(`\nMigration finished (${dryRun ? 'DRY RUN' : 'LIVE'})`);
}

const isDryRun = process.argv.includes('--live') ? false : true;
migrateRoles(isDryRun).catch(console.error);
