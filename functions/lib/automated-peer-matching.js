"use strict";
/**
 * Cloud Function: Automated Weekly Peer Matching
 *
 * This function automatically creates random peer matches for users within
 * the same organization or village on a weekly basis.
 *
 * Deploy with:
 * firebase deploy --only functions:automatedWeeklyPeerMatching
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
exports.expireOldPeerMatches = exports.triggerPeerMatching = exports.automatedWeeklyPeerMatching = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const normalizeAccountStatus = (status) => typeof status === "string" ? status.trim().toLowerCase() : "";
const hasSignedInMarkers = (profile) => {
    if (typeof profile.totalPoints === "number")
        return true;
    if (typeof profile.level === "number")
        return true;
    if (typeof profile.journeyType === "string" && profile.journeyType.trim().length > 0)
        return true;
    if (typeof profile.onboardingComplete === "boolean")
        return true;
    return false;
};
const isEligibleForPeerMatching = (profile) => {
    if (profile.mergedInto)
        return false;
    const status = normalizeAccountStatus(profile.accountStatus ?? profile.status);
    if (status && status !== "active")
        return false;
    if (profile.privacySettings?.allowPeerMatching === false)
        return false;
    // Exclude stub/pending invitation profiles that haven't completed a real sign-in bootstrap yet.
    if (!hasSignedInMarkers(profile))
        return false;
    return true;
};
// Get the current match window key based on date
const getMatchWindowKey = (refreshPreference, preferredMatchDay) => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const diff = (dayOfWeek - preferredMatchDay + 7) % 7;
    const windowStart = new Date(now);
    windowStart.setUTCDate(now.getUTCDate() - diff);
    if (refreshPreference === "biweekly") {
        // Anchor to Jan 1, 2024 for biweekly calculations
        const referenceAnchor = new Date(Date.UTC(2024, 0, 1));
        const referenceDay = referenceAnchor.getUTCDay();
        const refDiff = (referenceDay - preferredMatchDay + 7) % 7;
        referenceAnchor.setUTCDate(referenceAnchor.getUTCDate() - refDiff);
        const weeksSinceReference = Math.floor((windowStart.getTime() - referenceAnchor.getTime()) /
            (7 * 24 * 60 * 60 * 1000));
        const cycleIndex = Math.floor(weeksSinceReference / 2);
        const biweeklyStart = new Date(referenceAnchor);
        biweeklyStart.setUTCDate(referenceAnchor.getUTCDate() + cycleIndex * 14);
        return `biweekly-${biweeklyStart.toISOString().slice(0, 10)}`;
    }
    return `weekly-${windowStart.toISOString().slice(0, 10)}`;
};
// Group users by their organization scope
const groupUsersByOrganization = (users) => {
    const groups = new Map();
    for (const user of users) {
        // Determine organization key - prioritize more specific groupings
        let orgKey = null;
        // First try cohort (most specific)
        if (user.cohortIdentifier) {
            orgKey = `cohort:${user.cohortIdentifier}`;
        }
        // Then try corporate village
        else if (user.corporateVillageId) {
            orgKey = `village:${user.corporateVillageId}`;
        }
        // Then try company ID
        else if (user.companyId) {
            orgKey = `company:${user.companyId}`;
        }
        // Then try organization ID
        else if (user.organizationId) {
            orgKey = `org:${user.organizationId}`;
        }
        // Then try company code
        else if (user.companyCode) {
            orgKey = `code:${user.companyCode}`;
        }
        // Then try organization code
        else if (user.organizationCode) {
            orgKey = `orgcode:${user.organizationCode}`;
        }
        if (orgKey) {
            const existing = groups.get(orgKey) || [];
            existing.push(user);
            groups.set(orgKey, existing);
        }
    }
    return groups;
};
// Shuffle array using Fisher-Yates algorithm
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};
// Get match reason based on organization grouping
const getMatchReason = (orgKey) => {
    if (orgKey.startsWith("cohort:"))
        return "Shared cohort";
    if (orgKey.startsWith("village:"))
        return "Same corporate village";
    if (orgKey.startsWith("company:"))
        return "Same company";
    if (orgKey.startsWith("org:"))
        return "Same organization";
    return "Same company code";
};
const MAX_BATCH_WRITE_OPERATIONS = 450;
const WRITES_PER_MATCH = 3;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
// Retry helper with exponential backoff
async function retryWithBackoff(operation, context, maxAttempts = MAX_RETRY_ATTEMPTS) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            console.warn(`${context} failed (attempt ${attempt}/${maxAttempts}):`, error);
            if (attempt < maxAttempts) {
                const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                console.log(`Retrying after ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error(`${context} failed after ${maxAttempts} attempts: ${lastError?.message}`);
}
// Log matching run statistics to Firestore for monitoring
async function logMatchingRunStats(stats) {
    try {
        await db.collection("peer_matching_runs").add(stats);
    }
    catch (error) {
        console.error("Failed to log matching run statistics:", error);
        // Don't throw - logging failure shouldn't break the matching run
    }
}
// Create peer matches for a group of users
const createMatchesForGroup = async (users, orgKey, matchReason) => {
    if (users.length < 2) {
        console.warn(`⚠️  EMPTY POOL: Group ${orgKey} has ${users.length} user(s) - need at least 2 for matching`);
        return { created: 0, skipped: users.length };
    }
    // Filter to only users who have weekly or biweekly matching enabled
    const eligibleUsers = users.filter((u) => {
        if (!isEligibleForPeerMatching(u))
            return false;
        return (!u.matchRefreshPreference ||
            u.matchRefreshPreference === "weekly" ||
            u.matchRefreshPreference === "biweekly");
    });
    if (eligibleUsers.length < 2) {
        console.warn(`⚠️  INSUFFICIENT ELIGIBLE USERS: Group ${orgKey} has ${eligibleUsers.length}/${users.length} eligible user(s) - need at least 2 with weekly/biweekly preference`);
        return { created: 0, skipped: users.length };
    }
    // Shuffle users to randomize matching
    const shuffledUsers = shuffleArray(eligibleUsers);
    let batch = db.batch();
    let pendingWrites = 0;
    let created = 0;
    let skipped = 0;
    const flushBatch = async () => {
        if (pendingWrites === 0)
            return;
        await retryWithBackoff(() => batch.commit(), `Batch commit for group ${orgKey}`);
        batch = db.batch();
        pendingWrites = 0;
    };
    const ensureCapacity = async (neededWrites) => {
        if (pendingWrites + neededWrites > MAX_BATCH_WRITE_OPERATIONS) {
            await flushBatch();
        }
    };
    // Create pairs by iterating through shuffled users
    for (let i = 0; i < shuffledUsers.length; i++) {
        const user = shuffledUsers[i];
        // Match with the next user in the shuffled list (circular)
        const peerIndex = (i + 1) % shuffledUsers.length;
        const peer = shuffledUsers[peerIndex];
        // Skip if user is being matched with themselves (only possible if single user)
        if (user.id === peer.id) {
            skipped++;
            continue;
        }
        const preferredMatchDay = user.preferredMatchDay ?? 1; // Default to Monday
        const refreshPreference = user.matchRefreshPreference || "weekly";
        const matchKey = getMatchWindowKey(refreshPreference, preferredMatchDay);
        const matchDocId = `${user.id}-${matchKey}`;
        // Check if match already exists for this window
        const existingMatch = await db
            .collection("peer_weekly_matches")
            .doc(matchDocId)
            .get();
        if (existingMatch.exists) {
            console.log(`Match already exists for user ${user.id} in window ${matchKey}`);
            skipped++;
            continue;
        }
        await ensureCapacity(WRITES_PER_MATCH);
        const matchData = {
            peer_id: peer.id,
            user_id: user.id,
            matchKey: matchKey,
            matchRefreshPreference: refreshPreference,
            preferredMatchDay: preferredMatchDay,
            matchReason: matchReason,
            matchStatus: "new",
            refreshCount: 1,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
            automatedMatch: true,
        };
        batch.set(db.collection("peer_weekly_matches").doc(matchDocId), matchData);
        pendingWrites += 1;
        // Update user's lastMatchRefreshDate
        batch.update(db.collection("profiles").doc(user.id), {
            lastMatchRefreshDate: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        pendingWrites += 1;
        // Create notification for the user about their new match
        const notificationData = {
            userId: user.id,
            type: "peer_match",
            title: "New Peer Match!",
            message: `You've been matched with ${peer.fullName || peer.email || "a peer"} for this week's peer connection.`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                matchId: matchDocId,
                peerId: peer.id,
                peerName: peer.fullName || peer.email || "Peer",
                matchReason: matchReason,
            },
        };
        batch.set(db.collection("notifications").doc(), notificationData);
        pendingWrites += 1;
        created++;
    }
    await flushBatch();
    if (created > 0) {
        console.log(`Created ${created} matches for group ${orgKey} (${skipped} skipped)`);
    }
    return { created, skipped };
};
/**
 * Automated Weekly Peer Matching
 *
 * Runs every Monday at 6 AM UTC to create new peer matches for the week.
 * Users are grouped by organization/village and matched randomly within their group.
 */
