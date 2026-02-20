import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { applyCors } from "./cors";

const db = admin.firestore();
const LOGS = "impact_logs";
const EVENTS = "impact_events";
const ADMIN_ROLES = new Set(["super_admin", "admin", "partner"]);
const EVENT_CREATOR_ROLES = new Set(["ambassador", "partner", "admin", "super_admin"]);
const MULTIPLIERS: Record<string, number> = {
  "Tier 1: Self-Reported": 1,
  "Tier 2: Partner Verified": 1.5,
  "Tier 3: Evidence Uploaded": 2,
  "Tier 4: Third-Party Verified": 2.5,
};

type Obj = Record<string, unknown>;

class ApiErr extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const rec = (v: unknown): Obj => ((typeof v === "object" && v && !Array.isArray(v)) ? (v as Obj) : {});
const nRole = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase() : "user");
const nEmail = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return s || null;
};
const num = (v: unknown, d = 0): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return d;
};
const dateOk = (v: unknown): Date | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const nowIso = (): string => new Date().toISOString();

function bearer(req: functions.https.Request): string | null {
  const h = (req.get("authorization") ?? "").trim();
  if (!h) return null;
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim() || null;
  return h;
}

async function auth(req: functions.https.Request, optional = false): Promise<{ uid: string; role: string } | null> {
  const token = bearer(req);
  if (!token) {
    if (optional) return null;
    throw new ApiErr(401, "Authorization token is required.");
  }
  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    if (optional) return null;
    throw new ApiErr(401, "Invalid authentication token.");
  }
  const uid = decoded.uid;
  const claimRole = nRole(decoded.role);
  if (claimRole && claimRole !== "user") return { uid, role: claimRole };
  const [u, p] = await Promise.all([db.collection("users").doc(uid).get(), db.collection("profiles").doc(uid).get()]);
  const role = nRole(u.data()?.role) !== "user" ? nRole(u.data()?.role) : nRole(p.data()?.role);
  return { uid, role: role || "user" };
}

function isAdmin(role: string): boolean {
  return ADMIN_ROLES.has(nRole(role));
}

function compute(values: { categoryGroup: "esg" | "business"; esgCategory?: string; hours: number; people: number; usd: number; verificationLevel?: string }) {
  const m = MULTIPLIERS[values.verificationLevel ?? "Tier 1: Self-Reported"] ?? 1;
  const c = values.categoryGroup === "business" ? 1.15 : 1;
  const rate = values.esgCategory === "governance" ? 1.1 : values.esgCategory === "social" ? 0.9 : 1;
  const points = (500 + values.hours * 25 + values.usd * 0.05) * c * m;
  const impactValue = (values.hours * 75 * rate + values.people * 10) * m;
  const scp = (values.hours * 5 + values.people * 2.5) * m;
  return { points: Math.round(points), impactValue: Math.round(impactValue), scp: Math.round(scp), verificationMultiplier: m };
}

function pathOf(req: functions.https.Request): string[] {
  const p = (req.path || "/").replace(/\/+$/, "") || "/";
  const root = p.startsWith("/api/impact") ? p.slice("/api/impact".length) || "/" : p;
  return root.split("/").filter(Boolean);
}

function pickPage(req: functions.https.Request): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(num(req.query.page, 1)));
  const pageSize = Math.min(100, Math.max(1, Math.floor(num(req.query.pageSize, 20))));
  return { page, pageSize };
}

function paginate<T>(arr: T[], page: number, pageSize: number) {
  const total = arr.length;
  const start = (page - 1) * pageSize;
  return { items: arr.slice(start, start + pageSize), page, pageSize, total };
}

