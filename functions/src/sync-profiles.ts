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
import * as admin from "firebase-admin";

const db = admin.firestore();

export const syncUserToProfile = functions
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
      } catch (error) {
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
      await db.collection("profiles").doc(userId).set(
        {
          ...userData,
          // Ensure timestamps are set correctly
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          // Preserve createdAt from the source if it exists
          ...(userData.createdAt ? { createdAt: userData.createdAt } : {}),
        },
        { merge: true }
      );

      console.log(`✓ Successfully synced user ${userId} to profiles`);
    } catch (error) {
      console.error(`✗ Error syncing user ${userId} to profiles:`, error);
      // Log but don't throw - we don't want to fail the user write
      throw new functions.https.HttpsError(
        "internal",
        `Failed to sync user to profiles: ${error}`
      );
    }
  });

/**
 * Cloud Function: Sync Google Sign-In Users
 * 
 * Syncs users created via Google Sign-In authentication to both collections.
 * This ensures OAuth users are also in the profiles collection.
 */
export const syncAuthUserToProfile = functions
  .region("us-central1")
  .auth.user()
  .onCreate(async (user) => {
    const uid = user.uid;
    const email = user.email || "";

    console.log(`New auth user created: ${uid} (${email})`);

    try {
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      // Check if user document already exists
      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        // Create a minimal user profile for newly authenticated users
        const userData = {
          id: uid,
          email: email,
          firstName: user.displayName?.split(" ")[0] || "User",
          lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
          fullName: user.displayName || email,
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
          db.collection("users").doc(uid).set(userData),
          db.collection("profiles").doc(uid).set(userData),
        ]);

        console.log(`✓ Created user and profile for ${uid}`);
      } else {
        // User already exists in users collection, sync to profiles
        const userData = userDoc.data();
        await db.collection("profiles").doc(uid).set(
          {
            ...userData,
            updatedAt: timestamp,
          },
          { merge: true }
        );

        console.log(`✓ Synced existing user ${uid} to profiles`);
      }
    } catch (error) {
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
export const syncProfilesNightly = functions
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
            batch.set(
              profileRef,
              {
                ...userData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            synced++;
          } else {
            // Profile exists, update if user data is newer
            const userUpdatedAt = userData.updatedAt || new Date(0);
            const profileUpdatedAt = profileDoc.data()?.updatedAt || new Date(0);

            if (userUpdatedAt > profileUpdatedAt) {
              batch.set(
                profileRef,
                {
                  ...userData,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              synced++;
            } else {
              skipped++;
            }
          }

          batchSize++;

          // Commit batch if it reaches the limit
          if (batchSize >= BATCH_LIMIT) {
            await batch.commit();
            batchSize = 0;
          }
        } catch (docError) {
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
    } catch (error) {
      console.error("✗ Nightly sync failed:", error);
      throw error;
    }
  });
