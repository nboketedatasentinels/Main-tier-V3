# T4L Points System Reference

> **Core Principle**: Learners are guided by minimum POINTS per 2-week window, not activities. Points are the only thing that determines progress and passing.

---

## System Overview

The T4L platform uses a **window-based points system** where:

- All journeys are divided into **2-week windows**
- Learners think in "this fortnight" - never months
- Activities unlock, lock, rotate, and disappear temporarily
- Points alone determine progress and passing

This creates one mental model across the entire ecosystem.

---

## Journey Structures

### 6-Week Journey

| Metric | Value |
|--------|-------|
| Duration | 6 weeks |
| Windows | 3 (each = 2 weeks) |
| Pass Mark | 40,000 points |
| Max Possible | 60,000 points |
| Target per Window | ~14,000 points |

**Window Breakdown:**
- Window 1: Weeks 1–2
- Window 2: Weeks 3–4
- Window 3: Weeks 5–6

**Learner Guidance:**
> "To stay on track, aim for at least 14,000 points every two weeks."

---

### 3-Month Journey

| Metric | Value |
|--------|-------|
| Duration | 12 weeks |
| Windows | 6 (each = 2 weeks) |
| Pass Mark | 75,000 points |
| Max Possible | 113,000 points |
| Target per Window | 12,000–13,000 points |

**Why this pacing works:**
- 6 windows × 12,500 ≈ 75,000 (pass mark)
- Learners can underperform in one window and recover later
- High performers still feel rewarded

---

### 6-Month Journey

| Metric | Value |
|--------|-------|
| Duration | 24 weeks |
| Windows | 12 (each = 2 weeks) |
| Pass Mark | 150,000 points |
| Max Possible | 226,000 points |
| Target per Window | 12,000–13,500 points |

**Why this pacing works:**
- 12 windows × 12,500 ≈ 150,000 (pass mark)
- Same rhythm as shorter journeys
- Learners build muscle memory: "Every two weeks, I show up and earn points"

---

### 9-Month Journey

| Metric | Value |
|--------|-------|
| Duration | 36 weeks |
| Windows | 18 (each = 2 weeks) |
| Pass Mark | 227,000 points |
| Max Possible | 339,000 points |
| Target per Window | 12,500–13,000 points |

**Why this pacing works:**
- 18 × 12,600 ≈ 226,800 → right on pass mark
- Allows 1–2 "low energy" windows
- Accommodates travel/work crunches
- Recovery possible without panic

---

## Activity Types

### 1. One-Time Activities (Global Cap)

**Rule:** Claim once → permanently disabled (never returns)

| Activity | 6-Week | 3-Month | 6-Month | 9-Month |
|----------|--------|---------|---------|---------|
| Webinar + Workbook | 1 | 3 | - | 9 |
| Book Club | 1 | 3 | - | 9 |

**Behavior:**
- Once claimed, disappears forever
- Cannot be repeated
- Counts toward total journey points

---

### 2. Window-Limited Activities (Rotating)

**Rule:** Max 1 claim per activity per 2-week window. Reappears next window if total frequency not exhausted.

| Activity | 6-Week | 3-Month | 6-Month | 9-Month |
|----------|--------|---------|---------|---------|
| Challenger | 3 | 6 | - | 18 |
| LinkedIn Post | 3 | 7 | - | 21 |
| Peer to Peer | 3 | 9 | - | 27 |
| Impact Log | 4 | 6 | - | 18 |
| LIFT Modules | 3 | 3 | - | 9 |
| Mentor Meet-ups | - | * | - | 9 |
| Ambassador Sessions | - | * | - | 9 |

*If applicable to the learner's program

**Behavior:**
- Available once per window
- Disappears temporarily after claim
- Reappears next window (if frequency remains)
- Permanently disabled when total frequency exhausted

**This ensures:**
- No binge behavior
- No decision fatigue
- Even distribution over journey duration

---

### 3. Ongoing/Rhythm Activities

**Rule:** Always visible, hard-capped by total frequency

| Activity | 6-Week | 3-Month | 6-Month | 9-Month |
|----------|--------|---------|---------|---------|
| Weekly Session | * | * | * | 36 |
| Podcast + Workbook | * | * | * | 27 |
| Peer Matching Session | * | * | * | 36 |

**Behavior:**
- Always visible in activity list
- Can be completed at any pace
- Greyed out once cap is hit
- Hard-stopped when frequency reached

---

## Points Claiming Methods

### 1. Auto Marks
- **Trigger:** Activity completed within the platform
- **Action:** Points awarded automatically
- **User Action:** None required
- **Use Case:** Platform-tracked activities (module completion, session attendance)

### 2. Self-Reporting
- **Trigger:** User marks activity as complete
- **Action:** Points awarded on submission
- **User Action:** Click "Mark Complete" or similar
- **Use Case:** External activities (LinkedIn posts, peer conversations)

### 3. Partner Approved
- **Trigger:** User submits evidence/request
- **Action:** Partner reviews and approves in Admin portal
- **User Action:** Submit completion request with evidence
- **Use Case:** Quality-gated activities (impact logs, challenges)

### 4. Partner-Issued
- **Trigger:** Partner awards points directly from Admin portal
- **Action:** Points appear in learner's account
- **User Action:** None (passive recipient)
- **Use Case:** Bonus points, recognition awards, special achievements

---

## Learner Dashboard View

In any given 2-week window, learners see:

### Activity States

