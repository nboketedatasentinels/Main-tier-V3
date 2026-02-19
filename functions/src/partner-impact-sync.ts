import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

type JsonRecord = Record<string, unknown>;

interface SyncPartnerImpactLogsRequest {
  forceFullRefresh?: boolean;
}

interface SyncPartnerImpactLogsResponse {
  status: "success" | "skipped";
  message: string;
  fetchedCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  lastSyncedAt: string;
}

interface PartnerApiConfig {
  apiUrl: string;
  apiToken: string | null;
  timeoutMs: number;
}

interface NormalizedPartnerImpactEntry {
  sourceRecordId: string;
  title: string;
  description: string;
  categoryGroup: "esg" | "business";
  esgCategory?: "environmental" | "social" | "governance";
  activityType?: string;
  businessCategory?: string;
  businessActivity?: string;
  liftPillars?: string[];
  date: string;
  createdAt: string;
  hours: number;
  peopleImpacted: number;
  usdValue: number;
  verificationLevel: string;
  verifierEmail?: string;
  evidenceLink?: string;
  impactValue: number;
  scp: number;
}

const DEFAULT_SYNC_TIMEOUT_MS = 20000;
const MAX_SYNC_TIMEOUT_MS = 60000;
const SYNC_STATE_COLLECTION = "external_impact_sync_state";
const IMPACT_LOG_COLLECTION = "impact_logs";

function toRecord(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function getString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function getNumber(record: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getStringArray(record: JsonRecord, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    const next = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
    if (next.length > 0) return next;
  }
  return undefined;
}

function normalizeDateCandidate(value: unknown): Date | null {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Handle both seconds and milliseconds epoch input.
    const epochMs = value > 9999999999 ? value : value * 1000;
    const parsed = new Date(epochMs);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const record = toRecord(value);
  if (!record) return null;

  const seconds = record.seconds;
  if (typeof seconds === "number" && Number.isFinite(seconds)) {
    const nanos = typeof record.nanoseconds === "number" ? record.nanoseconds : 0;
    const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1000000));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeEsgCategory(value: string | null): "environmental" | "social" | "governance" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("env")) return "environmental";
  if (normalized.startsWith("soc")) return "social";
  if (normalized.startsWith("gov")) return "governance";
  return undefined;
}

function resolveCategoryGroup(record: JsonRecord): "esg" | "business" {
  const direct = getString(record, ["categoryGroup", "category_group", "categoryType", "category_type"]);
  if (direct) {
    const normalized = direct.toLowerCase();
    if (normalized.includes("business")) return "business";
    if (normalized.includes("esg")) return "esg";
  }

  const businessCategory = getString(record, ["businessCategory", "business_category", "businessType", "business_type"]);
  if (businessCategory) return "business";
  return "esg";
}

function computeImpactValue(hours: number, peopleImpacted: number, esgCategory?: "environmental" | "social" | "governance"): number {
  const baseImpactRate = esgCategory === "governance" ? 1.1 : esgCategory === "social" ? 0.9 : 1;
  return Math.round(hours * 75 * baseImpactRate + peopleImpacted * 10);
}

function computeScp(hours: number, peopleImpacted: number): number {
  return Math.round(hours * 5 + peopleImpacted * 2.5);
}

function sanitizeSourceRecordId(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  if (cleaned.length > 0) return cleaned;
  return createHash("sha256").update(input).digest("hex").slice(0, 48);
}

function resolveSourceRecordId(record: JsonRecord, normalizedEmail: string): string {
  const explicitId = getString(record, ["id", "logId", "log_id", "entryId", "entry_id", "uuid", "eventId", "event_id"]);
  if (explicitId) return sanitizeSourceRecordId(explicitId);

  const fingerprint = [
    normalizedEmail,
    getString(record, ["title", "name", "activity", "activityType", "activity_type"]) ?? "",
    getString(record, ["date", "activityDate", "activity_date", "createdAt", "created_at", "timestamp"]) ?? "",
    String(getNumber(record, ["hours", "hoursSpent", "hours_spent", "duration", "durationHours", "duration_hours"]) ?? 0),
    String(getNumber(record, ["peopleImpacted", "people_impacted", "participants", "beneficiaries", "treesPlanted"]) ?? 0),
    String(getNumber(record, ["usdValue", "usd_value", "value", "financialImpact", "financial_impact"]) ?? 0),
  ].join("|");

  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 48);
}

