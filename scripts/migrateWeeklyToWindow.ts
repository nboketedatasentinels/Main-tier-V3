import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, CollectionReference } from 'firebase-admin/firestore';
import 'dotenv/config';
import { getWindowNumber, getWindowRange } from '../src/utils/windowCalculations';
import { JourneyType, JOURNEY_META } from '../src/config/pointsConfig';

// Initialize Firebase Admin SDK
// Ensure you have the service account key file and have set the GOOGLE_APPLICATION_CREDENTIALS environment variable
try {
    initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string)),
        databaseURL: `https://${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`
    });
} catch (error) {
    if ((error as any).code !== 'app/duplicate-app') {
        console.error("Firebase Admin initialization failed. Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set in your .env file.");
        process.exit(1);
    }
}


const db = getFirestore();

interface WeeklyProgress {
    uid: string;
    weekNumber: number;
    pointsEarned: number;
    weeklyTarget: number;
    journeyType?: JourneyType;
}

interface WindowProgress {
    uid: string;
    windowNumber: number;
    pointsEarned: number;
    windowTarget: number;
    status: 'on_track' | 'warning' | 'alert';
}

async function migrateWeeklyToWindow() {
    console.log("Starting migration from weeklyProgress to windowProgress...");

    const weeklyProgressRef = db.collection('weeklyProgress') as CollectionReference<WeeklyProgress>;
    const snapshot = await weeklyProgressRef.get();

    if (snapshot.empty) {
        console.log("No documents found in weeklyProgress collection. Nothing to migrate.");
        return;
    }

    console.log(`Found ${snapshot.size} documents in weeklyProgress.`);

    const userWindowAggregates: Map<string, WindowProgress> = new Map();

    for (const doc of snapshot.docs) {
        const weeklyData = doc.data();
        const { uid, weekNumber, pointsEarned, weeklyTarget = 250 } = weeklyData;

        if (!uid || typeof weekNumber !== 'number') {
            console.warn(`Skipping document with invalid data: ${doc.id}`);
            continue;
        }

        const windowNumber = getWindowNumber(weekNumber);
        const aggregateKey = `${uid}__${windowNumber}`;

        if (!userWindowAggregates.has(aggregateKey)) {
            // Assume journeyType from profile or default, since it's not on all weekly docs
            const journeyType = weeklyData.journeyType || '6W';
            const programDurationWeeks = JOURNEY_META[journeyType]?.weeks || 52;
            const { windowWeeks } = getWindowRange(weekNumber, programDurationWeeks);

            userWindowAggregates.set(aggregateKey, {
                uid,
                windowNumber,
                pointsEarned: 0,
                windowTarget: weeklyTarget * windowWeeks,
                status: 'alert',
            });
        }

        const aggregateData = userWindowAggregates.get(aggregateKey)!;
        aggregateData.pointsEarned += pointsEarned;
    }

    console.log(`Aggregated into ${userWindowAggregates.size} window progress documents.`);

    const batch = db.batch();
    let writeCount = 0;

    for (const [key, windowData] of userWindowAggregates.entries()) {
        const { pointsEarned, windowTarget } = windowData;
        const ratio = windowTarget > 0 ? pointsEarned / windowTarget : 0;

        let status: 'on_track' | 'warning' | 'alert' = 'alert';
        if (ratio >= 1) {
            status = 'on_track';
        } else if (ratio >= 0.75) {
            status = 'warning';
        }
        windowData.status = status;

        const windowDocRef = db.collection('windowProgress').doc(key);
        batch.set(windowDocRef, { ...windowData, migratedAt: new Date() }, { merge: true });
        writeCount++;
    }

    await batch.commit();
    console.log(`Successfully migrated ${writeCount} documents to windowProgress collection.`);
}

migrateWeeklyToWindow().catch(error => {
    console.error("Migration script failed:", error);
    process.exit(1);
});
