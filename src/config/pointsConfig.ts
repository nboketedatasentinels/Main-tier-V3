import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from "@/utils/windowCalculations";

// ─── Types ──────────────────────────────────────────────────────────────────

export type JourneyType = "4W" | "6W" | "3M" | "6M" | "9M" | "12M";
export type JourneyTimelineDisplayMode = "duration" | "course-count";

export type ActivityId =
  // Core activities
  | "watch_podcast"
  | "podcast_workbook"
  | "weekly_session"
  | "webinar_workbook"
  | "peer_to_peer"
  | "impact_log"
  | "lift_module"
  | "linkedin"
  | "book_club"
  | "peer_matching"
  | "challenger"
  | "mentor_meetup"
  | "ambassador_session"
  | "shameless_circle"
  | "ai_tool_review"
  // System activities
  | "referral_bonus"
  | "peer_session_confirmation"
  | "peer_session_no_show_report"
  // Legacy IDs (kept for Firestore backward compat)
  | "podcast"
  | "webinar"
  | "partner_spotlight"
  | "recognition_over_recall"
  | "von_restorff_effect";

export type ActivityPolicyType = "one_time" | "window_limited" | "ongoing";

export type ApprovalType =
  | "auto"
  | "self"
  | "partner_approved"
  | "partner_issued"
  | "mentor_issued"
  | "ambassador_issued";

export interface ActivityPolicy {
  type: ActivityPolicyType;
  maxTotal?: number;
  maxPerWindow?: number;
  maxPerWeek?: number;
}