async function listEvents(ctx: { uid: string; role: string }, req: functions.https.Request): Promise<Obj> {
  const { page, pageSize } = pickPage(req);
  let items: Obj[] = [];
  if (isAdmin(ctx.role)) {
    const snap = await db.collection(EVENTS).orderBy("createdAt", "desc").limit(500).get();
    items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Obj) }));
  } else {
    const [a, b] = await Promise.all([
      db.collection(EVENTS).where("createdBy", "==", ctx.uid).limit(500).get(),
      db.collection(EVENTS).where("participantUids", "array-contains", ctx.uid).limit(500).get(),
    ]);
    const m = new Map<string, Obj>();
    for (const d of [...a.docs, ...b.docs]) m.set(d.id, { id: d.id, ...(d.data() as Obj) });
    items = Array.from(m.values()).sort((x, y) => String(y.createdAt ?? "").localeCompare(String(x.createdAt ?? "")));
  }
  return paginate(items, page, pageSize);
}

async function getEvent(ctx: { uid: string; role: string }, id: string): Promise<Obj> {
  const ref = db.collection(EVENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiErr(404, "Impact event not found.");
  const event = snap.data() as Obj;
  const participantUids = Array.isArray(event.participantUids) ? event.participantUids.map((v) => String(v)) : [];
  const canRead = isAdmin(ctx.role) || event.createdBy === ctx.uid || participantUids.includes(ctx.uid);
  if (!canRead) throw new ApiErr(403, "You do not have access to this event.");
  const partSnap = await ref.collection("participants").get();
  const participants = partSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Obj) }));
  return { event: { id: snap.id, ...event }, participants };
}

async function createEvent(ctx: { uid: string; role: string }, body: Obj): Promise<Obj> {
  if (!EVENT_CREATOR_ROLES.has(nRole(ctx.role))) throw new ApiErr(403, "Only ambassador, partner, or admin roles can create events.");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!title || !description || !dateOk(date)) throw new ApiErr(400, "title, description and date are required.");
  const totalHours = Math.max(0, num(body.totalHours, num(body.hours, 0)));
  const totalPeople = Math.max(0, num(body.totalPeopleImpacted, num(body.peopleImpacted, 0)));
  const totalUsd = Math.max(0, num(body.totalUsdValue, num(body.usdValue, 0)));
  if (totalHours <= 0 && totalPeople <= 0) throw new ApiErr(400, "Either totalHours or totalPeopleImpacted must be > 0.");
  const categoryGroup = body.categoryGroup === "business" ? "business" : "esg";
  const esgCategory = typeof body.esgCategory === "string" ? body.esgCategory.trim().toLowerCase() : "environmental";
  const metrics = compute({ categoryGroup, esgCategory, hours: totalHours, people: totalPeople, usd: totalUsd, verificationLevel: "Tier 1: Self-Reported" });
  const now = nowIso();
  const eventRef = db.collection(EVENTS).doc();
  const masterRef = db.collection(LOGS).doc();
  const batch = db.batch();
  batch.set(eventRef, {
    title, description, date, status: "open", categoryGroup, esgCategory,
    createdBy: ctx.uid, createdAt: now, updatedAt: now,
    participantUids: [ctx.uid], participantCount: 1, totalHours, totalPeopleImpacted: totalPeople, totalUsdValue: totalUsd,
    masterEntryId: masterRef.id,
  });
  batch.set(masterRef, {
    userId: ctx.uid, title, description, categoryGroup, esgCategory, date,
    hours: totalHours, peopleImpacted: totalPeople, usdValue: totalUsd,
    verificationLevel: "Tier 1: Self-Reported",
    ...metrics,
    createdAt: now, eventId: eventRef.id, entryType: "event_master", sourcePlatform: "transformation_tier", readOnly: false,
  });
  batch.set(eventRef.collection("participants").doc(`uid_${ctx.uid}`), { uid: ctx.uid, isAnonymous: false, source: "creator", createdAt: now }, { merge: true });
  await batch.commit();
  return { eventId: eventRef.id, masterEntryId: masterRef.id };
}

