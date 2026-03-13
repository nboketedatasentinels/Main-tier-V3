import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { ALLOWED_ORIGINS, applyCors } from "./cors";

const db = admin.firestore();
const IMPACT_LOG_COLLECTION = "impact_logs";
const SYNC_STATE_COLLECTION = "external_impact_sync_state";

type JsonRecord = Record<string, unknown>;
type SyncActor = "callable" | "http" | "cron";

interface SyncPartnerImpactLogsRequest { forceFullRefresh?: boolean }
interface SyncPartnerImpactLogsResponse {
  status: "success" | "skipped";
  message: string;
  fetchedCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  lastSyncedAt: string;
}

const toRecord = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : null;
const normalizeEmail = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null;
const getString = (r: JsonRecord, keys: string[]): string | null => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};
const getNumber = (r: JsonRecord, keys: string[], fallback = 0): number => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
};
const getBool = (r: JsonRecord, key: string, fallback = false): boolean =>
  typeof r[key] === "boolean" ? (r[key] as boolean) : fallback;
const parseDate = (v: unknown): Date | null => {
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

function resolvePartnerConfig() {
  const cfg = functions.config() as {
    partnerimpact?: { api_url?: string; api_token?: string; timeout_ms?: string | number; cron_batch_size?: string | number };
    partner_impact?: { api_url?: string; api_token?: string; timeout_ms?: string | number; cron_batch_size?: string | number };
  };
  const block = cfg.partnerimpact ?? cfg.partner_impact ?? {};
  const apiUrl = (process.env.T4L_PARTNER_IMPACT_API_URL ?? block.api_url ?? "").trim();
  const apiToken = (process.env.T4L_PARTNER_IMPACT_API_TOKEN ?? block.api_token ?? "").trim();
  const timeoutRaw = process.env.T4L_PARTNER_IMPACT_TIMEOUT_MS ?? block.timeout_ms ?? 20000;
  const timeoutMs = Math.min(Math.max(Number(timeoutRaw) || 20000, 1000), 60000);
  const cronBatchRaw = process.env.T4L_PARTNER_IMPACT_CRON_BATCH_SIZE ?? block.cron_batch_size ?? 40;
  const cronBatchSize = Math.min(Math.max(Math.floor(Number(cronBatchRaw) || 40), 1), 200);
  if (!apiUrl) throw new functions.https.HttpsError("failed-precondition", "Partner impact API URL is not configured.");
  return { apiUrl, apiToken, timeoutMs, cronBatchSize };
}

function resolveBridgeConfig() {
  const cfg = functions.config() as {
    impactbridge?: { shared_token?: string; max_export_rows?: string | number };
    impact_bridge?: { shared_token?: string; max_export_rows?: string | number };
    partnerimpact?: { api_token?: string };
    partner_impact?: { api_token?: string };
  };
  const block = cfg.impactbridge ?? cfg.impact_bridge ?? {};
  const sharedToken = (
    process.env.T4L_IMPACT_BRIDGE_SHARED_TOKEN ??
    block.shared_token ??
    cfg.partnerimpact?.api_token ??
    cfg.partner_impact?.api_token ??
    ""
  ).trim();
  if (!sharedToken) {
    throw new functions.https.HttpsError("failed-precondition", "Impact bridge token is not configured (impactbridge.shared_token).");
  }
  const maxExportRaw = process.env.T4L_IMPACT_BRIDGE_MAX_EXPORT_ROWS ?? block.max_export_rows ?? 1000;
  const maxExportRows = Math.min(Math.max(Math.floor(Number(maxExportRaw) || 1000), 1), 5000);
  return { sharedToken, maxExportRows };
}

const buildSkipped = (msg: string, nowIso: string): SyncPartnerImpactLogsResponse => ({
  status: "skipped",
  message: msg,
  fetchedCount: 0,
  importedCount: 0,
  updatedCount: 0,
  skippedCount: 0,
  lastSyncedAt: nowIso,
});

async function fetchPartnerRows(payload: JsonRecord) {
  const { apiUrl, apiToken, timeoutMs } = resolvePartnerConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiToken) headers.Authorization = apiToken.toLowerCase().startsWith("bearer ") ? apiToken : `Bearer ${apiToken}`;
    const res = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
    const text = await res.text();
    const body = text.trim() ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) throw new functions.https.HttpsError("unavailable", `Partner API returned ${res.status}`);
    if (Array.isArray(body)) return body;
    const rec = toRecord(body);
    if (!rec) return [];
    const candidate = rec.logs ?? rec.entries ?? rec.items ?? rec.data;
    return Array.isArray(candidate) ? candidate : [];
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("deadline-exceeded", "Unable to fetch partner impact entries.");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePartnerRow(raw: unknown, email: string) {
  const r = toRecord(raw);
  if (!r) return null;
  const date = parseDate(r.date ?? r.activityDate ?? r.createdAt ?? r.timestamp);
  if (!date) return null;
  const title = getString(r, ["title", "name", "activityTitle"]) ?? "Partner Impact Activity";
  const description = getString(r, ["description", "details", "summary"]) ?? "";
  const categoryGroup = (getString(r, ["categoryGroup", "category_group"]) ?? "esg").toLowerCase().includes("business")
    ? "business"
    : "esg";
  const sourceRecordId =
    getString(r, ["id", "logId", "entryId", "uuid"]) ??
    createHash("sha256")
      .update(`${email}|${title}|${date.toISOString()}|${getNumber(r, ["hours", "hoursSpent"])}|${getNumber(r, ["peopleImpacted"])}`)
      .digest("hex")
      .slice(0, 48);

  const hours = Math.max(0, getNumber(r, ["hours", "hoursSpent", "durationHours"], 0));
  const people = Math.max(0, getNumber(r, ["peopleImpacted", "participants", "beneficiaries"], 0));
  const usd = Math.max(0, getNumber(r, ["usdValue", "value", "financialImpact"], 0));
  return {
    sourceRecordId,
    title,
    description,
    categoryGroup,
    date: date.toISOString().slice(0, 10),
    createdAt: date.toISOString(),
    hours,
    peopleImpacted: people,
    usdValue: usd,
    verificationLevel: getString(r, ["verificationLevel", "verificationTier"]) ?? "Tier 1: Self-Reported",
    verifierEmail: getString(r, ["verifierEmail"]) ?? undefined,
    evidenceLink: getString(r, ["evidenceLink", "proofUrl"]) ?? undefined,
    activityType: getString(r, ["activityType", "activity"]) ?? undefined,
    businessCategory: getString(r, ["businessCategory"]) ?? undefined,
    businessActivity: getString(r, ["businessActivity"]) ?? undefined,
    esgCategory: getString(r, ["esgCategory"]) ?? undefined,
    impactValue: Math.round(hours * 75 + people * 10),
    scp: Math.round(hours * 5 + people * 2.5),
  };
}

