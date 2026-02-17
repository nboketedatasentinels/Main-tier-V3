import { collection, getDocs } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { checkAndHandleJourneyCompletion } from '../src/services/journeyCompletionService';
import { JourneyType } from '../src/config/pointsConfig';

async function checkRetroactiveCompletions() {
  console.log('Starting retroactive journey completion check...');

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnap.size} users to check.`);

    let processedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const journeyType = userData.journeyType as JourneyType;

      if (journeyType && userData.journeyStatus !== 'completed') {
        console.log(`Checking user ${userId} (${journeyType})...`);

        // We can't easily wait for the side effects here if we're doing it in bulk,
        // but checkAndHandleJourneyCompletion is async.
        await checkAndHandleJourneyCompletion(userId, journeyType);

        processedCount++;
      }
    }

    console.log(`Finished processing ${processedCount} users.`);
  } catch (error) {
    console.error('Error during retroactive check:', error);
  }
}

checkRetroactiveCompletions()
  .then(() => {
    console.log('Retroactive check complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
