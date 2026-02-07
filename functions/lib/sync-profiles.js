"use strict";
/**
 * Cloud Function: Sync Users to Profiles on Write
 *
 * This function automatically syncs user documents to the profiles collection
 * whenever a user document is created or updated.
 *
 * Deploy with:
 * firebase deploy --only functions:syncUserToProfile
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncProfilesNightly = exports.syncAuthUserToProfile = exports.syncUserToProfile = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
exports.syncUserToProfile = functions
    .region("us-central1")
    .firestore.document("users/{userId}")
    .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const userData = change.after.data();
    // If the document was deleted, optionally delete from profiles too
    if (!change.after.exists) {
        console.log(`User ${userId} deleted, cleaning up profile...`);
        try {
            await db.collection("profiles").doc(userId).delete();
            console.log(`Profile for user ${userId} deleted successfully`);
        }
        catch (error) {
            console.error(`Error deleting profile for user ${userId}:`, error);
            // Don't throw, as the user deletion is more important
        }
        return;
    }
    // Sync user data to profiles collection
    try {
        console.log(`Syncing user ${userId} to profiles collection...`);
        // userData is guaranteed to exist since change.after.exists is true
        if (!userData) {
            console.error(`User data is unexpectedly undefined for ${userId}`);
            return;
        }
        // Merge the user data into profiles collection
        // This ensures profiles always has the latest data from users
        await db.collection("profiles").doc(userId).set({
            ...userData,
            // Ensure timestamps are set correctly
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // Preserve createdAt from the source if it exists
            ...(userData.createdAt ? { createdAt: userData.createdAt } : {}),
        }, { merge: true });
        console.log(`✓ Successfully synced user ${userId} to profiles`);
    }
    catch (error) {
        console.error(`✗ Error syncing user ${userId} to profiles:`, error);
        // Log but don't throw - we don't want to fail the user write
        throw new functions.https.HttpsError("internal", `Failed to sync user to profiles: ${error}`);
    }
});
/**
 * Cloud Function: Sync Google Sign-In Users
 *
 * Syncs users created via Google Sign-In authentication to both collections.
 * This ensures OAuth users are also in the profiles collection.
 */