async function syncPartnerImpactLogsForUid(uid: string, forceFullRefresh: boolean, actor: SyncActor): Promise<SyncPartnerImpactLogsResponse> {
  const nowIso = new Date().toISOString();
  const stateRef = db.collection(SYNC_STATE_COLLECTION).doc(uid);
  try {
    const [authUser, stateSnap] = await Promise.all([admin.auth().getUser(uid), stateRef.get()]);
    const email = normalizeEmail(authUser.email);
    if (!email) return buildSkipped("No verified email is available for partner-impact linking.", nowIso);
    if (!authUser.emailVerified) return buildSkipped("Verify your Google account email before syncing partner impact logs.", nowIso);
    if (!authUser.providerData.some((p) => p.providerId === "google.com")) {
      return buildSkipped("Link a Google account to enable secure email-based partner-impact sync.", nowIso);
    }

    const state = stateSnap.exists ? (toRecord(stateSnap.data()) ?? {}) : {};
    const since = !forceFullRefresh ? getString(state, ["lastSuccessfulPullAt"]) : null;
    const rows = await fetchPartnerRows({ email, firebaseUid: uid, includeHistorical: true, ...(since ? { since } : {}) });
    const normalized = rows.map((r) => normalizePartnerRow(r, email)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    const deduped = new Map(normalized.map((r) => [r.sourceRecordId, r]));

    let inserted = 0;
    let updated = 0;
    const docs = Array.from(deduped.values());
    for (const entry of docs) {
      const docId = `t4l_partner_${uid}_${entry.sourceRecordId}`;
      const ref = db.collection(IMPACT_LOG_COLLECTION).doc(docId);
      const existing = await ref.get();
      if (existing.exists) updated += 1;
      else inserted += 1;
      await ref.set(
        {
          userId: uid,
          ...entry,
          points: 0,
          verificationMultiplier: 1,
          sourcePlatform: "t4l_partner",
          sourceEmail: email,
          sourceSyncedAt: nowIso,
          readOnly: true,
        },
        { merge: true }
      );
    }

    const response: SyncPartnerImpactLogsResponse = {
      status: "success",
      message: `Synced ${docs.length} partner impact entr${docs.length === 1 ? "y" : "ies"}.`,
      fetchedCount: rows.length,
      importedCount: inserted,
      updatedCount: updated,
      skippedCount: Math.max(0, rows.length - normalized.length),
      lastSyncedAt: nowIso,
    };
    await stateRef.set(
      { uid, email, actor, ...response, lastAttemptAt: nowIso, lastSuccessfulPullAt: nowIso, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Partner impact sync failed.";
    await stateRef.set({ uid, actor, status: "error", message, lastAttemptAt: nowIso, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("internal", "Partner impact sync failed.");
  }
}

async function runCronSync(batchSize: number) {
  const startedAt = new Date().toISOString();
  const snap = await db.collection(SYNC_STATE_COLLECTION).orderBy("lastAttemptAt", "asc").limit(batchSize).get();
  let successfulUsers = 0;
  let skippedUsers = 0;
  let failedUsers = 0;
  for (const doc of snap.docs) {
    try {
      const result = await syncPartnerImpactLogsForUid(doc.id, false, "cron");
      if (result.status === "success") successfulUsers += 1;
      else skippedUsers += 1;
    } catch {
      failedUsers += 1;
    }
  }
  return { status: "success", message: `Processed ${snap.size} candidates.`, processedUsers: snap.size, successfulUsers, skippedUsers, failedUsers, startedAt, completedAt: new Date().toISOString() };
}

export const syncPartnerImpactLogs = functions.region("us-central1").https.onCall(async (data: SyncPartnerImpactLogsRequest | undefined, context) => {
  if (!context.auth?.uid) throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  return syncPartnerImpactLogsForUid(context.auth.uid, Boolean(data?.forceFullRefresh), "callable");
});

export const partnerImpactBridgeApi = functions.region("us-central1").https.onRequest(async (req, res) => {
  let bridge;
  try {
    bridge = resolveBridgeConfig();
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Bridge config missing." });
    return;
  }
  const cors = applyCors(req, res);
  if (cors.done) return;
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed." }); return; }
  const auth = (req.get("authorization") ?? "").trim().replace(/^Bearer\s+/i, "");
  if (!auth || auth !== bridge.sharedToken) { res.status(401).json({ ok: false, error: "Unauthorized." }); return; }

  const payload = toRecord(req.body);
  if (!payload) { res.status(400).json({ ok: false, error: "Invalid request body." }); return; }
  const action = getString(payload, ["action"]);
  try {
    if (action === "sync_user") {
      const uid = getString(payload, ["uid", "userId"]);
      if (!uid) { res.status(400).json({ ok: false, error: "sync_user requires uid." }); return; }
      const result = await syncPartnerImpactLogsForUid(uid, getBool(payload, "forceFullRefresh", false), "http");
      res.status(200).json({ ok: true, action, result }); return;
    }
    if (action === "sync_by_email") {
      const email = normalizeEmail(payload.email);
      if (!email) { res.status(400).json({ ok: false, error: "sync_by_email requires email." }); return; }
      const user = await admin.auth().getUserByEmail(email);
      const result = await syncPartnerImpactLogsForUid(user.uid, getBool(payload, "forceFullRefresh", false), "http");
      res.status(200).json({ ok: true, action, uid: user.uid, result }); return;
    }
    if (action === "export_user_logs" || action === "export_by_email") {
      const uid =
        action === "export_user_logs"
          ? getString(payload, ["uid", "userId"])
          : (await admin.auth().getUserByEmail(normalizeEmail(payload.email) ?? "")).uid;
      if (!uid) { res.status(400).json({ ok: false, error: "Missing uid/email." }); return; }
      const limit = Math.min(Math.max(Math.floor(getNumber(payload, ["limit"], bridge.maxExportRows)), 1), bridge.maxExportRows);
      const since = parseDate(payload.since);
      const snap = await db.collection(IMPACT_LOG_COLLECTION).where("userId", "==", uid).orderBy("createdAt", "desc").limit(limit).get();
      const logs = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as JsonRecord) }))
        .filter((log: { id: string; [key: string]: unknown }) => {
          if (!since) return true;
          const createdAt = parseDate(log.createdAt);
          const entryDate = parseDate(log.date);
          return (createdAt ?? entryDate)?.getTime() ?? 0 >= since.getTime();
        });
      res.status(200).json({ ok: true, action, result: { uid, count: logs.length, logs } }); return;
    }
    if (action === "sync_candidates") {
      const batchSize = Math.min(Math.max(Math.floor(getNumber(payload, ["batchSize"], resolvePartnerConfig().cronBatchSize)), 1), 200);
      const summary = await runCronSync(batchSize);
      res.status(200).json({ ok: true, action, summary }); return;
    }
    if (action === "import_entries") {
      const uid = getString(payload, ["uid", "userId", "firebase_uid"]);
      if (!uid) { res.status(400).json({ ok: false, error: "import_entries requires uid/firebase_uid." }); return; }
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      if (entries.length === 0) { res.status(400).json({ ok: false, error: "import_entries requires a non-empty entries array." }); return; }
      let imported = 0;
      let skipped = 0;
      const nowIso = new Date().toISOString();
      for (const raw of entries) {
        const r = toRecord(raw);
        if (!r) { skipped += 1; continue; }
        const sourceId = getString(r, ["source_entry_id", "sourceEntryId", "id"]);
        if (!sourceId) { skipped += 1; continue; }
        const docId = `amb_${uid}_${sourceId}`;
        const ref = db.collection(IMPACT_LOG_COLLECTION).doc(docId);
        const existing = await ref.get();
        if (existing.exists && existing.data()?.sourcePlatform === "t4l_ambassadors") { skipped += 1; continue; }
        await ref.set({
          userId: uid,
          title: getString(r, ["title"]) || "Ambassador Impact Activity",
          description: getString(r, ["description"]) || "",
          categoryGroup: getString(r, ["category_group", "categoryGroup"]) || "esg",
          esgCategory: getString(r, ["esg_category", "esgCategory"]) || undefined,
          date: getString(r, ["date", "activity_date"]) || nowIso.slice(0, 10),
          hours: getNumber(r, ["hours", "volunteer_hours"], 0),
          peopleImpacted: getNumber(r, ["people_impacted", "peopleImpacted"], 0),
          usdValue: getNumber(r, ["usd_value", "usdValue"], 0),
          points: getNumber(r, ["points"], 0),
          impactValue: getNumber(r, ["impact_value", "impactValue"], 0),
          scp: getNumber(r, ["scp"], 0),
          verificationLevel: getString(r, ["verification_level", "verificationLevel"]) || "Tier 1: Self-Reported",
          sourcePlatform: "t4l_ambassadors",
          sourceEntryId: sourceId,
          sourceSyncedAt: nowIso,
          createdAt: getString(r, ["created_at", "createdAt"]) || nowIso,
          entryType: getString(r, ["entry_type", "entryType"]) || "individual",
          readOnly: true,
        }, { merge: true });
        imported += 1;
      }
      res.status(200).json({ ok: true, action, result: { uid, imported, skipped, total: entries.length } }); return;
    }
    if (action === "health") { res.status(200).json({ ok: true, status: "ready", origins: Array.from(ALLOWED_ORIGINS) }); return; }
    res.status(400).json({ ok: false, error: "Unsupported action." });
  } catch (err) {
    if (err instanceof functions.https.HttpsError) { res.status(500).json({ ok: false, error: err.message, code: err.code }); return; }
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Bridge request failed." });
  }
});

export const syncPartnerImpactLogsCron = functions
  .region("us-central1")
  .pubsub.schedule("every 30 minutes")
  .timeZone("UTC")
  .onRun(async () => {
    const summary = await runCronSync(resolvePartnerConfig().cronBatchSize);
    functions.logger.info("[partner-impact] cron summary", summary);
    return summary;
  });
