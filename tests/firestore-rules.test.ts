import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testEnv: RulesTestEnvironment;

describe("Firestore Security Rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "t4l-tier-test",
      firestore: {
        rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  function getAuthenticatedContext(uid: string, email: string = "user@example.com") {
    return testEnv.authenticatedContext(uid, { email });
  }

  describe("Users & Profiles Collections", () => {
    it("allows an authenticated user to read any profile", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const profileDoc = doc(db, "users/bob");
      await assertSucceeds(getDoc(profileDoc));

      const pDoc = doc(db, "profiles/bob");
      await assertSucceeds(getDoc(pDoc));
    });

    it("allows a user to write their own profile", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const profileDoc = doc(db, "users/alice");
      await assertSucceeds(setDoc(profileDoc, { firstName: "Alice", role: "user" }));
    });

    it("fails when a user tries to write someone else's profile", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const profileDoc = doc(db, "users/bob");
      await assertFails(setDoc(profileDoc, { firstName: "Alice" }));
    });

    it("fails when a user tries to change their own role", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const profileDoc = doc(db, "users/alice");

      // Setup: user exists
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/alice"), { firstName: "Alice", role: "user" });
      });

      // Updating role should fail
      await assertFails(updateDoc(profileDoc, { role: "super_admin" }));
    });

    it("allows a super_admin to change any user's role", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { role: "super_admin" });
        await setDoc(doc(adminDb, "users/alice"), { role: "user" });
      });

      const db = getAuthenticatedContext("admin-user").firestore();
      const aliceDoc = doc(db, "users/alice");
      await assertSucceeds(updateDoc(aliceDoc, { role: "partner" }));
    });
  });

  describe("Points Ledger", () => {
    it("allows user to create own ledger entry with prefix", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const ledgerDoc = doc(db, "pointsLedger/alice__entry1");
      await assertSucceeds(setDoc(ledgerDoc, { uid: "alice", points: 10 }));
    });

    it("fails if user creates ledger entry without their uid prefix", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const ledgerDoc = doc(db, "pointsLedger/bob__entry1");
      await assertFails(setDoc(ledgerDoc, { uid: "alice", points: 10 }));
    });

    it("fails if user tries to read someone else's ledger entry", async () => {
       await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "pointsLedger/bob__entry1"), { uid: "bob", points: 10 });
      });

      const db = getAuthenticatedContext("alice").firestore();
      const ledgerDoc = doc(db, "pointsLedger/bob__entry1");
      await assertFails(getDoc(ledgerDoc));
    });

    it("enforces list query constraint for users", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const ledgerCol = collection(db, "pointsLedger");

      // Query without constraint should fail
      await assertFails(getDocs(ledgerCol));

      // Query with constraint should succeed
      const constrainedQuery = query(ledgerCol, where("uid", "==", "alice"));
      await assertSucceeds(getDocs(constrainedQuery));
    });
  });

  describe("Admin Actions", () => {
    it("allows Partner to create an admin action", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      const actionDoc = doc(db, "admin_actions/action1");
      await assertSucceeds(setDoc(actionDoc, {
        type: "update_membership_status",
        targetUserId: "alice",
        data: { status: "paid" },
        createdBy: "partner-user"
      }));
    });

    it("fails if a regular user tries to create an admin action", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const actionDoc = doc(db, "admin_actions/action1");
      await assertFails(setDoc(actionDoc, {
        type: "update_membership_status",
        targetUserId: "bob",
        data: { status: "paid" },
        createdBy: "alice"
      }));
    });
  });

  describe("Approvals & Points Verification", () => {
    it("prevents self-approval in approvals collection", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
        await setDoc(doc(adminDb, "approvals/request1"), { userId: "partner-user", status: "pending" });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      const requestDoc = doc(db, "approvals/request1");
      // Partner trying to update their own request
      await assertFails(updateDoc(requestDoc, { status: "approved" }));
    });

    it("prevents self-approval in points_verification_requests", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
        await setDoc(doc(adminDb, "points_verification_requests/req1"), { user_id: "partner-user", status: "pending" });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      const requestDoc = doc(db, "points_verification_requests/req1");
      await assertFails(updateDoc(requestDoc, { status: "approved" }));
    });

    it("allows a different partner to approve a request", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner1"), { role: "partner" });
        await setDoc(doc(adminDb, "users/partner2"), { role: "partner" });
        await setDoc(doc(adminDb, "approvals/request1"), { userId: "partner1", status: "pending" });
      });

      const db = getAuthenticatedContext("partner2").firestore();
      const requestDoc = doc(db, "approvals/request1");
      await assertSucceeds(updateDoc(requestDoc, { status: "approved" }));
    });
  });
});
