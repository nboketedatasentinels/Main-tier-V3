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
  | "impact_log";

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
  { weeks: number; weeklyTarget: number; mode: "intro" | "full"; timelineDisplay: JourneyTimelineDisplayMode }
> = {
  "4W":  { weeks: 4,  weeklyTarget: 2500, mode: "intro", timelineDisplay: "duration" },
  "6W":  { weeks: 6,  weeklyTarget: 4000, mode: "full",  timelineDisplay: "course-count" },
  "3M":  { weeks: 12, weeklyTarget: 4000, mode: "full",  timelineDisplay: "duration" },
  "6M":  { weeks: 24, weeklyTarget: 4000, mode: "full",  timelineDisplay: "duration" },
  "9M":  { weeks: 36, weeklyTarget: 4000, mode: "full",  timelineDisplay: "duration" },
  "12M": { weeks: 48, weeklyTarget: 4000, mode: "full",  timelineDisplay: "duration" },
};

export function getActivitiesForJourney(journeyType: JourneyType): ActivityDef[] {
  return JOURNEY_META[journeyType].mode === "intro" ? INTRO_ACTIVITIES : FULL_ACTIVITIES;
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
};

export default pointsConfig;