function normalizePartnerEntry(rawEntry: unknown, normalizedEmail: string): NormalizedPartnerImpactEntry | null {
  const record = toRecord(rawEntry);
  if (!record) return null;

  const dateCandidate =
    normalizeDateCandidate(record.date) ??
    normalizeDateCandidate(record.activityDate) ??
    normalizeDateCandidate(record.activity_date) ??
    normalizeDateCandidate(record.createdAt) ??
    normalizeDateCandidate(record.created_at) ??
    normalizeDateCandidate(record.timestamp);

  if (!dateCandidate) return null;

  const categoryGroup = resolveCategoryGroup(record);
  const esgCategory = normalizeEsgCategory(getString(record, ["esgCategory", "esg_category", "esgType", "esg_type", "category"]));

  const hours = Math.max(
    0,
    getNumber(record, ["hours", "hoursSpent", "hours_spent", "duration", "durationHours", "duration_hours"]) ?? 0
  );
  const peopleImpacted = Math.max(
    0,
    getNumber(record, ["peopleImpacted", "people_impacted", "participants", "beneficiaries", "treesPlanted", "trees_planted"]) ?? 0
  );
  const usdValue = Math.max(
    0,
    getNumber(record, ["usdValue", "usd_value", "value", "financialImpact", "financial_impact"]) ?? 0
  );

  const computedImpactValue = computeImpactValue(hours, peopleImpacted, esgCategory);
  const computedScp = computeScp(hours, peopleImpacted);

  const impactValue = Math.max(0, getNumber(record, ["impactValue", "impact_value"]) ?? computedImpactValue);
  const scp = Math.max(0, getNumber(record, ["scp", "socialCapitalPoints", "social_capital_points"]) ?? computedScp);

  return {
    sourceRecordId: resolveSourceRecordId(record, normalizedEmail),
    title: getString(record, ["title", "name", "activityTitle", "activity_title"]) ?? "Partner Impact Activity",
    description: getString(record, ["description", "details", "notes", "summary"]) ?? "",
    categoryGroup,
    esgCategory,
    activityType: getString(record, ["activityType", "activity_type", "activity"]) ?? undefined,
    businessCategory: getString(record, ["businessCategory", "business_category"]) ?? undefined,
    businessActivity: getString(record, ["businessActivity", "business_activity"]) ?? undefined,
    liftPillars: getStringArray(record, ["liftPillars", "lift_pillars"]),
    date: toIsoDate(dateCandidate),
    createdAt: dateCandidate.toISOString(),
    hours,
    peopleImpacted,
    usdValue,
    verificationLevel: getString(record, ["verificationLevel", "verification_level", "verificationTier", "verification_tier"]) ??
      "Tier 1: Self-Reported",
    verifierEmail: getString(record, ["verifierEmail", "verifier_email"]) ?? undefined,
    evidenceLink: getString(record, ["evidenceLink", "evidence_link", "proofUrl", "proof_url"]) ?? undefined,
    impactValue,
    scp,
  };
}

function extractPartnerEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = toRecord(payload);
  if (!record) return [];

  const directKeys = ["logs", "entries", "items", "results", "data"];
  for (const key of directKeys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  const nestedData = toRecord(record.data);
  if (nestedData) {
    for (const key of directKeys) {
      const value = nestedData[key];
      if (Array.isArray(value)) return value;
    }
  }

  return [];
}

function resolvePartnerApiConfig(): PartnerApiConfig {
  const runtimeConfig = functions.config() as {
    partnerimpact?: { api_url?: string; api_token?: string; timeout_ms?: string | number };
    partner_impact?: { api_url?: string; api_token?: string; timeout_ms?: string | number };
  };

  const configBlock = runtimeConfig.partnerimpact ?? runtimeConfig.partner_impact ?? {};
  const apiUrl = (process.env.T4L_PARTNER_IMPACT_API_URL ?? configBlock.api_url ?? "").trim();
  const apiToken = (process.env.T4L_PARTNER_IMPACT_API_TOKEN ?? configBlock.api_token ?? "").trim() || null;
  const timeoutRaw = process.env.T4L_PARTNER_IMPACT_TIMEOUT_MS ?? configBlock.timeout_ms ?? DEFAULT_SYNC_TIMEOUT_MS;
  const timeoutParsed = Number(timeoutRaw);
  const timeoutMs = Number.isFinite(timeoutParsed)
    ? Math.min(Math.max(timeoutParsed, 1000), MAX_SYNC_TIMEOUT_MS)
    : DEFAULT_SYNC_TIMEOUT_MS;

  if (!apiUrl) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Partner impact API URL is not configured."
    );
  }

  return {
    apiUrl,
    apiToken,
    timeoutMs,
  };
}