export type ActivityDef = {
  id: ActivityId;
  baseId: string;
  title: string;
  description: string;
  points: number;
  /** @deprecated Use activityPolicy instead */
  maxPerMonth: number;
  /** @deprecated Use activityPolicy instead */
  maxPerWeek?: number;
  activityPolicy?: ActivityPolicy;
  cooldownWeeks?: number;
  approvalType: ApprovalType;
  requiresApproval?: boolean;
  isFreeTier?: boolean;
  week: number;
  category: string;
  tags?: string[];
  verification?: "honor" | "partner_approval";
  flexibleWeeks?: boolean;
  frequencyNote?: string;
  visibility?: {
    requiresMentor?: boolean;
    requiresAmbassador?: boolean;
  };
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const REFERRAL_POINTS = 100;
export const REFERRAL_MAX_PER_USER = 100;

// ─── Special Activities ─────────────────────────────────────────────────────

export const REFERRAL_ACTIVITY: ActivityDef = {
  id: "referral_bonus",
  baseId: "referral_bonus",
  title: "Referral Bonus",
  description: "Points awarded for successfully referring a new user who completes their first activity.",
  points: REFERRAL_POINTS,
  maxPerMonth: REFERRAL_MAX_PER_USER,
  activityPolicy: { type: "ongoing", maxTotal: REFERRAL_MAX_PER_USER },
  week: 1,
  category: "Referral",
  approvalType: "partner_issued",
  isFreeTier: true,
  flexibleWeeks: true,
  frequencyNote: "Awarded when a referred user completes their first platform activity.",
};

export const PEER_SESSION_CONFIRMATION_ACTIVITY: ActivityDef = {
  id: "peer_session_confirmation",
  baseId: "peer_session_confirmation",
  title: "Peer Session Confirmed",
  description: "Both participants confirmed the scheduled peer session before the deadline.",
  points: 50,
  maxPerMonth: 20,
  activityPolicy: { type: "ongoing", maxPerWindow: 10 },
  week: 1,
  category: "Networking",
  approvalType: "auto",
  isFreeTier: true,
  flexibleWeeks: true,
  frequencyNote: "Awarded when both peers confirm a session before the confirmation deadline.",
};

export const PEER_SESSION_NO_SHOW_ACTIVITY: ActivityDef = {
  id: "peer_session_no_show_report",
  baseId: "peer_session_no_show_report",
  title: "No-Show Accountability",
  description: "Reported peer no-show for accountability tracking after the session time.",
  points: 25,
  maxPerMonth: 10,
  activityPolicy: { type: "ongoing", maxPerWindow: 5 },
  week: 1,
  category: "Networking",
  approvalType: "auto",
  isFreeTier: true,
  flexibleWeeks: true,
  frequencyNote: "Awarded when you report that your peer did not attend the scheduled session.",
};

// ─── Base Activity Definitions ──────────────────────────────────────────────

/** Internal base type for activity definition before journey-specific overrides */
interface BaseActivityEntry {
  id: ActivityId;
  baseId: string;
  title: string;
  description: string;
  points: number;
  behaviorType: ActivityPolicyType;
  defaultMaxPerWindow?: number;
  approvalType: ApprovalType;
  requiresApproval?: boolean;
  isFreeTier?: boolean;
  week: number;
  category: string;
  tags?: string[];
  verification?: "honor" | "partner_approval";
  flexibleWeeks?: boolean;
  frequencyNote?: string;
  visibility?: {
    requiresMentor?: boolean;
    requiresAmbassador?: boolean;
  };
}

const BASE_ACTIVITY_DEFINITIONS: BaseActivityEntry[] = [
  // ── 4W-only activities ──
  {
    id: "watch_podcast",
    baseId: "watch_podcast",
    title: "Watch Podcast",
    description: "Watch or listen to a podcast episode.",
    points: 1000,
    behaviorType: "ongoing",
    defaultMaxPerWindow: 2,
    approvalType: "auto",
    week: 1,
    category: "Learning",
    isFreeTier: true,
    flexibleWeeks: true,
    frequencyNote: "Watch podcast episodes at your own pace.",
  },
  {
    id: "shameless_circle",
    baseId: "shameless_circle",
    title: "Attend Shameless Circle Session",
    description: "Participate in a shameless circle session for open peer discussion.",
    points: 2500,
    behaviorType: "one_time",
    approvalType: "partner_issued",
    week: 1,
    category: "Community",
    flexibleWeeks: true,
    frequencyNote: "One session per journey.",
  },
  {
    id: "ai_tool_review",
    baseId: "ai_tool_review",
    title: "Submit an AI Tool for Review",
    description: "Submit an AI tool for partner review and feedback.",
    points: 1000,
    behaviorType: "one_time",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    week: 1,
    category: "Innovation",
    flexibleWeeks: true,
    frequencyNote: "One submission per journey.",
  },

  // ── Common activities (available across journey types) ──
  {
    id: "podcast_workbook",
    baseId: "podcast_workbook",
    title: "Podcast + Submit Workbook",
    description: "Listen to podcast and submit completed workbook for partner review.",
    points: 2000,
    behaviorType: "ongoing",
    defaultMaxPerWindow: 3,
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    week: 1,
    category: "Learning",
    flexibleWeeks: true,
    frequencyNote: "Complete podcasts and submit workbooks at your own pace.",
  },
  {
    id: "weekly_session",
    baseId: "weekly_session",
    title: "Attend Weekly Session",
    description: "Attend the scheduled weekly group session.",
    points: 1500,
    behaviorType: "ongoing",
    defaultMaxPerWindow: 2,
    approvalType: "partner_issued",
    week: 1,
    category: "Community",
    flexibleWeeks: true,
    frequencyNote: "One session per week, awarded by your partner.",
  },
  {
    id: "webinar_workbook",
    baseId: "webinar_workbook",
    title: "Attend Webinar + Workbook",
    description: "Attend a live webinar session and submit completed workbook.",
    points: 4000,
    behaviorType: "window_limited",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    week: 2,
    category: "Learning",
    flexibleWeeks: true,
    frequencyNote: "Attend webinar and submit workbook for partner approval.",
  },
  {
    id: "peer_to_peer",
    baseId: "peer_to_peer",
    title: "Peer to Peer Session",
    description: "Participate in a group peer-to-peer session.",
    points: 1000,
    behaviorType: "window_limited",
    approvalType: "self",
    week: 4,
    category: "Networking",
    flexibleWeeks: true,
    frequencyNote: "One session per window.",
  },
  {
    id: "impact_log",
    baseId: "impact_log",
    title: "Impact Log Entry",
    description: "Log an impact story to capture outcomes and progress.",
    points: 1000,
    behaviorType: "window_limited",
    approvalType: "auto",
    isFreeTier: true,
    week: 4,
    category: "Impact",
    flexibleWeeks: true,
    frequencyNote: "Record your impact regularly.",
  },
  {
    id: "lift_module",
    baseId: "lift_module",
    title: "LIFT Course Module Completed",
    description: "Complete a LIFT course module. Points awarded by your partner.",
    points: 3000,
    behaviorType: "window_limited",
    approvalType: "partner_issued",
    week: 2,
    category: "Learning",
    flexibleWeeks: true,
    frequencyNote: "Complete course modules as they become available.",
  },
  {
    id: "linkedin",
    baseId: "linkedin",
    title: "LinkedIn Post About Your Learning",
    description: "Share insights about your learning journey on LinkedIn.",
    points: 500,
    behaviorType: "window_limited",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    week: 3,
    category: "Brand",
    flexibleWeeks: true,
    frequencyNote: "Share your learning journey publicly.",
  },
  {
    id: "book_club",
    baseId: "book_club",
    title: "Attend Book Club Session",
    description: "Participate in a book club discussion session.",
    points: 2500,
    behaviorType: "window_limited",
    approvalType: "partner_issued",
    week: 4,
    category: "Community",
    flexibleWeeks: true,
    frequencyNote: "Attend book club sessions as scheduled.",
  },
  {
    id: "peer_matching",
    baseId: "peer_matching",
    title: "Peer Matching Session",
    description: "Complete a one-on-one peer matching session.",
    points: 1000,
    behaviorType: "ongoing",
    defaultMaxPerWindow: 2,
    approvalType: "self",
    week: 3,
    category: "Networking",
    flexibleWeeks: true,
    frequencyNote: "Connect with matched peers regularly.",
  },
  {
    id: "challenger",
    baseId: "challenger",
    title: "Challenger",
    description: "Complete a challenge activity on the platform.",
    points: 1000,
    behaviorType: "window_limited",
    approvalType: "auto",
    week: 3,
    category: "Learning",
    flexibleWeeks: true,
    frequencyNote: "One challenge per window.",
  },

  // ── 3M+ activities (require mentor/ambassador) ──
  {
    id: "mentor_meetup",
    baseId: "mentor_meetup",
    title: "Mentor Meet Up",
    description: "Attend a scheduled session with your mentor.",
    points: 2000,
    behaviorType: "window_limited",
    approvalType: "mentor_issued",
    week: 1,
    category: "Leadership",
    flexibleWeeks: true,
    frequencyNote: "Points awarded by your mentor after the session.",
    visibility: { requiresMentor: true },
  },
  {
    id: "ambassador_session",
    baseId: "ambassador_session",
    title: "Ambassador Session",
    description: "Attend a session led by an ambassador.",
    points: 2000,
    behaviorType: "window_limited",
    approvalType: "ambassador_issued",
    week: 1,
    category: "Leadership",
    flexibleWeeks: true,
    frequencyNote: "Points awarded by your ambassador after the session.",
    visibility: { requiresAmbassador: true },
  },
];

// Lookup map for base activities
const BASE_ACTIVITY_MAP = new Map<string, BaseActivityEntry>(
  BASE_ACTIVITY_DEFINITIONS.map((a) => [a.id, a])
);

// ─── Journey-Specific Activity Configurations ───────────────────────────────

interface JourneyActivityEntry {
  activityId: ActivityId;
  totalFrequency: number;
  pointsOverride?: number;
}

const JOURNEY_ACTIVITY_CONFIG: Partial<Record<JourneyType, JourneyActivityEntry[]>> = {
  "4W": [
    { activityId: "watch_podcast", totalFrequency: 3 },
    { activityId: "webinar_workbook", totalFrequency: 1, pointsOverride: 3000 },
    { activityId: "impact_log", totalFrequency: 2 },
    { activityId: "lift_module", totalFrequency: 1 },
    { activityId: "book_club", totalFrequency: 1 },
    { activityId: "shameless_circle", totalFrequency: 1 },
    { activityId: "ai_tool_review", totalFrequency: 1 },
  ],
  "6W": [
    { activityId: "podcast_workbook", totalFrequency: 9 },
    { activityId: "weekly_session", totalFrequency: 6 },
    { activityId: "webinar_workbook", totalFrequency: 1 },
    { activityId: "peer_to_peer", totalFrequency: 3 },
    { activityId: "impact_log", totalFrequency: 4 },
    { activityId: "lift_module", totalFrequency: 3 },
    { activityId: "linkedin", totalFrequency: 3 },
    { activityId: "book_club", totalFrequency: 1 },
    { activityId: "peer_matching", totalFrequency: 6 },
    { activityId: "challenger", totalFrequency: 3 },
  ],
  "3M": [
    { activityId: "podcast_workbook", totalFrequency: 9 },
    { activityId: "weekly_session", totalFrequency: 12 },
    { activityId: "webinar_workbook", totalFrequency: 3 },
    { activityId: "peer_to_peer", totalFrequency: 9 },
    { activityId: "impact_log", totalFrequency: 6 },
    { activityId: "lift_module", totalFrequency: 3 },
    { activityId: "linkedin", totalFrequency: 7 },
    { activityId: "book_club", totalFrequency: 3 },
    { activityId: "peer_matching", totalFrequency: 12 },
    { activityId: "challenger", totalFrequency: 6 },
    { activityId: "mentor_meetup", totalFrequency: 3 },
    { activityId: "ambassador_session", totalFrequency: 3 },
  ],
  "6M": [
    { activityId: "podcast_workbook", totalFrequency: 18 },
    { activityId: "weekly_session", totalFrequency: 24 },
    { activityId: "webinar_workbook", totalFrequency: 6 },
    { activityId: "peer_to_peer", totalFrequency: 18 },
    { activityId: "impact_log", totalFrequency: 12 },
    { activityId: "lift_module", totalFrequency: 6 },
    { activityId: "linkedin", totalFrequency: 14 },
    { activityId: "book_club", totalFrequency: 6 },
    { activityId: "peer_matching", totalFrequency: 24 },
    { activityId: "challenger", totalFrequency: 12 },
    { activityId: "mentor_meetup", totalFrequency: 6 },
    { activityId: "ambassador_session", totalFrequency: 6 },
  ],
  "9M": [
    { activityId: "podcast_workbook", totalFrequency: 27 },
    { activityId: "weekly_session", totalFrequency: 36 },
    { activityId: "webinar_workbook", totalFrequency: 9 },
    { activityId: "peer_to_peer", totalFrequency: 27 },
    { activityId: "impact_log", totalFrequency: 18 },
    { activityId: "lift_module", totalFrequency: 9 },
    { activityId: "linkedin", totalFrequency: 21 },
    { activityId: "book_club", totalFrequency: 9 },
    { activityId: "peer_matching", totalFrequency: 36 },
    { activityId: "challenger", totalFrequency: 18 },
    { activityId: "mentor_meetup", totalFrequency: 9 },
    { activityId: "ambassador_session", totalFrequency: 9 },
  ],
  "12M": [
    { activityId: "podcast_workbook", totalFrequency: 36 },
    { activityId: "weekly_session", totalFrequency: 48 },
    { activityId: "webinar_workbook", totalFrequency: 12 },
    { activityId: "peer_to_peer", totalFrequency: 36 },
    { activityId: "impact_log", totalFrequency: 24 },
    { activityId: "lift_module", totalFrequency: 12 },
    { activityId: "linkedin", totalFrequency: 28 },
    { activityId: "book_club", totalFrequency: 12 },
    { activityId: "peer_matching", totalFrequency: 48 },
    { activityId: "challenger", totalFrequency: 24 },
    { activityId: "mentor_meetup", totalFrequency: 12 },
    { activityId: "ambassador_session", totalFrequency: 12 },
  ],
};

// ─── Journey Metadata ───────────────────────────────────────────────────────

export const JOURNEY_META: Record<
  JourneyType,
  {
    weeks: number;
    weeklyTarget: number;
    windowTarget: number;
    passMarkPoints: number;
    maxPossiblePoints: number;
    mode: "intro" | "full";
    timelineDisplay: JourneyTimelineDisplayMode;
    completionThresholdPct?: number;
  }
> = {
  "4W": {
    weeks: 4,
    weeklyTarget: 3750,
    windowTarget: 7500,
    passMarkPoints: 9000,
    maxPossiblePoints: 15000,
    mode: "intro",
    timelineDisplay: "duration",
    completionThresholdPct: 60,
  },
  "6W": {
    weeks: 6,
    weeklyTarget: 6750,
    windowTarget: 13500,
    passMarkPoints: 40000,
    maxPossiblePoints: 60000,
    mode: "full",
    timelineDisplay: "course-count",
    completionThresholdPct: 67,
  },
  "3M": {
    weeks: 12,
    weeklyTarget: 6250,
    windowTarget: 12500,
    passMarkPoints: 75000,
    maxPossiblePoints: 113000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 66,
  },
  "6M": {
    weeks: 24,
    weeklyTarget: 6250,
    windowTarget: 12500,
    passMarkPoints: 150000,
    maxPossiblePoints: 226000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 66,
  },
  "9M": {
    weeks: 36,
    weeklyTarget: 6300,
    windowTarget: 12600,
    passMarkPoints: 227000,
    maxPossiblePoints: 339000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 67,
  },
  "12M": {
    weeks: 48,
    weeklyTarget: 6300,
    windowTarget: 12600,
    passMarkPoints: 302000,
    maxPossiblePoints: 452000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 67,
  },
};

// ─── Activity Assembly ──────────────────────────────────────────────────────

function buildActivityDef(
  base: BaseActivityEntry,
  entry: JourneyActivityEntry,
  numWindows: number,
  journeyDurationWeeks: number
): ActivityDef {
  const totalFreq = entry.totalFrequency;
  const points = entry.pointsOverride ?? base.points;
  const durationInMonths = Math.max(1, journeyDurationWeeks / 4);
  // Approximation for legacy consumers that still read maxPerMonth.
  const maxPerMonthApprox = Math.max(1, Math.round(totalFreq / durationInMonths));

  let policyType = base.behaviorType;
  let maxPerWindow: number | undefined;

  if (totalFreq === 1 && policyType !== "ongoing") {
    policyType = "one_time";
    maxPerWindow = 1;
  } else if (policyType === "window_limited") {
    maxPerWindow = Math.max(1, Math.ceil(totalFreq / numWindows));
  } else if (policyType === "ongoing") {
    maxPerWindow = base.defaultMaxPerWindow;
  }

  return {
    id: base.id,
    baseId: base.baseId,
    title: base.title,
    description: base.description,
    points,
    maxPerMonth: maxPerMonthApprox,
    activityPolicy: {
      type: policyType,
      maxTotal: totalFreq,
      maxPerWindow,
    },
    approvalType: base.approvalType,
    requiresApproval: base.requiresApproval,
    isFreeTier: base.isFreeTier,
    week: base.week,
    category: base.category,
    tags: base.tags,
    verification: base.verification,
    flexibleWeeks: base.flexibleWeeks,
    frequencyNote: base.frequencyNote,
    visibility: base.visibility,
  };
}

function buildJourneyActivities(journeyType: JourneyType): ActivityDef[] {
  const config = JOURNEY_ACTIVITY_CONFIG[journeyType];
  if (!config) return [];

  const meta = JOURNEY_META[journeyType];
  const journeyDurationWeeks = meta.weeks;
  const numWindows = Math.ceil(meta.weeks / PARALLEL_WINDOW_SIZE_WEEKS);

  return config
    .map((entry) => {
      const base = BASE_ACTIVITY_MAP.get(entry.activityId);
      if (!base) return null;
      return buildActivityDef(base, entry, numWindows, journeyDurationWeeks);
    })
    .filter((a): a is ActivityDef => a !== null);
}

// Static arrays for backward compat
export const INTRO_ACTIVITIES: ActivityDef[] = buildJourneyActivities("4W");
export const FULL_ACTIVITIES: ActivityDef[] = buildJourneyActivities("3M");

// ─── Public API ─────────────────────────────────────────────────────────────

export function getActivitiesForJourney(journeyType?: JourneyType | null): ActivityDef[] {
  if (!journeyType) return FULL_ACTIVITIES;

  const config = JOURNEY_ACTIVITY_CONFIG[journeyType];
  if (!config) return FULL_ACTIVITIES;

  return buildJourneyActivities(journeyType);
}

// ─── Activity Resolution ────────────────────────────────────────────────────

const ACTIVITY_ID_ALIASES: Record<string, ActivityId> = {
  podcast: "watch_podcast",
  webinar: "webinar_workbook",
  recognition_over_recall: "lift_module",
  von_restorff_effect: "lift_module",
  partner_spotlight: "lift_module",
};

const SPECIAL_ACTIVITIES: ActivityDef[] = [
  REFERRAL_ACTIVITY,
  PEER_SESSION_CONFIRMATION_ACTIVITY,
  PEER_SESSION_NO_SHOW_ACTIVITY,
];

// Build ALL_ACTIVITIES from all journey types (deduplicated) + special activities
const allActivitiesMap = new Map<string, ActivityDef>();
(["4W", "6W", "3M", "6M", "9M", "12M"] as JourneyType[]).forEach((jt) => {
  buildJourneyActivities(jt).forEach((a) => {
    if (!allActivitiesMap.has(a.id)) allActivitiesMap.set(a.id, a);
  });
});
SPECIAL_ACTIVITIES.forEach((a) => {
  if (!allActivitiesMap.has(a.id)) allActivitiesMap.set(a.id, a);
});

const ALL_ACTIVITIES: ActivityDef[] = Array.from(allActivitiesMap.values());
const ALL_ACTIVITY_IDS = new Set<ActivityId>(ALL_ACTIVITIES.map((a) => a.id));

// Also add aliased IDs so they resolve
Object.keys(ACTIVITY_ID_ALIASES).forEach((id) => ALL_ACTIVITY_IDS.add(id as ActivityId));

export function resolveCanonicalActivityId(activityId?: string | null): ActivityId | null {
  if (!activityId) return null;
  const resolved = ACTIVITY_ID_ALIASES[activityId] ?? activityId;
  return ALL_ACTIVITY_IDS.has(resolved as ActivityId) ? (resolved as ActivityId) : null;
}

export function getActivityDefinitionById(params: {
  activityId?: string | null;
  journeyType?: JourneyType | null;
}): ActivityDef | null {
  const canonicalId = resolveCanonicalActivityId(params.activityId);
  if (!canonicalId) return null;

  const visible = getActivitiesForJourney(params.journeyType);
  return (
    visible.find((activity) => activity.id === canonicalId) ??
    ALL_ACTIVITIES.find((activity) => activity.id === canonicalId) ??
    null
  );
}

// For 3M+ show month indicator: Month = ceil(week/4)
export function getMonthNumber(weekNumber: number): number {
  return getWindowNumber(weekNumber, PARALLEL_WINDOW_SIZE_WEEKS);
}

// ─── Default Export ─────────────────────────────────────────────────────────

const pointsConfig = {
  FULL_ACTIVITIES,
  INTRO_ACTIVITIES,
  JOURNEY_META,
  getActivitiesForJourney,
  getMonthNumber,
  REFERRAL_POINTS,
  REFERRAL_MAX_PER_USER,
  REFERRAL_ACTIVITY,
  PEER_SESSION_CONFIRMATION_ACTIVITY,
  PEER_SESSION_NO_SHOW_ACTIVITY,
};

export default pointsConfig;
