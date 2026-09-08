# AI impact assessment (T4L programme & podcast grading)

Living note for builders (Nana / Ms. Onda / group session). Product code implements the controls below; this document is the ethics framing.

## Purpose

Gemini grades **advise** partners. Final outcomes for learners must remain human-owned where a partner exists. Where no human reviews (or review is delayed), the AI must **explain itself** so a learner can disagree and request a human.

## Who is impacted

| Who | How |
|-----|-----|
| Learners | Advisory scores, pass/fail framing, points still partner- or checklist-gated |
| Partners | Workload to accept / edit / reject; bias toward accepting machine scores |
| Mentors / coaches | See LIFT + personality; not primary graders of artefacts |
| Organisation | Quality of programme evidence; fairness across cohorts |

## Risks & mitigations (shipped)

| Risk | Mitigation in product |
|------|------------------------|
| AI treated as final score | Accept / edit / reject required; AI never awards programme points alone |
| Rubber-stamping (automation bias) | Criteria shown first; AI score hidden until ack; Accept delayed 25s; dwell + decision persisted |
| No proof of human review | HITL panel + CSV: decision, dwell ms, criteria ack, score delta |
| Model drift invisible | Export AI vs human CSV for data scientists |
| No human on podcast / delayed partner | Learner sees AI feedback (“explain itself”) + can dispute → `needs_revision` |
| Ethics not discussed | This doc + group session with Ms. Onda |

## Open process items

1. Group review of Accept vs Edit vs Reject rates monthly (from HITL export).
2. Decide SLA: if partner does not act in N days, learner dispute is the default human path.
3. Revisit 1-hour personality/values unlock vs fairness for mentee visibility.

## Related code

- Partner review: `ProgrammeSubmissionsPage.tsx`
- HITL export: `programmeAiHitl.ts`
- Podcast upsert: `upsertCoursePodcastSubmission`
- Learner explain/dispute: `LearnerAiExplainPanel.tsx`
- Migrations: `0096`, `0097`, `0098`