exports.automatedWeeklyPeerMatching = functions
    .region("us-central1")
    .pubsub.schedule("0 6 * * 1") // Every Monday at 6 AM UTC
    .timeZone("UTC")
    .onRun(async () => {
    console.log("Starting automated weekly peer matching...");
    const startTime = Date.now();
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalUsers = 0;
    let groupsProcessed = 0;
    let groupsWithErrors = 0;
    let emptyGroups = 0;
    try {
        // Fetch all profiles with organization associations
        const profilesSnapshot = await db.collection("profiles").get();
        const users = profilesSnapshot.docs
            .map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }))
            .filter((u) => isEligibleForPeerMatching(u) &&
            // Only include users with some organization/village association
            (u.companyId ||
                u.companyCode ||
                u.organizationId ||
                u.organizationCode ||
                u.corporateVillageId ||
                u.villageId ||
                u.cohortIdentifier));
        totalUsers = users.length;
        console.log(`Found ${totalUsers} users with organization associations`);
        if (totalUsers === 0) {
            console.log("No users with organization associations found");
            return {
                status: "success",
                message: "No users to match",
                totalUsers: 0,
                totalCreated: 0,
                totalSkipped: 0,
                groupsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
        // Group users by organization
        const groups = groupUsersByOrganization(users);
        console.log(`Users grouped into ${groups.size} organizations/villages`);
        // Process each group
        for (const [orgKey, orgUsers] of groups) {
            const matchReason = getMatchReason(orgKey);
            console.log(`Processing group ${orgKey} with ${orgUsers.length} users...`);
            try {
                const result = await createMatchesForGroup(orgUsers, orgKey, matchReason);
                totalCreated += result.created;
                totalSkipped += result.skipped;
                // Track empty groups for monitoring
                if (result.created === 0 && orgUsers.length >= 2) {
                    emptyGroups++;
                }
                groupsProcessed++;
            }
            catch (groupError) {
                groupsWithErrors++;
                console.error(`❌ Error processing group ${orgKey} (${orgUsers.length} users):`, groupError);
                // Continue processing other groups despite error
            }
        }
        const duration = Date.now() - startTime;
        const summary = {
            status: "success",
            message: `Automated peer matching complete`,
            totalUsers,
            totalCreated,
            totalSkipped,
            groupsProcessed,
            groupsWithErrors,
            emptyGroups,
            duration,
        };
        console.log(`✅ Automated peer matching complete: ${totalCreated} matches created, ${totalSkipped} skipped, ${groupsProcessed} groups processed, ${groupsWithErrors} errors, ${emptyGroups} empty groups, ${duration}ms`);
        // Log statistics to Firestore for monitoring
        await logMatchingRunStats({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "success",
            totalUsers,
            totalCreated,
            totalSkipped,
            groupsProcessed,
            groupsWithErrors,
            emptyGroups,
            duration,
        });
        return summary;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ Automated peer matching failed:", error);
        // Log failure to Firestore
        await logMatchingRunStats({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "error",
            totalUsers,
            totalCreated,
            totalSkipped,
            groupsProcessed,
            groupsWithErrors,
            emptyGroups,
            duration,
            errorMessage,
        });
        throw error;
    }
});
/**
 * Manual Trigger for Peer Matching (Admin Only)
 *
 * Allows super admins to manually trigger peer matching outside the schedule.
 * Useful for testing or when matches need to be regenerated.
 */