async function fetchPartnerEntries(config: PartnerApiConfig, payload: JsonRecord): Promise<unknown[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiToken) {
    headers.Authorization = config.apiToken.toLowerCase().startsWith("bearer ")
      ? config.apiToken
      : `Bearer ${config.apiToken}`;
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawBody = await response.text();
    let parsedBody: unknown = null;
    if (rawBody.trim().length > 0) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (_error) {
        parsedBody = null;
      }
    }

    if (!response.ok) {
      throw new functions.https.HttpsError(
        "unavailable",
        `Partner impact API request failed with status ${response.status}.`,
        {
          status: response.status,
          responsePreview: rawBody.slice(0, 500),
        }
      );
    }

    return extractPartnerEntries(parsedBody);
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    const isAbortError = error instanceof Error && error.name === "AbortError";
    throw new functions.https.HttpsError(
      "deadline-exceeded",
      isAbortError
        ? `Partner impact API request exceeded ${config.timeoutMs}ms timeout.`
        : "Unable to fetch partner impact entries."
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const syncPartnerImpactLogs = functions
  .region("us-central1")
  .https.onCall(
    async (
      data: SyncPartnerImpactLogsRequest | undefined,
      context
    ): Promise<SyncPartnerImpactLogsResponse> => {
      if (!context.auth?.uid) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
      }

      const uid = context.auth.uid;
      const nowIso = new Date().toISOString();
      const syncStateRef = db.collection(SYNC_STATE_COLLECTION).doc(uid);
      const forceFullRefresh = Boolean(data?.forceFullRefresh);

      try {
        const [authUser, syncStateSnap] = await Promise.all([
          admin.auth().getUser(uid),
          syncStateRef.get(),
        ]);

        const normalizedEmail = normalizeEmail(authUser.email);
        if (!normalizedEmail) {
          await syncStateRef.set(
            {
              uid,
              status: "skipped",
              reason: "missing_email",
              message: "No verified email is available for partner-impact linking.",
              lastAttemptAt: nowIso,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return {
            status: "skipped",
            message: "No verified email is available for partner-impact linking.",
            fetchedCount: 0,
            importedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            lastSyncedAt: nowIso,
          };
        }

        if (authUser.emailVerified !== true) {
          await syncStateRef.set(
            {
              uid,
              email: normalizedEmail,
              status: "skipped",
              reason: "email_not_verified",
              message: "Verify your Google account email before syncing partner impact logs.",
              lastAttemptAt: nowIso,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return {
            status: "skipped",
            message: "Verify your Google account email before syncing partner impact logs.",
            fetchedCount: 0,
            importedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            lastSyncedAt: nowIso,
          };
        }

        const hasGoogleProvider = authUser.providerData.some((provider) => provider.providerId === "google.com");
        if (!hasGoogleProvider) {
          await syncStateRef.set(
            {
              uid,
              email: normalizedEmail,
              status: "skipped",
              reason: "google_provider_required",
              message: "Link a Google account to enable secure email-based partner-impact sync.",
              lastAttemptAt: nowIso,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return {
            status: "skipped",
            message: "Link a Google account to enable secure email-based partner-impact sync.",
            fetchedCount: 0,
            importedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            lastSyncedAt: nowIso,
          };
        }

        const stateData = syncStateSnap.exists ? toRecord(syncStateSnap.data()) : null;
        const since = !forceFullRefresh
          ? getString(stateData ?? {}, ["lastSuccessfulPullAt"])
          : null;

        const [firstName = "", ...restNameParts] = (authUser.displayName ?? "").trim().split(/\s+/);
        const lastName = restNameParts.join(" ").trim();

        const requestPayload: JsonRecord = {
          email: normalizedEmail,
          firstName,
          lastName,
          firebaseUid: uid,
          includeHistorical: true,
          ...(since ? { since } : {}),
        };

        const config = resolvePartnerApiConfig();
        const partnerEntries = await fetchPartnerEntries(config, requestPayload);

        const normalizedEntries = partnerEntries
          .map((entry) => normalizePartnerEntry(entry, normalizedEmail))
          .filter((entry): entry is NormalizedPartnerImpactEntry => Boolean(entry));

        const dedupedEntries = new Map<string, NormalizedPartnerImpactEntry>();
        for (const entry of normalizedEntries) {
          dedupedEntries.set(entry.sourceRecordId, entry);
        }

        const docsToWrite = Array.from(dedupedEntries.values()).map((entry) => {
          const docId = `t4l_partner_${uid}_${entry.sourceRecordId}`;
          return {
            docId,
            payload: {
              userId: uid,
              title: entry.title,
              description: entry.description,
              categoryGroup: entry.categoryGroup,
              ...(entry.esgCategory ? { esgCategory: entry.esgCategory } : {}),
              ...(entry.activityType ? { activityType: entry.activityType } : {}),
              ...(entry.businessCategory ? { businessCategory: entry.businessCategory } : {}),
              ...(entry.businessActivity ? { businessActivity: entry.businessActivity } : {}),
              ...(entry.liftPillars ? { liftPillars: entry.liftPillars } : {}),
              date: entry.date,
              hours: entry.hours,
              peopleImpacted: entry.peopleImpacted,
              usdValue: entry.usdValue,
              verificationLevel: entry.verificationLevel,
              ...(entry.verifierEmail ? { verifierEmail: entry.verifierEmail } : {}),
              ...(entry.evidenceLink ? { evidenceLink: entry.evidenceLink } : {}),
              points: 0,
              impactValue: entry.impactValue,
              scp: entry.scp,
              verificationMultiplier: 1,
              createdAt: entry.createdAt,
              sourcePlatform: "t4l_partner",
              sourceRecordId: entry.sourceRecordId,
              sourceEmail: normalizedEmail,
              sourceSyncedAt: nowIso,
              readOnly: true,
            },
          };
        });

        let insertedCount = 0;
        let updatedCount = 0;

        for (let i = 0; i < docsToWrite.length; i += 200) {
          const chunk = docsToWrite.slice(i, i + 200);
          const refs = chunk.map((entry) => db.collection(IMPACT_LOG_COLLECTION).doc(entry.docId));
          const snapshots = await db.getAll(...refs);
          for (let index = 0; index < snapshots.length; index++) {
            if (snapshots[index].exists) updatedCount += 1;
            else insertedCount += 1;
          }
        }

        for (let i = 0; i < docsToWrite.length; i += 400) {
          const chunk = docsToWrite.slice(i, i + 400);
          const batch = db.batch();
          for (const entry of chunk) {
            const ref = db.collection(IMPACT_LOG_COLLECTION).doc(entry.docId);
            batch.set(ref, entry.payload, { merge: true });
          }
          await batch.commit();
        }

        const skippedCount = Math.max(0, partnerEntries.length - normalizedEntries.length);

        await syncStateRef.set(
          {
            uid,
            email: normalizedEmail,
            status: "success",
            message: `Synced ${docsToWrite.length} partner impact entr${docsToWrite.length === 1 ? "y" : "ies"}.`,
            fetchedCount: partnerEntries.length,
            importedCount: insertedCount,
            updatedCount,
            skippedCount,
            lastAttemptAt: nowIso,
            lastSuccessfulPullAt: nowIso,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return {
          status: "success",
          message: `Synced ${docsToWrite.length} partner impact entr${docsToWrite.length === 1 ? "y" : "ies"}.`,
          fetchedCount: partnerEntries.length,
          importedCount: insertedCount,
          updatedCount,
          skippedCount,
          lastSyncedAt: nowIso,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Partner impact sync failed.";
        await syncStateRef.set(
          {
            uid,
            status: "error",
            message,
            lastAttemptAt: nowIso,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        throw new functions.https.HttpsError("internal", "Partner impact sync failed.");
      }
    }
  );
