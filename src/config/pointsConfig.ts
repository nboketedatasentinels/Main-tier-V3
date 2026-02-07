import { getWindowNumber } from "@/utils/windowCalculations";

export type JourneyType = "4W" | "6W" | "3M" | "6M" | "9M" | "12M";
export type JourneyTimelineDisplayMode = "duration" | "course-count";

export type ActivityId =
  | "podcast"
  | "podcast_workbook"
  | "webinar"
  | "webinar_workbook"
  | "peer_matching"
  | "book_club"
  | "peer_to_peer"
  | "linkedin"
  | "lift_module"
  | "impact_log"
  | "referral_bonus"
  | "peer_session_confirmation"
  | "peer_session_no_show_report";

export type ActivityPolicyType = "one_time" | "window_limited" | "ongoing";

export type ApprovalType = "auto" | "self" | "partner_approved" | "partner_issued";

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

export const REFERRAL_POINTS = 100;
export const REFERRAL_MAX_PER_USER = 100;

/**
 * Referral bonus activity definition for proper ledger integration.
 * Used when awarding points for successful referrals.
 * This activity is partner_issued (awarded by system/Cloud Function).
 */
export const REFERRAL_ACTIVITY: ActivityDef = {
  id: "referral_bonus",
  baseId: "referral_bonus",
  title: "Referral Bonus",
  description: "Points awarded for successfully referring a new user who completes their first activity.",
  points: REFERRAL_POINTS,
  maxPerMonth: REFERRAL_MAX_PER_USER, // Effectively unlimited per month, capped by total
  activityPolicy: {
    type: "ongoing",
    maxTotal: REFERRAL_MAX_PER_USER,
  },
  week: 1, // Can be awarded in any week
  category: "Referral",
  approvalType: "partner_issued", // Awarded by system/Cloud Function
  isFreeTier: true,
  flexibleWeeks: true,
  frequencyNote: "Awarded when a referred user completes their first platform activity.",
};

/**
 * Peer session confirmation activity - awarded when both participants confirm a scheduled session.
 * Points are awarded to BOTH participants when mutual confirmation occurs.
 */
export const PEER_SESSION_CONFIRMATION_ACTIVITY: ActivityDef = {
  id: "peer_session_confirmation",
  baseId: "peer_session_confirmation",
  title: "Peer Session Confirmed",
  description: "Both participants confirmed the scheduled peer session before the deadline.",
  points: 50,
  maxPerMonth: 20, // Allow multiple sessions per month
  activityPolicy: {
    type: "ongoing",
    maxPerWindow: 10,
  },
  week: 1, // Can be awarded in any week
  category: "Networking",
  approvalType: "auto", // Automatically awarded by system
  isFreeTier: true,
  flexibleWeeks: true,
  frequencyNote: "Awarded when both peers confirm a session before the confirmation deadline.",
};

/**
 * Peer session no-show report activity - awarded for accountability when reporting a no-show.
 * Encourages users to report when their peer doesn't show up.
 */
export const PEER_SESSION_NO_SHOW_ACTIVITY: ActivityDef = {
  id: "peer_session_no_show_report",
  baseId: "peer_session_no_show_report",
  title: "No-Show Accountability",
  description: "Reported peer no-show for accountability tracking after the session time.",
  points: 25,
  maxPerMonth: 10, // Reasonable cap on no-show reports
  activityPolicy: {
    type: "ongoing",
    maxPerWindow: 5,
  },
  week: 1, // Can be awarded in any week
  category: "Networking",
  approvalType: "auto", // Automatically awarded by system
  isFreeTier: true,
  flexibleWeeks: true,
  frequencyNote: "Awarded when you report that your peer did not attend the scheduled session.",
};