exports.syncAuthUserToProfile = functions
    .region("us-central1")
    .auth.user()
    .onCreate(async (user) => {
    const uid = user.uid;
    const email = user.email || "";
    const normalizedEmail = email.trim().toLowerCase();
    console.log(`New auth user created: ${uid} (${email})`);
    try {
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        // Check if user document already exists
        const userRef = db.collection("users").doc(uid);
        const userDoc = await userRef.get();
        let userDocExists = userDoc.exists;
        const normalizeStringArray = (value) => {
            if (!Array.isArray(value))
                return [];
            return value
                .filter((entry) => typeof entry === "string")
                .map((entry) => entry.trim())
                .filter(Boolean);
        };
        const scoreDuplicate = (doc) => {
            const data = doc?.data?.() || {};
            let score = 0;
            if (data?.id && data.id === doc.id)
                score += 100;
            if (data?.membershipStatus === "paid")
                score += 25;
            if (data?.companyId)
                score += 15;
            if (data?.companyCode)
                score += 5;
            if (Array.isArray(data?.assignedOrganizations) && data.assignedOrganizations.length > 0)
                score += 5;
            if (data?.role && data.role !== "free_user")
                score += 2;
            return score;
        };
        // Reconcile placeholder/duplicate user docs created before auth signup (usually from invitations).
        // This prevents duplicate "free" users showing up next to the real uid-based record.
        if (normalizedEmail) {
            const duplicatesSnap = await db.collection("users").where("email", "==", normalizedEmail).get();
            const duplicates = duplicatesSnap.docs.filter((doc) => doc.id !== uid);
            if (duplicates.length > 0) {
                const baseData = (userDoc.exists ? userDoc.data() : {}) || {};
                const best = duplicates
                    .slice()
                    .sort((a, b) => scoreDuplicate(b) - scoreDuplicate(a))[0];
                const bestData = best?.data?.() || {};
                const mergedAssignedOrganizations = Array.from(new Set([
                    ...normalizeStringArray(baseData.assignedOrganizations),
                    ...duplicates.flatMap((doc) => normalizeStringArray(doc.data()?.assignedOrganizations)),
                ]));
                const baseRole = (baseData.role || "free_user").toString();
                const candidateRole = (bestData.role || "").toString();
                const shouldUpgradeRole = (baseRole === "free_user" || baseRole === "user") &&
                    candidateRole &&
                    candidateRole !== "free_user" &&
                    candidateRole !== baseRole;
                const mergedMembershipStatus = baseData.membershipStatus === "paid" ||
                    bestData.membershipStatus === "paid" ||
                    Boolean(bestData.companyId) ||
                    mergedAssignedOrganizations.length > 0
                    ? "paid"
                    : baseData.membershipStatus || "free";
                const mergePayload = {
                    id: uid,
                    email: normalizedEmail,
                    assignedOrganizations: mergedAssignedOrganizations,
                    membershipStatus: mergedMembershipStatus,
                    companyId: baseData.companyId || bestData.companyId || null,
                    companyCode: baseData.companyCode || bestData.companyCode || null,
                    companyName: baseData.companyName || bestData.companyName || null,
                    transformationTier: mergedMembershipStatus === "paid"
                        ? baseData.transformationTier || bestData.transformationTier || "corporate_member"
                        : baseData.transformationTier,
                    updatedAt: timestamp,
                };
                if (shouldUpgradeRole) {
                    mergePayload.role = candidateRole;
                }
                await userRef.set(mergePayload, { merge: true });
                userDocExists = true;
                await Promise.all(duplicates.map((doc) => doc.ref.delete()));
                console.log(`✓ Reconciled and removed ${duplicates.length} duplicate user doc(s) for ${normalizedEmail}`);
            }
        }
        if (!userDocExists) {
            // Create a minimal user profile for newly authenticated users
            const userData = {
                id: uid,
                email: normalizedEmail || email,
                firstName: user.displayName?.split(" ")[0] || "User",
                lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
                fullName: user.displayName || normalizedEmail || email,
                role: "free_user",
                membershipStatus: "free",
                totalPoints: 0,
                level: 1,
                emailVerified: user.emailVerified,
                accountStatus: "active",
                createdAt: timestamp,
                updatedAt: timestamp,
            };
            // Write to both collections
            await Promise.all([
                userRef.set(userData, { merge: true }),
                db.collection("profiles").doc(uid).set(userData),
            ]);
            console.log(`✓ Created user and profile for ${uid}`);
        }
        else {
            // User already exists in users collection, sync to profiles
            const userData = (await userRef.get()).data();
            await db.collection("profiles").doc(uid).set({
                ...userData,
                updatedAt: timestamp,
            }, { merge: true });
            console.log(`✓ Synced existing user ${uid} to profiles`);
        }
    }
    catch (error) {
        console.error(`✗ Error syncing auth user ${uid}:`, error);
        throw error;
    }
});
/**
 * Cloud Function: Keep Profiles in Sync
 *
 * Batch function that runs nightly to ensure profiles collection
 * is in sync with the users collection.
 */
exports.syncProfilesNightly = functions
    .region("us-central1")
    .pubsub.schedule("0 2 * * *") // 2 AM UTC daily
    .timeZone("UTC")
    .onRun(async () => {
    console.log("Starting nightly profiles sync...");
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    try {
        const usersSnapshot = await db.collection("users").get();
        console.log(`Found ${usersSnapshot.size} users to sync`);
        // Process in batches
        const batch = db.batch();
        let batchSize = 0;
        const BATCH_LIMIT = 500;
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            try {
                const profileRef = db.collection("profiles").doc(userId);
                // Check if profile exists
                const profileDoc = await profileRef.get();
                if (!profileDoc.exists) {
                    // Profile doesn't exist, create it
                    batch.set(profileRef, {
                        ...userData,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    synced++;
                }
                else {
                    // Profile exists, update if user data is newer
                    const userUpdatedAt = userData.updatedAt || new Date(0);
                    const profileUpdatedAt = profileDoc.data()?.updatedAt || new Date(0);
                    if (userUpdatedAt > profileUpdatedAt) {
                        batch.set(profileRef, {
                            ...userData,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        }, { merge: true });
                        synced++;
                    }
                    else {
                        skipped++;
                    }
                }
                batchSize++;
                // Commit batch if it reaches the limit
                if (batchSize >= BATCH_LIMIT) {
                    await batch.commit();
                    batchSize = 0;
                }
            }
            catch (docError) {
                console.error(`Error processing user ${userId}:`, docError);
                errors++;
            }
        }
        // Commit remaining batch
        if (batchSize > 0) {
            await batch.commit();
        }
        const summary = `Nightly sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`;
        console.log(`✓ ${summary}`);
        return {
            status: "success",
            summary,
            synced,
            skipped,
            errors,
        };
    }
    catch (error) {
        console.error("✗ Nightly sync failed:", error);
        throw error;
    }
});
//# sourceMappingURL=sync-profiles.js.map