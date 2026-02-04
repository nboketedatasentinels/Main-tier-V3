import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./service-account-key.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Collections to clear
const USER_DATA_COLLECTIONS = [
  'profiles',
  'journeys',
  'weeklyProgress',
  'windowProgress',
  'checklists',
  'impact_logs',
  'notifications',
  'nudges_sent',
  'nudge_effectiveness',
  'upgrade_requests',
  'interventions',
  'leaderboards',
  'villages',
  'clusters'
];

/**
 * Delete all documents in a collection in batches
 * Firebase limits batch writes to 500 operations
 */
async function clearCollection(collectionName) {
  const collectionRef = db.collection(collectionName);
  const batchSize = 500;
  let totalDeleted = 0;

  console.log(`\n🔥 Clearing collection: ${collectionName}`);

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();

    if (snapshot.empty) {
      console.log(`✅ ${collectionName}: ${totalDeleted} documents deleted`);
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;

    console.log(`   Deleted batch of ${snapshot.size} (total: ${totalDeleted})`);

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Clear subcollections (if any exist under user documents)
 */
async function clearSubcollections(parentCollection, subcollectionName) {
  console.log(`\n🔍 Checking subcollections: ${parentCollection}/${subcollectionName}`);

  const parentDocs = await db.collection(parentCollection).limit(500).get();

  if (parentDocs.empty) {
    console.log(`   No parent documents found in ${parentCollection}`);
    return;
  }

  let totalDeleted = 0;

  for (const parentDoc of parentDocs.docs) {
    const subcollectionRef = parentDoc.ref.collection(subcollectionName);
    const snapshot = await subcollectionRef.limit(500).get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      totalDeleted += snapshot.size;
    }
  }

  if (totalDeleted > 0) {
    console.log(`✅ Deleted ${totalDeleted} documents from ${parentCollection}/*/${subcollectionName}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚨 USER DATA CLEARING SCRIPT');
  console.log('=============================\n');
  console.log('⚠️  This will DELETE ALL documents from user-data collections');
  console.log('⚠️  Collections themselves will remain intact');
  console.log('⚠️  Press Ctrl+C within 5 seconds to abort\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const startTime = Date.now();

  try {
    // Clear main collections
    for (const collection of USER_DATA_COLLECTIONS) {
      await clearCollection(collection);
    }

    // Clear known subcollections (adjust based on your schema)
    // Example: if journeys have subcollections
    // await clearSubcollections('journeys', 'activities');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ USER DATA CLEARED in ${duration}s`);
    console.log('   Collections preserved, all documents deleted');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
