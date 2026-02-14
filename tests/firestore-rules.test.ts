import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, collectionGroup, query, where, getDocs, limit } from "firebase/firestore";
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

  function getAuthenticatedContext(
    uid: string,
    email: string = "user@example.com",
    claims: Record<string, unknown> = {},
  ) {
    return testEnv.authenticatedContext(uid, { email, ...claims });
  }

  function getUnauthenticatedContext() {
    return testEnv.unauthenticatedContext();
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

  describe("Interventions", () => {
    it("allows a partner to create an intervention for themselves", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      const interventionDoc = doc(db, "interventions/case1");
      await assertSucceeds(setDoc(interventionDoc, {
        partner_id: "partner-user",
        organization_code: "acme",
        status: "active",
        opened_at: "2026-02-13T00:00:00.000Z",
      }));
    });

    it("fails when a partner creates an intervention for another partner id", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      const interventionDoc = doc(db, "interventions/case1");
      await assertFails(setDoc(interventionDoc, {
        partner_id: "someone-else",
        organization_code: "acme",
        status: "active",
        opened_at: "2026-02-13T00:00:00.000Z",
      }));
    });

    it("allows a partner to update their own intervention", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
        await setDoc(doc(adminDb, "interventions/case1"), {
          partner_id: "partner-user",
          organization_code: "acme",
          status: "active",
          opened_at: "2026-02-13T00:00:00.000Z",
        });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      const interventionDoc = doc(db, "interventions/case1");
      await assertSucceeds(updateDoc(interventionDoc, {
        status: "watch",
        status_changed_at: "2026-02-13T01:00:00.000Z",
      }));
    });
  });

  describe("Platform Config", () => {
    it("allows partner/admin roles to read platform config", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
        await setDoc(doc(adminDb, "platform_config/engagement"), { enabled: false });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      await assertSucceeds(getDoc(doc(db, "platform_config/engagement")));
    });

    it("prevents partner/admin roles from writing platform config", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      await assertFails(setDoc(doc(db, "platform_config/engagement"), { enabled: true }));
    });

    it("allows super_admin to write platform config", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { role: "super_admin" });
      });

      const db = getAuthenticatedContext("admin-user").firestore();
      await assertSucceeds(setDoc(doc(db, "platform_config/engagement"), { enabled: true }));
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

  describe("Profile Access Logs", () => {
    it("allows authenticated users to create their own profile access logs", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const logDoc = doc(db, "profile_access_logs/log1");
      await assertSucceeds(setDoc(logDoc, {
        viewerId: "alice",
        targetUserId: "bob",
        allowed: true,
        reason: "allowed",
      }));
    });

    it("fails when viewerId does not match auth uid", async () => {
      const db = getAuthenticatedContext("alice").firestore();
      const logDoc = doc(db, "profile_access_logs/log1");
      await assertFails(setDoc(logDoc, {
        viewerId: "mallory",
        targetUserId: "bob",
        allowed: false,
        reason: "denied",
      }));
    });

    it("allows partner/admin roles to read profile access logs", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
        await setDoc(doc(adminDb, "profile_access_logs/log1"), {
          viewerId: "alice",
          targetUserId: "bob",
          allowed: true,
          reason: "allowed",
        });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      await assertSucceeds(getDoc(doc(db, "profile_access_logs/log1")));
    });
  });

  describe("Organizations", () => {
    it("allows unauthenticated lookup by company code with limit 1", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "organizations/org1"), { code: "AB1234", status: "active" });
      });

      const db = getUnauthenticatedContext().firestore();
      const orgs = collection(db, "organizations");
      const orgQuery = query(orgs, where("code", "==", "AB1234"), limit(1));
      await assertSucceeds(getDocs(orgQuery));
    });
  });

  describe("Mentorship Sessions", () => {
    it("allows a learner to query their own mentorship sessions", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "mentorship_sessions/session1"), {
          learner_id: "alice",
          mentor_id: "mentor-1",
          status: "scheduled",
          topic: "Weekly check-in",
        });
      });

      const db = getAuthenticatedContext("alice").firestore();
      const sessionsQuery = query(
        collection(db, "mentorship_sessions"),
        where("learner_id", "==", "alice"),
        where("status", "==", "scheduled"),
      );
      await assertSucceeds(getDocs(sessionsQuery));
    });

    it("allows a mentor to query their assigned mentorship sessions", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "mentorship_sessions/session1"), {
          learner_id: "alice",
          mentor_id: "mentor-1",
          status: "scheduled",
          topic: "Goal planning",
        });
      });

      const db = getAuthenticatedContext("mentor-1").firestore();
      const sessionsQuery = query(
        collection(db, "mentorship_sessions"),
        where("mentor_id", "==", "mentor-1"),
      );
      await assertSucceeds(getDocs(sessionsQuery));
    });

    it("denies a user from querying another learner's mentorship sessions", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "mentorship_sessions/session1"), {
          learner_id: "alice",
          mentor_id: "mentor-1",
          status: "scheduled",
          topic: "Private mentoring",
        });
      });

      const db = getAuthenticatedContext("mallory").firestore();
      const sessionsQuery = query(
        collection(db, "mentorship_sessions"),
        where("learner_id", "==", "alice"),
      );
      await assertFails(getDocs(sessionsQuery));
    });
  });

  describe("Role Normalization", () => {
    it("allows super-admin role variants to access admin collections", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { role: "super-admin" });
        await setDoc(doc(adminDb, "upgrade_requests/request1"), {
          user_id: "alice",
          status: "pending",
        });
      });

      const db = getAuthenticatedContext("admin-user").firestore();
      await assertSucceeds(getDocs(collection(db, "upgrade_requests")));
    });

    it("allows admin synonym to access partner-or-admin collections", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { role: "admin" });
        await setDoc(doc(adminDb, "admin_notifications/n1"), {
          type: "upgrade_request",
          message: "Test",
        });
      });

      const db = getAuthenticatedContext("admin-user").firestore();
      await assertSucceeds(getDocs(collection(db, "admin_notifications")));
    });

    it("falls back to profiles role when users role is missing", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { firstName: "Admin" });
        await setDoc(doc(adminDb, "profiles/admin-user"), { role: "super_admin" });
        await setDoc(doc(adminDb, "upgrade_requests/request1"), {
          user_id: "alice",
          status: "pending",
        });
      });

      const db = getAuthenticatedContext("admin-user").firestore();
      await assertSucceeds(getDocs(collection(db, "upgrade_requests")));
    });

    it("accepts super-admin role values with whitespace and separators", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { role: "  SUPER - ADMIN  " });
        await setDoc(doc(adminDb, "upgrade_requests/request1"), {
          user_id: "alice",
          status: "pending",
        });
      });

      const db = getAuthenticatedContext("admin-user").firestore();
      await assertSucceeds(getDocs(collection(db, "upgrade_requests")));
    });

    it("falls back to userRole field when role is missing", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { userRole: "super_admin" });
        await setDoc(doc(adminDb, "upgrade_requests/request1"), {
          user_id: "alice",
          status: "pending",
        });
      });

      const db = getAuthenticatedContext("admin-user").firestore();
      await assertSucceeds(getDocs(collection(db, "upgrade_requests")));
    });

    it("accepts boolean admin custom claim for admin reads", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "upgrade_requests/request1"), {
          user_id: "alice",
          status: "pending",
        });
      });

      const db = getAuthenticatedContext("admin-user", "admin@example.com", { admin: true }).firestore();
      await assertSucceeds(getDocs(collection(db, "upgrade_requests")));
    });

    it("prefers users/profile role over stale token role", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/admin-user"), { role: "super_admin" });
        await setDoc(doc(adminDb, "upgrade_requests/request1"), {
          user_id: "alice",
          status: "pending",
        });
      });

      const db = getAuthenticatedContext("admin-user", "admin@example.com", { role: "user" }).firestore();
      await assertSucceeds(getDocs(collection(db, "upgrade_requests")));
    });
  });

  describe("Weekly Points Subcollection", () => {
    it("allows partner to query weekly_points collection group", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users/partner-user"), { role: "partner" });
        await setDoc(doc(adminDb, "profiles/alice/weekly_points/week1"), {
          user_id: "alice",
          week: 1,
          points: 1200,
        });
      });

      const db = getAuthenticatedContext("partner-user").firestore();
      const weeklyGroupQuery = query(collectionGroup(db, "weekly_points"), where("user_id", "==", "alice"));
      await assertSucceeds(getDocs(weeklyGroupQuery));
    });
  });
});