exports.triggerPeerMatching = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    // Verify the caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to trigger peer matching");
    }
    // Check if user is a super admin
    const userDoc = await db
        .collection("profiles")
        .doc(context.auth.uid)
        .get();
    const userData = userDoc.data();
    if (!userData || userData.role !== "super_admin") {
        throw new functions.https.HttpsError("permission-denied", "Only super admins can manually trigger peer matching");
    }
    console.log(`Manual peer matching triggered by admin ${context.auth.uid}`);
    const startTime = Date.now();
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalUsers = 0;
    let groupsProcessed = 0;
    try {
        // Optionally filter by specific organization if provided
        const targetOrgId = data?.organizationId;
        let profilesQuery = db.collection("profiles");
        if (targetOrgId) {
            console.log(`Filtering to organization: ${targetOrgId}`);
            // This will only match exact companyId, you may want to expand this
            profilesQuery = profilesQuery.where("companyId", "==", targetOrgId);
        }
        const profilesSnapshot = await profilesQuery.get();
        const users = profilesSnapshot.docs
            .map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }))
            .filter((u) => isEligibleForPeerMatching(u) &&
            (u.companyId ||
                u.companyCode ||
                u.organizationId ||
                u.organizationCode ||
                u.corporateVillageId ||
                u.villageId ||
                u.cohortIdentifier));
        totalUsers = users.length;
        if (totalUsers === 0) {
            return {
                status: "success",
                message: "No users to match",
                totalUsers: 0,
                totalCreated: 0,
                totalSkipped: 0,
                groupsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
        const groups = groupUsersByOrganization(users);
        for (const [orgKey, orgUsers] of groups) {
            const matchReason = getMatchReason(orgKey);
            try {
                const result = await createMatchesForGroup(orgUsers, orgKey, matchReason);
                totalCreated += result.created;
                totalSkipped += result.skipped;
                groupsProcessed++;
            }
            catch (groupError) {
                console.error(`Error processing group ${orgKey}:`, groupError);
            }
        }
        const duration = Date.now() - startTime;
        return {
            status: "success",
            message: `Manual peer matching complete`,
            totalUsers,
            totalCreated,
            totalSkipped,
            groupsProcessed,
            duration,
            triggeredBy: context.auth.uid,
        };
    }
    catch (error) {
        console.error("Manual peer matching failed:", error);
        throw new functions.https.HttpsError("internal", `Peer matching failed: ${error}`);
    }
});
/**
 * Expire Old Matches
 *
 * Runs daily to mark old matches as expired if they weren't completed.
 * Helps keep the peer_weekly_matches collection clean.
 */
exports.expireOldPeerMatches = functions
    .region("us-central1")
    .pubsub.schedule("0 0 * * *") // Every day at midnight UTC
    .timeZone("UTC")
    .onRun(async () => {
    console.log("Starting peer match expiration check...");
    try {
        // Get matches older than 14 days that are not completed
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const oldMatchesSnapshot = await db
            .collection("peer_weekly_matches")
            .where("createdAt", "<", fourteenDaysAgo)
            .where("matchStatus", "in", ["new", "viewed", "contacted"])
            .get();
        if (oldMatchesSnapshot.empty) {
            console.log("No matches to expire");
            return { status: "success", expired: 0 };
        }
        const batch = db.batch();
        let expired = 0;
        oldMatchesSnapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
                matchStatus: "expired",
                expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            expired++;
        });
        await batch.commit();
        console.log(`Expired ${expired} old peer matches`);
        return { status: "success", expired };
    }
    catch (error) {
        console.error("Error expiring old matches:", error);
        throw error;
    }
});
//# sourceMappingURL=automated-peer-matching.js.map