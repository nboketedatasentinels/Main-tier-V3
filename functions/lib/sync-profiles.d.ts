/**
 * Cloud Function: Sync Users to Profiles on Write
 *
 * This function automatically syncs user documents to the profiles collection
 * whenever a user document is created or updated.
 *
 * Deploy with:
 * firebase deploy --only functions:syncUserToProfile
 */
import * as functions from "firebase-functions";
export declare const syncUserToProfile: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
/**
 * Cloud Function: Sync Google Sign-In Users
 *
 * Syncs users created via Google Sign-In authentication to both collections.
 * This ensures OAuth users are also in the profiles collection.
 */
export declare const syncAuthUserToProfile: functions.CloudFunction<import("firebase-admin/auth").UserRecord>;
/**
 * Cloud Function: Keep Profiles in Sync
 *
 * Batch function that runs nightly to ensure profiles collection
 * is in sync with the users collection.
 */
export declare const syncProfilesNightly: functions.CloudFunction<unknown>;
