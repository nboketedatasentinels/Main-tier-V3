import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, CollectionReference } from 'firebase-admin/firestore';
import 'dotenv/config';
import { getWindowNumber, getWindowRange, PARALLEL_WINDOW_SIZE_WEEKS } from '../src/utils/windowCalculations';
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
    journeyType: JourneyType;
    windowNumber: number;
    pointsEarned: number;
    windowTarget: number;
    status: 'on_track' | 'warning' | 'alert' | 'recovery';
    previousStatus: 'on_track' | 'warning' | 'alert' | 'recovery';
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
        const { uid, weekNumber, pointsEarned } = weeklyData;

        if (!uid || typeof weekNumber !== 'number') {
            console.warn(`Skipping document with invalid data: ${doc.id}`);
            continue;
        }

        const windowNumber = getWindowNumber(weekNumber, PARALLEL_WINDOW_SIZE_WEEKS);
        const journeyType = weeklyData.journeyType || '6W';
        const aggregateKey = `${uid}__${journeyType}__${windowNumber}`;

        if (!userWindowAggregates.has(aggregateKey)) {
            const programDurationWeeks = JOURNEY_META[journeyType]?.weeks || 52;
            const { windowWeeks } = getWindowRange(weekNumber, programDurationWeeks, PARALLEL_WINDOW_SIZE_WEEKS);
            const weeklyTarget = JOURNEY_META[journeyType]?.weeklyTarget || 4000;

            userWindowAggregates.set(aggregateKey, {
                uid,
                journeyType,
                windowNumber,
                pointsEarned: 0,
                windowTarget: weeklyTarget * windowWeeks,
                status: 'alert',
                previousStatus: 'alert',
            });
        }

        const aggregateData = userWindowAggregates.get(aggregateKey)!;
        aggregateData.pointsEarned += pointsEarned;
    }

    console.log(`Aggregated into ${userWindowAggregates.size} window progress documents.`);

    const batch = db.batch();
    let writeCount = 0;

    for (const [key, windowData] of userWindowAggregates.entries()) {
        const { pointsEarned, windowTarget, previousStatus } = windowData;
        const ratio = windowTarget > 0 ? pointsEarned / windowTarget : 0;

        let status: 'on_track' | 'warning' | 'alert' | 'recovery' = 'alert';
        if (ratio >= 1) {
            status = 'on_track';
        } else if (ratio >= 0.75) {
            status = 'warning';
        }

        if (previousStatus === 'alert' && (status === 'on_track' || status === 'warning')) {
            status = 'recovery';
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
