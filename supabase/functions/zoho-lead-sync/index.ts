// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ---------------------------------------------------------------------------
// zoho-lead-sync  (FUNCTION_VERSION lets us confirm which build is live)
// Syncs a completed lift_leads row to Zoho CRM as a Lead. Fetches the row by id
// (works for a manual {"lead_id":...} call OR the Supabase webhook payload),
// gates on completed_at + zoho_lead_id, creates the Zoho lead, writes the id back.
// ---------------------------------------------------------------------------
const FUNCTION_VERSION = "2026-07-03-layout-owner-desc";

// Structured custom fields (boss's spec). OFF until the fields exist in Zoho AND
// the API names below are confirmed via /settings/fields — sending an unknown
// API name makes Zoho reject the WHOLE create. Flip ZOHO_INCLUDE_CUSTOM_FIELDS=true
// only after that. The keys are the PROPOSED api names; correct any that Zoho
// generated differently after the discovery step.
const INCLUDE_CUSTOM_FIELDS = (Deno.env.get("ZOHO_INCLUDE_CUSTOM_FIELDS") || "").toLowerCase() === "true";
// Confirmed via /crm/v2/settings/fields?module=Leads on 2026-07-02.
const CF = {
  archetype: "LIFT_Archetype",
  scoreL: "Score_Leading_Self",
  scoreI: "Score_Innovation_and_AI",
  scoreF: "Score_Fostering_Teams",
  scoreT: "Score_Transforming_Business",
  carry: "Carry_Pillar",
  edge: "Edge_Pillar",
  resultUrl: "Result_URL",
  gatewayUrl: "Gateway_URL",
  completedAt: "Completed_At",
  seniority: "Seniority",
  cadence: "Cadence_Track",
  // Manager_and_up is a Zoho FORMULA field — Zoho computes it, we never send it.
  // LinkedIn_Profile_URL, Booking_Status, Booked_At have no source yet — left empty on purpose.
};

const ZOHO_DC = Deno.env.get("ZOHO_DC") || "com";
// Target module: "Leads" (standard) or a custom module's API name (e.g. "LIFT_Assessment").
// Set via the ZOHO_MODULE secret. Custom modules need the token minted with
// ZohoCRM.modules.ALL scope, and every field (incl. contact fields) must exist on them.
const MODULE = Deno.env.get("ZOHO_MODULE") || "Leads";
const TOKEN_URL = `https://accounts.zoho.${ZOHO_DC}/oauth/v2/token`;
const API_URL = `https://www.zohoapis.${ZOHO_DC}/crm/v2/${MODULE}`;

// Custom-module field API names (used only when MODULE != "Leads"). A custom
// module has NO Email/Phone/etc. unless created; confirm every name via
// /settings/fields?module=<MODULE> and correct here before enabling.
const NAME_FIELD = Deno.env.get("ZOHO_NAME_FIELD") || "Name"; // the module's mandatory single-line record name
const CONTACT = {
  firstName: "First_Name",
  lastName: "Last_Name",
  email: "Email",
  phone: "Phone",
  organisation: "Organisation",
  country: "Country",
};