async function updateEvent(ctx: { uid: string; role: string }, id: string, body: Obj): Promise<Obj> {
  const ref = db.collection(EVENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiErr(404, "Impact event not found.");
  const event = snap.data() as Obj;
  if (!(isAdmin(ctx.role) || event.createdBy === ctx.uid)) throw new ApiErr(403, "Only creator or admin can update.");
  if (event.status === "closed") throw new ApiErr(400, "Closed events cannot be updated.");
  const updates: Obj = { updatedAt: nowIso() };
  const sFields = ["title", "description", "date", "categoryGroup", "esgCategory"];
  for (const f of sFields) {
    if (typeof body[f] === "string" && String(body[f]).trim()) updates[f] = String(body[f]).trim();
  }
  if ("totalHours" in body) updates.totalHours = Math.max(0, num(body.totalHours, 0));
  if ("totalPeopleImpacted" in body) updates.totalPeopleImpacted = Math.max(0, num(body.totalPeopleImpacted, 0));
  if ("totalUsdValue" in body) updates.totalUsdValue = Math.max(0, num(body.totalUsdValue, 0));
  await ref.set(updates, { merge: true });
  return { ok: true, eventId: id };
}

async function closeEvent(ctx: { uid: string; role: string }, id: string): Promise<Obj> {
  const eventRef = db.collection(EVENTS).doc(id);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw new ApiErr(404, "Impact event not found.");
  const event = eventSnap.data() as Obj;
  if (!(isAdmin(ctx.role) || event.createdBy === ctx.uid)) throw new ApiErr(403, "Only creator or admin can close.");
  if (event.status === "closed") throw new ApiErr(400, "Event is already closed.");

  const partsSnap = await eventRef.collection("participants").get();
  const uidSet = new Set<string>();
  if (typeof event.createdBy === "string" && event.createdBy.trim()) uidSet.add(event.createdBy);
  if (Array.isArray(event.participantUids)) {
    event.participantUids.forEach((v) => {
      if (typeof v === "string" && v.trim()) uidSet.add(v);
    });
  }
  for (const d of partsSnap.docs) {
    const v = d.data().uid;
    if (typeof v === "string" && v.trim()) uidSet.add(v);
  }

  const totalHours = Math.max(0, num(event.totalHours, 0));
  const totalPeople = Math.max(0, num(event.totalPeopleImpacted, 0));
  const totalUsd = Math.max(0, num(event.totalUsdValue, 0));
  const count = uidSet.size || 1;
  const h = totalHours / count;
  const p = totalPeople / count;
  const u = totalUsd / count;
  const now = nowIso();

  const batch = db.batch();
  for (const uid of uidSet) {
    const metrics = compute({
      categoryGroup: String(event.categoryGroup ?? "esg") === "business" ? "business" : "esg",
      esgCategory: typeof event.esgCategory === "string" ? event.esgCategory : undefined,
      hours: h,
      people: p,
      usd: u,
      verificationLevel: "Tier 1: Self-Reported",
    });
    const ref = db.collection(LOGS).doc(`impact_event_${id}_${uid}`);
    batch.set(
      ref,
      {
        userId: uid,
        title: `${String(event.title ?? "Shared Impact Event")} - Participant Share`,
        description: String(event.description ?? ""),
        categoryGroup: String(event.categoryGroup ?? "esg") === "business" ? "business" : "esg",
        ...(event.esgCategory ? { esgCategory: event.esgCategory } : {}),
        date: event.date ?? now.slice(0, 10),
        hours: Number(h.toFixed(2)),
        peopleImpacted: Number(p.toFixed(2)),
        usdValue: Number(u.toFixed(2)),
        verificationLevel: "Tier 1: Self-Reported",
        ...metrics,
        createdAt: now,
        eventId: id,
        entryType: "event_derived",
        derivedFromEvent: true,
        sourcePlatform: "transformation_tier",
        readOnly: true,
      },
      { merge: true }
    );
  }

  const linked = await db.collection(LOGS).where("eventId", "==", id).get();
  for (const d of linked.docs) {
    if (d.data().entryType === "event_master") {
      batch.set(
        d.ref,
        {
          hours: 0, peopleImpacted: 0, usdValue: 0,
          points: 0, impactValue: 0, scp: 0,
          eventStatus: "closed", updatedAt: now,
        },
        { merge: true }
      );
    }
  }
  batch.set(eventRef, { status: "closed", closedAt: now, closedBy: ctx.uid, participantCount: uidSet.size, updatedAt: now }, { merge: true });
  await batch.commit();
  return { ok: true, eventId: id, participantCount: uidSet.size };
}

async function deleteEvent(ctx: { uid: string; role: string }, id: string): Promise<Obj> {
  const eventRef = db.collection(EVENTS).doc(id);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw new ApiErr(404, "Impact event not found.");
  const event = eventSnap.data() as Obj;
  if (!(isAdmin(ctx.role) || event.createdBy === ctx.uid)) throw new ApiErr(403, "Only creator or admin can delete.");
  const [parts, logs] = await Promise.all([
    eventRef.collection("participants").get(),
    db.collection(LOGS).where("eventId", "==", id).get(),
  ]);
  const batch = db.batch();
  parts.docs.forEach((d) => batch.delete(d.ref));
  logs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(eventRef);
  await batch.commit();
  return { ok: true, deletedEventId: id, deletedEntries: logs.size };
}

async function publicEvent(id: string): Promise<Obj> {
  const snap = await db.collection(EVENTS).doc(id).get();
  if (!snap.exists) throw new ApiErr(404, "Impact event not found.");
  const d = snap.data() as Obj;
  return {
    event: {
      id: snap.id,
      title: d.title,
      description: d.description,
      date: d.date,
      status: d.status,
      totalHours: d.totalHours,
      totalPeopleImpacted: d.totalPeopleImpacted,
      totalUsdValue: d.totalUsdValue,
      participantCount: d.participantCount ?? 0,
      categoryGroup: d.categoryGroup ?? "esg",
      esgCategory: d.esgCategory ?? null,
      createdAt: d.createdAt,
      closedAt: d.closedAt ?? null,
    },
  };
}

async function participate(id: string, body: Obj, ctx: { uid: string; role: string } | null): Promise<Obj> {
  const eventRef = db.collection(EVENTS).doc(id);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw new ApiErr(404, "Impact event not found.");
  const event = eventSnap.data() as Obj;
  if (event.status === "closed") throw new ApiErr(400, "This event is closed.");
  const now = nowIso();
  const batch = db.batch();
  let participantId = "";

  if (ctx) {
    participantId = `uid_${ctx.uid}`;
    batch.set(
      eventRef.collection("participants").doc(participantId),
      { uid: ctx.uid, isAnonymous: false, role: ctx.role, source: "public", createdAt: now },
      { merge: true }
    );
    batch.set(eventRef, { participantUids: admin.firestore.FieldValue.arrayUnion(ctx.uid), updatedAt: now }, { merge: true });
  } else {
    const hashInput = typeof body.participantHash === "string" ? body.participantHash.trim() : "";
    const email = nEmail(body.email);
    const hash = hashInput || (email ? createHash("sha256").update(email).digest("hex") : "");
    if (!hash) throw new ApiErr(400, "participantHash or email is required for anonymous participation.");
    participantId = `anon_${hash}`;
    batch.set(
      eventRef.collection("participants").doc(participantId),
      {
        participantHash: hash,
        displayName: typeof body.displayName === "string" ? body.displayName.trim() : undefined,
        isAnonymous: true,
        source: "public",
        createdAt: now,
      },
      { merge: true }
    );
    batch.set(eventRef, { updatedAt: now }, { merge: true });
  }
  await batch.commit();
  return { ok: true, eventId: id, participantId };
}

async function listEntries(ctx: { uid: string; role: string }, req: functions.https.Request): Promise<Obj> {
  const { page, pageSize } = pickPage(req);
  const esg = typeof req.query.esg_category === "string" ? req.query.esg_category.trim().toLowerCase() : "";
  const entryType = typeof req.query.entry_type === "string" ? req.query.entry_type.trim().toLowerCase() : "";
  const snap = isAdmin(ctx.role)
    ? await db.collection(LOGS).limit(5000).get()
    : await db.collection(LOGS).where("userId", "==", ctx.uid).limit(5000).get();
  let items: Array<{ id: string; [key: string]: unknown }> = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Obj),
  }));
  if (esg) items = items.filter((i) => String(i.esgCategory ?? "").toLowerCase() === esg);
  if (entryType) items = items.filter((i) => String(i.entryType ?? "").toLowerCase() === entryType);
  items.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return paginate(items, page, pageSize);
}

