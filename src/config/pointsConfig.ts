export type JourneyType = "4W" | "6W" | "3M" | "6M" | "9M" | "12M";

export type ActivityId =
  | "podcast"
  | "podcast_workbook"
  | "webinar"
  | "webinar_workbook"
  | "peer_matching"
  | "impact_log"
  | "book_club"
  | "peer_to_peer"
  | "linkedin"
  | "lift_module";

export type ActivityDef = {
  id: ActivityId;
  baseId: string;
  title: string;
  description: string;
  points: number;
  maxPerMonth: number;
  requiresApproval?: boolean;
  isFreeTier?: boolean;
  week: number;
  category: string;
  tags?: string[];
};

export const FULL_ACTIVITIES: ActivityDef[] = [
  {
    id: "podcast",
    baseId: "podcast",
    title: "Watch/listen to podcast",
    description: "Engage with weekly podcast content.",
    points: 1000,
    maxPerMonth: 3,
    week: 1,
    category: "Learning",
    isFreeTier: true,
  },
  {
    id: "podcast_workbook",
    baseId: "podcast_workbook",
    title: "Complete podcast workbook",
    description: "Apply learnings from the podcast.",
    points: 1000,
    maxPerMonth: 3,
    week: 1,
    category: "Application",
    requiresApproval: true,
  },
  {
    id: "webinar",
    baseId: "webinar",
    title: "Attend webinar",
    description: "Participate in a live webinar session (monthly, high-value points).",
    points: 2000,
    maxPerMonth: 1,
    week: 2,
    category: "Community",
  },
  {
    id: "webinar_workbook",
    baseId: "webinar_workbook",
    title: "Complete webinar workbook",
    description: "Complete exercises from the webinar.",
    points: 2000,
    maxPerMonth: 1,
    week: 2,
    category: "Application",
    requiresApproval: true,
  },
  {
    id: "peer_matching",
    baseId: "peer_matching",
    title: "Peer Matching",
    description: "Connect with a peer for mutual growth (weekly cadence).",
    points: 1000,
    maxPerMonth: 4,
    week: 3,
    category: "Networking",
  },
  {
    id: "impact_log",
    baseId: "impact_log",
    title: "Impact Log Entry",
    description: "Document your professional impact.",
    points: 1000,
    maxPerMonth: 2,
    week: 1,
    category: "Reflection",
    requiresApproval: true,
  },
  {
    id: "book_club",
    baseId: "book_club",
    title: "Book Club Participation",
    description: "Engage in book club discussions.",
    points: 1500,
    maxPerMonth: 1,
    week: 4,
    category: "Community",
  },
  {
    id: "peer_to_peer",
    baseId: "peer_to_peer",
    title: "Monthly Peer to Peer",
    description: "Hold a peer-to-peer accountability session.",
    points: 2500,
    maxPerMonth: 1,
    week: 4,
    category: "Networking",
    requiresApproval: true,
  },
  {
    id: "linkedin",
    baseId: "linkedin",
    title: "LinkedIn engagement (post/comment)",
    description: "Share insights on LinkedIn (up to two posts per month).",
    points: 500,
    maxPerMonth: 2,
    week: 3,
    category: "Brand",
  },
  {
    id: "lift_module",
    baseId: "lift_module",
    title: "LIFT Course Module Completed",
    description: "Finish a module in the LIFT course.",
    points: 3000,
    maxPerMonth: 1,
    week: 2,
    category: "Learning",
    requiresApproval: true,
  },
];

// 4-week intro = limited set (no peer matching, book club, peer-to-peer, linkedin)
export const INTRO_ACTIVITIES: ActivityDef[] = FULL_ACTIVITIES.filter(
  a => !["peer_matching", "book_club", "peer_to_peer", "linkedin"].includes(a.id)
);

export const JOURNEY_META: Record<JourneyType, { weeks: number; weeklyTarget: number; mode: "intro" | "full" }> = {
  "4W":  { weeks: 4,  weeklyTarget: 2500, mode: "intro" },
  "6W":  { weeks: 6,  weeklyTarget: 4000, mode: "full"  },
  "3M":  { weeks: 12, weeklyTarget: 4000, mode: "full"  },
  "6M":  { weeks: 24, weeklyTarget: 4000, mode: "full"  },
  "9M":  { weeks: 36, weeklyTarget: 4000, mode: "full"  },
  "12M": { weeks: 48, weeklyTarget: 4000, mode: "full"  },
};

export function getActivitiesForJourney(journeyType: JourneyType): ActivityDef[] {
  return JOURNEY_META[journeyType].mode === "intro" ? INTRO_ACTIVITIES : FULL_ACTIVITIES;
}

// For 3M+ show month indicator: Month = ceil(week/4)
export function getMonthNumber(weekNumber: number): number {
  return Math.ceil(weekNumber / 4);
}
