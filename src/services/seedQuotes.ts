import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { leadershipQuotes } from './quotes';

export const seedInspirationQuotes = async () => {
  const quotesCollection = collection(db, 'inspiration_quotes');
  console.log('Starting to seed inspiration quotes...');

  for (const quote of leadershipQuotes) {
    try {
      const q = query(quotesCollection, where('week_number', '==', quote.week_number));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await addDoc(quotesCollection, quote);
        console.log(`Quote for week ${quote.week_number} has been added.`);
      } else {
        console.log(`Quote for week ${quote.week_number} already exists. Skipping.`);
      }
    } catch (error) {
      console.error(`Error processing quote for week ${quote.week_number}:`, error);
    }
  }
  console.log('Seeding complete.');
};