async function createEntry(ctx: { uid: string; role: string }, body: Obj): Promise<Obj> {
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const hours = Math.max(0, num(body.hours, 0));
  const people = Math.max(0, num(body.peopleImpacted, 0));
  const usd = Math.max(0, num(body.usdValue, 0));
  if (!description || !dateOk(date)) throw new ApiErr(400, "description and valid date are required.");
  if (hours <= 0 && people <= 0) throw new ApiErr(400, "Either hours or peopleImpacted must be > 0.");
  const categoryGroup = body.categoryGroup === "business" ? "business" : "esg";
  const esgCategory = typeof body.esgCategory === "string" ? body.esgCategory.trim().toLowerCase() : "environmental";
  const verificationLevel = typeof body.verificationLevel === "string" ? body.verificationLevel.trim() : "Tier 1: Self-Reported";
  const metrics = compute({ categoryGroup, esgCategory, hours, people, usd, verificationLevel });
  const payload: Obj = {
    userId: ctx.uid,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Impact Activity",
    description,
    categoryGroup,
    ...(esgCategory ? { esgCategory } : {}),
    ...(typeof body.activityType === "string" ? { activityType: body.activityType.trim() } : {}),
    ...(typeof body.businessCategory === "string" ? { businessCategory: body.businessCategory.trim() } : {}),
    ...(typeof body.businessActivity === "string" ? { businessActivity: body.businessActivity.trim() } : {}),
    date,
    hours,
    peopleImpacted: people,
    usdValue: usd,
    verificationLevel,
    ...(typeof body.verifierEmail === "string" ? { verifierEmail: body.verifierEmail.trim() } : {}),
    ...(typeof body.evidenceLink === "string" ? { evidenceLink: body.evidenceLink.trim() } : {}),
    ...(typeof body.outcomeLabel === "string" ? { outcomeLabel: body.outcomeLabel.trim() } : {}),
    ...metrics,
    createdAt: nowIso(),
    entryType: "individual",
    sourcePlatform: "transformation_tier",
    readOnly: false,
  };
  const ref = await db.collection(LOGS).add(payload);
  return { entry: { id: ref.id, ...payload } };
}

