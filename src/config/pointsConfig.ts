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
  label: string;
  pointsEach: number;
  maxPerMonth: number; // from spec
  // if you want: description, CTA routes, etc.
};

export const FULL_ACTIVITIES: ActivityDef[] = [
  { id: "podcast", label: "Watch/listen to podcast", pointsEach: 1000, maxPerMonth: 3 },
  { id: "podcast_workbook", label: "Complete podcast workbook", pointsEach: 1000, maxPerMonth: 3 },
  { id: "webinar", label: "Attend webinar", pointsEach: 2000, maxPerMonth: 1 },
  { id: "webinar_workbook", label: "Complete webinar workbook", pointsEach: 2000, maxPerMonth: 1 },
  { id: "peer_matching", label: "Peer Matching", pointsEach: 1000, maxPerMonth: 4 },
  { id: "impact_log", label: "Impact Log Entry", pointsEach: 1000, maxPerMonth: 2 },
  { id: "book_club", label: "Book Club Participation", pointsEach: 1500, maxPerMonth: 1 },
  { id: "peer_to_peer", label: "Monthly Peer to Peer", pointsEach: 2500, maxPerMonth: 1 },
  { id: "linkedin", label: "LinkedIn engagement (post/comment)", pointsEach: 500, maxPerMonth: 2 },
  { id: "lift_module", label: "LIFT Course Module Completed", pointsEach: 3000, maxPerMonth: 1 },
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
