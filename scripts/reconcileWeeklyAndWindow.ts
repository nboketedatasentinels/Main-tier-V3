import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, CollectionReference } from 'firebase-admin/firestore';
import 'dotenv/config';
import { getWindowNumber, getWindowRange } from '../src/utils/windowCalculations';
import { JourneyType, JOURNEY_META } from '../src/config/pointsConfig';

// Initialize Firebase Admin SDK
try {
    initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string)),
        databaseURL: `https://${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`
    });
} catch (error) {
    const errorCode = (error as { code?: string })?.code
    if (errorCode !== 'app/duplicate-app') {
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
    uid:string;
    windowNumber: number;
    pointsEarned: number;
    windowTarget: number;
}

async function reconcileData() {
    console.log("Starting reconciliation between weeklyProgress and windowProgress...");

    // 1. Aggregate weeklyProgress data
    const weeklyProgressRef = db.collection('weeklyProgress') as CollectionReference<WeeklyProgress>;
    const weeklySnapshot = await weeklyProgressRef.get();
    const weeklyAggregates: Map<string, Partial<WindowProgress>> = new Map();

    for (const doc of weeklySnapshot.docs) {
        const weeklyData = doc.data();
        const { uid, weekNumber, pointsEarned, weeklyTarget = 250 } = weeklyData;

        if (!uid || typeof weekNumber !== 'number') continue;

        const windowNumber = getWindowNumber(weekNumber);
        const aggregateKey = `${uid}__${windowNumber}`;

        if (!weeklyAggregates.has(aggregateKey)) {
            const journeyType = weeklyData.journeyType || '6W';
            const programDurationWeeks = JOURNEY_META[journeyType]?.weeks || 52;
            const { windowWeeks } = getWindowRange(weekNumber, programDurationWeeks);

            weeklyAggregates.set(aggregateKey, {
                uid,
                windowNumber,
                pointsEarned: 0,
                windowTarget: weeklyTarget * windowWeeks,
            });
        }

        const aggregate = weeklyAggregates.get(aggregateKey)!;
        aggregate.pointsEarned! += pointsEarned;
    }
    console.log(`Aggregated ${weeklySnapshot.size} weekly documents into ${weeklyAggregates.size} window aggregates.`);

    // 2. Fetch windowProgress data
    const windowProgressRef = db.collection('windowProgress') as CollectionReference<WindowProgress>;
    const windowSnapshot = await windowProgressRef.get();
    const windowDataMap: Map<string, WindowProgress> = new Map();
    windowSnapshot.docs.forEach(doc => windowDataMap.set(doc.id, doc.data()));
    console.log(`Fetched ${windowSnapshot.size} documents from windowProgress.`);

    // 3. Compare and find discrepancies
    let discrepancies = 0;
    for (const [key, weeklyAggregate] of weeklyAggregates.entries()) {
        const windowData = windowDataMap.get(key);

        if (!windowData) {
            console.error(`Discrepancy: Missing windowProgress document for key: ${key}`);
            discrepancies++;
            continue;
        }

        if (weeklyAggregate.pointsEarned !== windowData.pointsEarned) {
            console.error(`Discrepancy for ${key}: weekly points (${weeklyAggregate.pointsEarned}) != window points (${windowData.pointsEarned})`);
            discrepancies++;
        }

        if (weeklyAggregate.windowTarget !== windowData.windowTarget) {
            console.error(`Discrepancy for ${key}: weekly target (${weeklyAggregate.windowTarget}) != window target (${windowData.windowTarget})`);
            discrepancies++;
        }
    }

    console.log("Reconciliation complete.");
    if (discrepancies === 0) {
        console.log("✅ Success: No discrepancies found between weekly and window progress data.");
    } else {
        console.error(`❌ Found ${discrepancies} discrepancies.`);
        process.exit(1);
    }
}

reconcileData().catch(error => {
    console.error("Reconciliation script failed:", error);
    process.exit(1);
});