function aggregate(items: Obj[]): Obj {
  const byCategory: Record<string, { hours: number; people: number; usd: number; scp: number; points: number; count: number }> = {};
  let hours = 0;
  let people = 0;
  let usd = 0;
  let scp = 0;
  let points = 0;
  for (const item of items) {
    const k = String(item.esgCategory ?? item.categoryGroup ?? "uncategorized").toLowerCase();
    const h = Math.max(0, num(item.hours, 0));
    const p = Math.max(0, num(item.peopleImpacted, 0));
    const u = Math.max(0, num(item.usdValue, 0));
    const s = Math.max(0, num(item.scp, 0));
    const pt = Math.max(0, num(item.points, 0));
    if (!byCategory[k]) byCategory[k] = { hours: 0, people: 0, usd: 0, scp: 0, points: 0, count: 0 };
    byCategory[k].hours += h;
    byCategory[k].people += p;
    byCategory[k].usd += u;
    byCategory[k].scp += s;
    byCategory[k].points += pt;
    byCategory[k].count += 1;
    hours += h;
    people += p;
    usd += u;
    scp += s;
    points += pt;
  }
  return {
    totals: {
      entries: items.length,
      totalHours: Number(hours.toFixed(2)),
      totalPeopleImpacted: Number(people.toFixed(2)),
      totalUsdValue: Number(usd.toFixed(2)),
      totalScp: Math.round(scp),
      totalPoints: Math.round(points),
    },
    byCategory,
    generatedAt: nowIso(),
  };
}

