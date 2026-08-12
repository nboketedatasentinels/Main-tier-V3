# Course assessment report math

Prefer **in-app** calculation. If something cannot be proven correct, **flag it for offline** — published numbers must stay right.

## Headline verdict (observers)

- Uses **Manager (`line_manager`) + Partner** (and Mentor/Coach when present).
- **Matched growth** = Post − Pre for raters who submitted **both** time points only.
- **End-state** may include Post-only observers but those do **not** enter matched growth.
- Self ratings are a **self-awareness lens**, never the headline.
- **Partner Pre + Post** are both enabled so matched Manager+Partner growth is computable.

## Integrity rules (in-app)

| Rule | Behavior |
|------|----------|
| Ratings only | 1–10 numeric items; ignore text/choice |
| Like-for-like items | Intersect Pre/Post by question text when catalog texts exist; else min length by index |
| Duplicates | Same rater × course × kind → average item vectors |
| Invalid pattern | Near-uniform floor/ceiling → exclude from matched growth + flag |
| Cronbach's α | Computed on observer Post item matrix when n ≥ 3; else `cronbach_insufficient_n` + `offline: true` |
| Catalog match | Prefer instruments with ~5–15 rating items; mega-forms are penalized |
| Identity | Same normalized display name on multiple profile ids → offline merge flag |

## Engagement (context only)

Pulled from `points_ledger` claims (not part of rating formula):

- Live sessions (`weekly_session*`)
- Modules (`lift_module*`)
- Impact logs / peer / capstone / webinar

Pass mark comes from `JOURNEY_META` for the learner's journey type.

## Score bands

| Band | Range |
|------|-------|
| Emerging | 1–3 |
| Developing | 4–6 |
| Proficient | 7–8 |
| Strong | 9–10 |

## Documents

- **Partner report** — full HTML (exec summary + chart, every learner page with Strengths/Gaps/Next steps + engagement, cohort patterns & recommendations, methodology & limitations).
- **Learner report** — same math, **own page only** (+ short how-to-read; full methodology stays with partner).
- Narratives are **template text from numbers**, not hand-written case notes.

## Tests

`src/services/courseAssessmentReportMath.test.ts` — matched growth, post-only exclusion, invalid patterns, duplicate averaging, Cronbach gate, identity flags.

Implementation: `courseAssessmentReportMath.ts`, `courseAssessmentReportNarratives.ts`, `courseAssessmentHtmlReport.ts`, `courseAssessmentReportService.ts`.