| Icon | State | Description |
|------|-------|-------------|
| ✅ | Available | Can be claimed this window |
| ⏳ | Next Window | Cooldown - available next window |
| ✔️ | Completed | Already claimed (one-time) or maxed |
| 🔒 | Locked | Not yet available or prerequisites not met |
| ⚫ | Exhausted | Total frequency reached |

### Progress Tracker

```
┌─────────────────────────────────────────┐
│  Points This Window: 8,500 / 14,000     │
│  ████████████░░░░░░░░  61%              │
│                                         │
│  Total Points: 32,500 / 40,000          │
│  ████████████████░░░░  81%              │
│                                         │
│  Status: ✅ On Track                    │
└─────────────────────────────────────────┘
```

### Status Indicators

| Status | Condition | Color |
|--------|-----------|-------|
| Ahead | > 110% of expected pace | Green |
| On Track | 90-110% of expected pace | Green |
| Catching Up | 70-90% of expected pace | Amber |
| Behind | < 70% of expected pace | Red |

---

## Anti-Overwhelm Design

**Key UX Principle:** Learners never see the full points universe at once.

### What Learners DON'T See:
- ❌ All 339,000 possible points (9-month)
- ❌ Complete activity list for entire journey
- ❌ Pressure to complete everything

### What Learners DO See:
- ✅ Short, manageable list of available activities
- ✅ Clear "this window" focus
- ✅ Simple progress indicators
- ✅ Encouraging status messages

---

## Implementation Notes

### Window Calculation

```typescript
// Calculate current window (0-indexed)
const getCurrentWindow = (startDate: Date, now: Date = new Date()): number => {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksSinceStart = Math.floor((now.getTime() - startDate.getTime()) / msPerWeek)
  return Math.floor(weeksSinceStart / 2) // 2-week windows
}

// Check if activity is available this window
const isActivityAvailable = (
  activity: Activity,
  currentWindow: number,
  claimsThisWindow: number,
  totalClaims: number
): boolean => {
  if (activity.type === 'one-time') {
    return totalClaims === 0
  }

  if (activity.type === 'window-limited') {
    return claimsThisWindow === 0 && totalClaims < activity.maxFrequency
  }

  if (activity.type === 'ongoing') {
    return totalClaims < activity.maxFrequency
  }

  return false
}
```

### Progress Status Calculation

```typescript
type ProgressStatus = 'ahead' | 'on-track' | 'catching-up' | 'behind'

const getProgressStatus = (
  currentPoints: number,
  currentWindow: number,
  totalWindows: number,
  passMarkPoints: number
): ProgressStatus => {
  const expectedPointsPerWindow = passMarkPoints / totalWindows
  const expectedPoints = expectedPointsPerWindow * (currentWindow + 1)
  const percentOfExpected = (currentPoints / expectedPoints) * 100

  if (percentOfExpected >= 110) return 'ahead'
  if (percentOfExpected >= 90) return 'on-track'
  if (percentOfExpected >= 70) return 'catching-up'
  return 'behind'
}
```

### Firestore Data Structure

```typescript
interface UserProgress {
  odId: string
  odName: string
  startDate: Timestamp
  journeyType: '6-week' | '3-month' | '6-month' | '9-month'

  // Points
  totalPoints: number
  passMarkPoints: number
  maxPossiblePoints: number

  // Activity tracking
  activities: {
    [activityId: string]: {
      type: 'one-time' | 'window-limited' | 'ongoing'
      maxFrequency: number
      claims: ActivityClaim[]
    }
  }
}

interface ActivityClaim {
  claimedAt: Timestamp
  windowNumber: number
  points: number
  claimMethod: 'auto' | 'self-report' | 'partner-approved' | 'partner-issued'
  approvedBy?: string // Partner UID for approved/issued
  evidence?: string   // URL or description for partner-approved
}
```

---

## Pacing Guidelines by Journey

### Learner Messaging

**6-Week Journey:**
> "To stay on track, aim for at least 14,000 points every two weeks."

**3-Month Journey:**
> "To stay on track, aim for around 12,500 points every two weeks. Some weeks you'll do more, some less — that's okay."

**6-Month Journey:**
> "To stay on track, aim for around 12,500 points every two weeks. You have plenty of time to catch up if needed."

**9-Month Journey:**
> "To stay on track, aim for around 13,000 points every two weeks. Some weeks you'll do more, some less — that's okay."

### Tone Guidelines

- ✅ No pressure language
- ✅ Orientation, not obligation
- ✅ Acknowledge flexibility
- ✅ Encourage recovery from slow periods

---

## Summary Table

| Journey | Duration | Windows | Pass Mark | Max Points | Per Window Target |
|---------|----------|---------|-----------|------------|-------------------|
| 6-Week | 6 weeks | 3 | 40,000 | 60,000 | ~14,000 |
| 3-Month | 12 weeks | 6 | 75,000 | 113,000 | 12,000–13,000 |
| 6-Month | 24 weeks | 12 | 150,000 | 226,000 | 12,000–13,500 |
| 9-Month | 36 weeks | 18 | 227,000 | 339,000 | 12,500–13,000 |

---

## Key Takeaways

1. **Window-based thinking** - Everything revolves around 2-week windows
2. **Points are king** - Only points determine progress, not activity count
3. **Anti-overwhelm** - Never show the full universe of activities/points
4. **Consistent rhythm** - Same ~12,500 points/window across all journeys
5. **Recovery-friendly** - Pacing allows for low-energy periods
6. **Four claiming methods** - Auto, self-report, partner-approved, partner-issued