async function myStats(ctx: { uid: string }): Promise<Obj> {
  const snap = await db.collection(LOGS).where("userId", "==", ctx.uid).limit(5000).get();
  return aggregate(snap.docs.map((d) => d.data() as Obj));
}

async function adminAggregates(ctx: { role: string }): Promise<Obj> {
  if (!isAdmin(ctx.role)) throw new ApiErr(403, "Admin access required.");
  const snap = await db.collection(LOGS).limit(5000).get();
  return aggregate(snap.docs.map((d) => d.data() as Obj));
}

async function publicTotals(): Promise<Obj> {
  const snap = await db.collection(LOGS).limit(5000).get();
  const rows = snap.docs.map((d) => d.data() as Obj).filter((r) => String(r.entryType ?? "") !== "event_master");
  const stats = aggregate(rows);
  return { totals: stats.totals, generatedAt: stats.generatedAt };
}

export const impactApi = functions.region("us-central1").https.onRequest(async (req, res) => {
  const cors = applyCors(req, res);
  if (cors.done) return;

  try {
    const parts = pathOf(req);
    const body = rec(req.body);

    if (parts.length === 0) {
      res.status(200).json({ ok: true, service: "impactApi", root: "/api/impact" });
      return;
    }

    if (parts[0] === "events") {
      if (parts.length === 1 && req.method === "GET") { const ctx = await auth(req); res.status(200).json(await listEvents(ctx!, req)); return; }
      if (parts.length === 1 && req.method === "POST") { const ctx = await auth(req); res.status(201).json(await createEvent(ctx!, body)); return; }
      if (parts.length === 2 && req.method === "GET") { const ctx = await auth(req); res.status(200).json(await getEvent(ctx!, parts[1])); return; }
      if (parts.length === 2 && req.method === "PUT") { const ctx = await auth(req); res.status(200).json(await updateEvent(ctx!, parts[1], body)); return; }
      if (parts.length === 2 && req.method === "DELETE") { const ctx = await auth(req); res.status(200).json(await deleteEvent(ctx!, parts[1])); return; }
      if (parts.length === 3 && parts[2] === "close" && req.method === "POST") { const ctx = await auth(req); res.status(200).json(await closeEvent(ctx!, parts[1])); return; }
      if (parts.length === 3 && parts[2] === "public" && req.method === "GET") { res.status(200).json(await publicEvent(parts[1])); return; }
      if (parts.length === 3 && parts[2] === "participate" && req.method === "POST") {
        const ctx = await auth(req, true);
        res.status(200).json(await participate(parts[1], body, ctx));
        return;
      }
    }

    if (parts[0] === "entries") {
      if (parts.length === 1 && req.method === "GET") { const ctx = await auth(req); res.status(200).json(await listEntries(ctx!, req)); return; }
      if (parts.length === 1 && req.method === "POST") { const ctx = await auth(req); res.status(201).json(await createEntry(ctx!, body)); return; }
    }

    if (parts[0] === "my-stats" && req.method === "GET") { const ctx = await auth(req); res.status(200).json(await myStats(ctx!)); return; }
    if (parts[0] === "admin-aggregates" && req.method === "GET") { const ctx = await auth(req); res.status(200).json(await adminAggregates(ctx!)); return; }
    if (parts[0] === "public-totals" && req.method === "GET") { res.status(200).json(await publicTotals()); return; }

    throw new ApiErr(404, "Route not found.");
  } catch (err) {
    if (err instanceof ApiErr) {
      res.status(err.status).json({ ok: false, error: err.message });
      return;
    }
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unexpected error." });
  }
});