// In-memory access-token cache. An access token is valid ~1h; reusing it across
// invocations on a warm isolate avoids hammering Zoho's token endpoint (which
// rate-limits "too many requests"). Cold starts re-refresh, which is fine.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Reuse a still-valid token, refreshing ~2 min before its 1h expiry.
  if (cachedToken && Date.now() < cachedToken.expiresAt - 120_000) {
    return cachedToken.value;
  }

  const clientId = Deno.env.get("ZOHO_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
  const refreshToken = Deno.env.get("ZOHO_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Zoho credentials (ZOHO_CLIENT_ID / SECRET / REFRESH_TOKEN)");
  }

  const formData = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Token refresh failed (HTTP ${response.status}): ${text}`);
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error(`Token refresh returned no access_token: ${text}`);

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return data.access_token;
}

function getOwnerId(tier: string | null): string | null {
  if (tier === "A") return Deno.env.get("ZOHO_OWNER_TIER_A") || null;
  if (tier === "B") return Deno.env.get("ZOHO_OWNER_TIER_B") || null;
  if (tier === "C") return Deno.env.get("ZOHO_OWNER_TIER_C") || null;
  return null;
}

// ── Assessment config — a mirror of src/config/liftAssessment.ts so the Zoho
// Description reproduces EXACTLY what the admin "eye" modal shows. If the
// questions / labels change in that file, update them here too.
const SCALE_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const PILLAR_NAMES: Record<string, string> = {
  L: "Leading Self in the Age of AI",
  I: "Innovation and AI for Digital Transformation",
  F: "Fostering AI-Ready Teams",
  T: "Transforming Business with AI",
};
const ITEMS: { id: string; pillar: string; text: string }[] = [
  { id: "L1", pillar: "L", text: "I stay steady and clear-headed when a transformation gets chaotic." },
  { id: "L2", pillar: "L", text: "I regulate my own reactions before responding under pressure." },
  { id: "L3", pillar: "L", text: "I actively manage my energy and resilience over long change cycles." },
  { id: "L4", pillar: "L", text: "I seek honest feedback on how I show up as a leader." },
  { id: "L5", pillar: "L", text: "I have practices that keep me grounded when stakes are high." },
  { id: "I1", pillar: "I", text: "I can tell where AI and data realistically fit in our work." },
  { id: "I2", pillar: "I", text: "I distinguish genuine opportunity from hype." },
  { id: "I3", pillar: "I", text: "I translate technical possibility into a credible plan." },
  { id: "I4", pillar: "I", text: "I keep current with AI tools relevant to my domain." },
  { id: "I5", pillar: "I", text: "I design solutions that account for real constraints." },
  { id: "F1", pillar: "F", text: "I get teams to actually adopt new ways of working." },
  { id: "F2", pillar: "F", text: "I read and dissolve resistance to change." },
  { id: "F3", pillar: "F", text: "I build psychological safety for experimentation." },
  { id: "F4", pillar: "F", text: "I coach others through the discomfort of change." },
  { id: "F5", pillar: "F", text: "I create conditions where teams keep learning." },
  { id: "T1", pillar: "T", text: "I frame transformation in terms executives act on." },
  { id: "T2", pillar: "T", text: "I build the operating model that sustains change." },
  { id: "T3", pillar: "T", text: "I win sponsorship and budget for transformation." },
  { id: "T4", pillar: "T", text: "I connect transformation to measurable business value." },
  { id: "T5", pillar: "T", text: "I keep change on track across the long haul." },
];
const INTAKE_FIELDS: { id: string; label: string; options: Record<string, string> }[] = [
  {
    id: "role",
    label: "Which best describes your role?",
    options: {
      c_suite: "C-suite (CEO, CTO, CFO, etc.)", vp_head: "VP / Head of function",
      director: "Director", senior_manager: "Senior Manager", manager: "Manager",
      team_lead: "Team Lead", individual_contributor: "Individual contributor",
      consultant: "Consultant", other: "Other",
    },
  },
  { id: "teamSize", label: "How many people do you lead?", options: { "0": "None", "1_10": "1-10", "11_49": "11-49", "50_plus": "50+" } },
  { id: "years", label: "Years of leadership experience", options: { lt5: "Under 5", "5_9": "5-9", "10_plus": "10 or more" } },
  { id: "orgSize", label: "Organization size", options: { "1_50": "1-50", "51_1000": "51-1,000", "1001_plus": "1,001+" } },
];
const GENDER_LABELS: Record<string, string> = { woman: "Woman", man: "Man", non_binary: "Non-binary", prefer_not: "Prefer not to say" };
const TIER_OWNERS: Record<string, string> = { A: "Nono", B: "Nyaga", C: "Ayakwa" };

// Renders the full assessment breakdown (contact + intake + per-item answers +
// scores) as text, mirroring the admin "eye" modal — this becomes the Zoho
// lead's Description so the team sees everything.
// deno-lint-ignore no-explicit-any
function buildDescription(lead: any): string {
  const intake = lead.intake || {};
  const scores = lead.item_scores || {};
  const pillars: Record<string, unknown> = { L: lead.pillar_l, I: lead.pillar_i, F: lead.pillar_f, T: lead.pillar_t };
  const dash = "—";
  const L: string[] = [];

  L.push("=== LIFT ASSESSMENT RESULT ===");
  L.push(`Archetype: ${lead.archetype ?? dash}`);
  L.push(`LIFT Index: ${lead.lift_index ?? dash} / 100`);
  const t = lead.lead_tier;
  L.push(`Lead Tier: ${t ?? dash}${t && TIER_OWNERS[t] ? ` (owner: ${TIER_OWNERS[t]})` : ""}`);
  const edge = lead.development_edge;
  L.push(`Development Edge: ${edge ? `${edge} · ${PILLAR_NAMES[edge] ?? ""}` : dash}`);
  L.push(`Coaching flagged: ${lead.coaching_triggered ? "Yes" : "No"}`);
  if (lead.recommended_offer) L.push(`Recommended Offer: ${lead.recommended_offer}`);
  L.push(`Completed: ${lead.completed_at ?? dash}`);

  L.push("", "--- CONTACT ---");
  L.push(`Name: ${[intake.firstName, intake.lastName].filter(Boolean).join(" ") || dash}`);
  L.push(`Work email: ${lead.email || intake.email || dash}`);
  L.push(`Phone: ${lead.phone || intake.phone || dash}`);
  L.push(`Organisation: ${lead.organisation || intake.organisation || dash}`);
  L.push(`Country: ${lead.country || intake.country || dash}`);
  L.push(`Gender: ${intake.gender ? (GENDER_LABELS[intake.gender] ?? intake.gender) : dash}`);

  L.push("", "--- ABOUT THEM ---");
  for (const f of INTAKE_FIELDS) {
    const v = intake[f.id];
    L.push(`${f.label}  ${v ? (f.options[v] ?? v) : dash}`);
  }

  L.push("", "--- PILLAR SCORES ---");
  for (const k of ["L", "I", "F", "T"]) L.push(`${k} · ${PILLAR_NAMES[k]}: ${pillars[k] ?? dash} / 100`);

  L.push("", "--- ANSWERS ---");
  for (const k of ["L", "I", "F", "T"]) {
    L.push("", `[${k}] ${PILLAR_NAMES[k]}  (${pillars[k] ?? dash} / 100)`);
    for (const item of ITEMS.filter((i) => i.pillar === k)) {
      const s = scores[item.id];
      const ans = typeof s === "number" ? (SCALE_LABELS[s] ?? String(s)) : dash;
      L.push(`  • ${item.text}  →  ${ans}`);
    }
  }

  return L.join("\n");
}

// Short pillar names for the boss's Carry/Edge picklists (MUST match the picklist
// values created in Zoho exactly).
const PILLAR_SHORT: Record<string, string> = {
  L: "Leading Self",
  I: "Innovation and AI",
  F: "Fostering Teams",
  T: "Transforming Business",
};

// Carry pillar = highest-scoring pillar, tie-break L > I > F > T (matches the app).
// deno-lint-ignore no-explicit-any
function carryPillar(lead: any): string | null {
  const scores: [string, number][] = [
    ["L", Number(lead.pillar_l) || 0],
    ["I", Number(lead.pillar_i) || 0],
    ["F", Number(lead.pillar_f) || 0],
    ["T", Number(lead.pillar_t) || 0],
  ];
  let best = scores[0];
  for (const s of scores) if (s[1] > best[1]) best = s; // strict > preserves L>I>F>T order on ties
  return PILLAR_SHORT[best[0]] ?? null;
}

// Seniority mapping (confirmed): our intake.role -> Zoho Seniority_Level picklist.
const SENIORITY_MAP: Record<string, string> = {
  c_suite: "VP or C-suite",
  vp_head: "VP or C-suite",
  director: "Head or Director",
  senior_manager: "Manager",
  manager: "Manager",
  team_lead: "Manager",
  individual_contributor: "IC",
  consultant: "IC",
  // other -> omitted
};

// Cadence Track (confirmed): coaching flag wins; else tier A/B -> A/B, C -> Nurture.
// deno-lint-ignore no-explicit-any
function cadenceTrack(lead: any): string | null {
  if (lead.coaching_triggered) return "Coaching";
  const t = lead.lead_tier;
  if (t === "A") return "A";
  if (t === "B") return "B";
  if (t === "C") return "Nurture";
  return null;
}

// Zoho DateTime fields are strict: ISO 8601, NO fractional seconds, offset as
// "+00:00" (not "Z"). PostgREST gives microseconds (…36.349387+00:00), which
// Zoho rejects. Normalize to "2026-07-02T12:45:36+00:00".
function toZohoDateTime(ts: unknown): string | null {
  if (!ts) return null;
  const d = new Date(ts as string);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d+Z$/, "+00:00");
}

// deno-lint-ignore no-explicit-any
async function createLead(lead: any, accessToken: string): Promise<string> {
  const leadData: Record<string, unknown> = {};

  if (MODULE === "Leads") {
    // Leads REQUIRES Last_Name + Company; fall back so anonymous takers never fail.
    leadData.Last_Name = lead.last_name || "(not provided)";
    leadData.Company = lead.organisation || "Individual";
    leadData.Lead_Source = "LIFT Assessment";
    if (lead.first_name) leadData.First_Name = lead.first_name;
    if (lead.email) leadData.Email = lead.email;
    if (lead.phone) leadData.Phone = lead.phone;
    // Leads' standard country field is "Country_Region" (NOT "Country") — using
    // "Country" silently dropped the value on earlier tests.
    if (lead.country) leadData.Country_Region = lead.country;
  } else {
    // Custom module: mandatory single-line record name + contact fields (each
    // must exist on the module; API names in CONTACT/NAME_FIELD, confirm first).
    const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
    leadData[NAME_FIELD] = fullName || lead.email || "LIFT Lead";
    if (lead.first_name) leadData[CONTACT.firstName] = lead.first_name;
    if (lead.last_name) leadData[CONTACT.lastName] = lead.last_name;
    if (lead.email) leadData[CONTACT.email] = lead.email;
    if (lead.phone) leadData[CONTACT.phone] = lead.phone;
    if (lead.organisation) leadData[CONTACT.organisation] = lead.organisation;
    if (lead.country) leadData[CONTACT.country] = lead.country;
  }

  // The full assessment breakdown (everything the admin "eye" view shows) goes
  // into the standard Description field — no custom fields, so Zoho can't reject
  // the create on an unknown field API name.
  leadData.Description = buildDescription(lead);

  // Structured custom fields (gated). Only set values we actually have; unknown
  // ones stay empty. A field is added only when non-null, so we never push a
  // blank that could trip a required/validation rule.
  if (INCLUDE_CUSTOM_FIELDS) {
    const set = (key: string, val: unknown) => {
      if (val !== null && val !== undefined && val !== "") leadData[key] = val;
    };
    set(CF.archetype, lead.archetype);
    set(CF.scoreL, lead.pillar_l);
    set(CF.scoreI, lead.pillar_i);
    set(CF.scoreF, lead.pillar_f);
    set(CF.scoreT, lead.pillar_t);
    set(CF.carry, carryPillar(lead));
    set(CF.edge, lead.development_edge ? PILLAR_SHORT[lead.development_edge] : null);
    set(CF.completedAt, toZohoDateTime(lead.completed_at)); // Zoho-strict datetime (no microseconds, +00:00)
    set(CF.seniority, lead.intake?.role ? SENIORITY_MAP[lead.intake.role] : null);
    set(CF.cadence, cadenceTrack(lead));
    // Gateway URL is a fixed marketing link supplied via env (optional).
    set(CF.gatewayUrl, Deno.env.get("ZOHO_GATEWAY_URL") || null);
    // resultUrl / LinkedIn / Booking_* intentionally omitted — no source yet.
  }

  const ownerId = getOwnerId(lead.lead_tier);
  if (ownerId) leadData.Owner = { id: ownerId };

  // Place the record on a specific Leads layout (e.g. "LIFT Assessment") when
  // its layout id is configured. Without this, Zoho files new records under the
  // default ("Standard"/"Leads") layout, so a "Layout is LIFT Assessment" filter
  // shows nothing. Set ZOHO_LEADS_LAYOUT_ID to the layout's id to route them.
  const layoutId = Deno.env.get("ZOHO_LEADS_LAYOUT_ID");
  if (layoutId && MODULE === "Leads") leadData.Layout = { id: layoutId };

  // POST once. If Zoho rejects the record SPECIFICALLY because the Owner is
  // invalid (e.g. the tier's routing user was deactivated/deleted in Zoho),
  // retry WITHOUT the Owner so a routing misconfig degrades to an unassigned
  // lead instead of losing it entirely. Any other error still throws.
  let attempt = await postCreate(leadData, accessToken);
  if (!attempt.ok && ownerId && isOwnerError(attempt.body)) {
    console.warn(`zoho-lead-sync: Owner ${ownerId} rejected by Zoho, retrying unassigned`);
    delete leadData.Owner;
    attempt = await postCreate(leadData, accessToken);
  }
  if (!attempt.ok) {
    throw new Error(`Zoho create failed (HTTP ${attempt.status}): ${attempt.raw}`);
  }
  return attempt.id as string;
}

// Single create attempt. Zoho returns HTTP 2xx even for per-record validation
// errors, so success is judged by the per-record status + details.id (NOT
// data[0].id). Returns the parsed body so the caller can inspect error codes.
// deno-lint-ignore no-explicit-any
async function postCreate(
  leadData: Record<string, unknown>,
  accessToken: string,
): Promise<{ ok: boolean; id?: string; status: number; raw: string; body: any }> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: [leadData] }),
  });
  const raw = await response.text();
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = JSON.parse(raw); } catch { /* leave {} */ }
  const record = body?.data?.[0];
  const ok = response.ok && record?.status === "success" && !!record?.details?.id;
  return { ok, id: record?.details?.id, status: response.status, raw, body };
}

// True when Zoho rejected the record because of the Owner field specifically.
// deno-lint-ignore no-explicit-any
function isOwnerError(body: any): boolean {
  const record = body?.data?.[0];
  return record?.code === "INVALID_DATA" && record?.details?.api_name === "Owner";
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let leadId: string | null = null;

  try {
    // Verify the caller is our webhook / trusted manual call.
    const expectedSecret = Deno.env.get("ZOHO_WEBHOOK_SECRET");
    if (expectedSecret && req.headers.get("Authorization") !== `Bearer ${expectedSecret}`) {
      return json(401, { error: "unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    leadId =
      body.lead_id || body.id || body.record?.id || body.old_record?.id ||
      url.searchParams.get("lead_id");

    if (!leadId) {
      return json(400, { error: "missing_lead_id", version: FUNCTION_VERSION });
    }

    // Fetch the authoritative row (service role bypasses RLS).
    const fetchResponse = await fetch(
      `${supabaseUrl}/rest/v1/lift_leads?select=*&id=eq.${leadId}`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch lead: HTTP ${fetchResponse.status}`);
    }
    const leads = await fetchResponse.json();
    if (!leads?.length) {
      return json(404, { error: "lead_not_found", lead_id: leadId, version: FUNCTION_VERSION });
    }
    const lead = leads[0];

    if (!lead.completed_at) {
      return json(200, { skipped: "not_completed", lead_id: leadId, version: FUNCTION_VERSION });
    }
    if (lead.zoho_lead_id) {
      return json(200, {
        skipped: "already_synced",
        zoho_lead_id: lead.zoho_lead_id,
        version: FUNCTION_VERSION,
      });
    }

    const accessToken = await getAccessToken();
    const zohoLeadId = await createLead(lead, accessToken); // throws on any failure

    await patchLead(supabaseUrl, supabaseKey, leadId, {
      zoho_lead_id: zohoLeadId,
      zoho_synced_at: new Date().toISOString(),
      zoho_sync_error: null,
    });

    console.log(`zoho-lead-sync ok: ${leadId} -> ${zohoLeadId}`);
    return json(200, { ok: true, zoho_lead_id: zohoLeadId, version: FUNCTION_VERSION });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorType = message.includes("Zoho create failed") ? "zoho_sync_failed" : "internal_error";
    console.error(`zoho-lead-sync error: ${leadId} ${message}`);
    if (leadId) {
      // Best-effort: record the failure on the row so it's visible in SQL.
      await patchLead(supabaseUrl, supabaseKey, leadId, { zoho_sync_error: message }).catch(() => {});
    }
    return json(errorType === "zoho_sync_failed" ? 422 : 500, {
      error: errorType,
      message,
      version: FUNCTION_VERSION,
    });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function patchLead(
  supabaseUrl: string,
  supabaseKey: string,
  leadId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/lift_leads?id=eq.${leadId}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update lead: HTTP ${res.status}`);
}