export const FULL_ACTIVITIES: ActivityDef[] = [
  {
    id: "podcast",
    baseId: "podcast",
    title: "Watch/listen to podcast",
    description: "Engage with weekly podcast content.",
    points: 1000,
    maxPerMonth: 3,
    activityPolicy: {
      type: "ongoing",
      maxPerWindow: 3,
    },
    week: 1,
    category: "Learning",
    approvalType: "self",
    isFreeTier: true,
    verification: "honor",
    flexibleWeeks: true,
    frequencyNote: "Honor-based; complete in any week.",
  },
  {
    id: "podcast_workbook",
    baseId: "podcast_workbook",
    title: "Complete podcast workbook",
    description: "Apply learnings from the podcast.",
    points: 1000,
    maxPerMonth: 3,
    activityPolicy: {
      type: "ongoing",
      maxPerWindow: 3,
    },
    week: 1,
    category: "Application",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    flexibleWeeks: true,
  },
  {
    id: "webinar",
    baseId: "webinar",
    title: "Attend webinar",
    description: "Participate in a live webinar session and submit attendance for partner approval.",
    points: 2000,
    maxPerMonth: 1,
    activityPolicy: {
      type: "one_time",
      maxTotal: 1,
    },
    week: 2,
    category: "Community",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    flexibleWeeks: true,
    frequencyNote: "Once per month; may be completed in any week.",
  },
  {
    id: "webinar_workbook",
    baseId: "webinar_workbook",
    title: "Complete webinar workbook",
    description: "Complete exercises from the webinar.",
    points: 2000,
    maxPerMonth: 1,
    activityPolicy: {
      type: "one_time",
      maxTotal: 1,
    },
    week: 2,
    category: "Application",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    flexibleWeeks: true,
  },
  {
    id: "peer_matching",
    baseId: "peer_matching",
    title: "Peer Matching",
    description: "System-automated, one-on-one matching so you can directly engage with a paired peer.",
    points: 1000,
    maxPerMonth: 4,
    maxPerWeek: 1,
    activityPolicy: {
      type: "ongoing",
      maxPerWindow: 4,
      maxPerWeek: 1,
    },
    week: 3,
    category: "Networking",
    approvalType: "auto",
    flexibleWeeks: true,
    frequencyNote: "Earn up to 1,000 points per week; complete in any week.",
  },
  {
    id: "book_club",
    baseId: "book_club",
    title: "Book Club Participation",
    description: "Engage in book club discussions and share proof for partner approval (1,500 points once per month).",
    points: 1500,
    maxPerMonth: 1,
    activityPolicy: {
      type: "one_time",
      maxTotal: 1,
    },
    week: 4,
    category: "Community",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    flexibleWeeks: true,
    frequencyNote: "Once per month; schedule in any week.",
  },
  {
    id: "peer_to_peer",
    baseId: "peer_to_peer",
    title: "Monthly Peer to Peer",
    description: "Group-oriented peer-to-peer activity with partner oversight to guide structure and outcomes.",
    points: 2500,
    maxPerMonth: 1,
    activityPolicy: {
      type: "window_limited",
      maxPerWindow: 1,
    },
    week: 4,
    category: "Networking",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    flexibleWeeks: true,
  },
  {
    id: "linkedin",
    baseId: "linkedin",
    title: "LinkedIn engagement (post/comment)",
    description: "Share insights on LinkedIn and route the post for partner approval (twice per month).",
    points: 500,
    maxPerMonth: 2,
    activityPolicy: {
      type: "window_limited",
      maxPerWindow: 2,
    },
    week: 3,
    category: "Brand",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    flexibleWeeks: true,
    frequencyNote: "Up to twice per month; complete in any week.",
  },
  {
    id: "lift_module",
    baseId: "lift_module",
    title: "LIFT Course Module Completed",
    description: "Complete a LIFT course module and submit proof. Points awarded after partner approval.",
    points: 3000,
    maxPerMonth: 1,
    activityPolicy: {
      type: "window_limited",
      maxPerWindow: 1,
    },
    week: 2,
    category: "Learning",
    approvalType: "partner_approved",
    requiresApproval: true,
    verification: "partner_approval",
    flexibleWeeks: true,
  },
  {
    id: "impact_log",
    baseId: "impact_log",
    title: "Impact Log entry",
    description: "Log an impact story to capture outcomes and progress.",
    points: 500,
    maxPerMonth: 4,
    maxPerWeek: 1,
    activityPolicy: {
      type: "window_limited",
      maxPerWindow: 4,
      maxPerWeek: 1,
    },
    week: 4,
    category: "Impact",
    approvalType: "self",
    isFreeTier: true,
    verification: "honor",
    flexibleWeeks: true,
    frequencyNote: "Once per week; cap of four per month.",
  },
];

// 4-week intro = limited set (no peer matching, book club, peer-to-peer, linkedin)
export const INTRO_ACTIVITIES: ActivityDef[] = FULL_ACTIVITIES.filter(
  a => !["peer_matching", "book_club", "peer_to_peer", "linkedin"].includes(a.id)
);

export const JOURNEY_META: Record<
  JourneyType,
  {
    weeks: number;
    weeklyTarget: number;
    mode: "intro" | "full";
    timelineDisplay: JourneyTimelineDisplayMode;
    completionThresholdPct?: number;
  }
> = {
  "4W": {
    weeks: 4,
    weeklyTarget: 2500,
    mode: "intro",
    timelineDisplay: "duration",
    completionThresholdPct: 67,
  },
  "6W": {
    weeks: 6,
    weeklyTarget: 4000,
    mode: "full",
    timelineDisplay: "course-count",
    completionThresholdPct: 67,
  },
  "3M": {
    weeks: 12,
    weeklyTarget: 4000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 67,
  },
  "6M": {
    weeks: 24,
    weeklyTarget: 4000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 67,
  },
  "9M": {
    weeks: 36,
    weeklyTarget: 4000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 67,
  },
  "12M": {
    weeks: 48,
    weeklyTarget: 4000,
    mode: "full",
    timelineDisplay: "duration",
    completionThresholdPct: 67,
  },
};

export function getActivitiesForJourney(journeyType?: JourneyType | null): ActivityDef[] {
  const meta = journeyType ? JOURNEY_META[journeyType] : undefined;
  if (!meta) return FULL_ACTIVITIES;
  return meta.mode === "intro" ? INTRO_ACTIVITIES : FULL_ACTIVITIES;
}

// For 3M+ show month indicator: Month = ceil(week/4)
export function getMonthNumber(weekNumber: number): number {
  return getWindowNumber(weekNumber);
}

// Default export for consumers that prefer object access
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
