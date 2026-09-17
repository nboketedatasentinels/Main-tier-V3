# Section 3 Gate / HITL Control Record

Document status: DRAFT (procedure + control definition  -  screenshots / UI packs to be attached later)  
Document ID: GATE-T4L-001 (working draft  -  align with AIMS register when assigned)  
Drive folder: 04 Gate Records  
System name: T4L Programme & Podcast Advisory Grading Model  
Short name: T4L grading  
Organisation: Data Sentinels / Transformation Leader (T4L)  
System owner: Syntiche Musawu  
Version: 0.1 Draft  
Date created: 17 September 2026  
Last updated: 17 September 2026  

Linked documents:
- Impact Assessment: docs/aims/FRM001-AI-System-Impact-Assessment-T4L-Grading-DRAFT.md
- Risk Assessment: docs/aims/PR003-AI-Risk-Assessment-Worksheet-T4L-Grading-DRAFT.md
- Test scripts (how to prove the gate): docs/aims/HITL-S3-Gate-Testing-Scripts-T4L-Grading-DRAFT.md
- Auto evidence pack (baseline): docs/aims/evidence/hitl/20260917-065134/
- Runnable checker: scripts/aims/hitl_gate_test.py
- Monitoring plan: docs/aims/MON-T4L-001-Monitoring-Plan-DRAFT.md

Filing: copy into the official AIMS gate / HITL template if provided; label DRAFT; store under Drive 04 Gate Records  to  T4L-grading/. Do not backdate. Attach screenshots in a later evidence annex when UI runs are complete.

---

## 0. Document control

| Field | Value |
|-------|--------|
| Document type | AI human-in-the-loop (HITL) gate control record |
| Purpose | Define the gate, who operates it, what must be recorded, and how we prove it for AIMS |
| Scope | T4L advisory grading only |
| Out of scope | Oil Lab, anomaly detection, Celo, AI governance agent, LIFT scoring engine |
| Standard intent | Plan-Do-Check-Improve: this document is the Do control for human oversight (with Check via export / monitoring) |
| Honesty rule | Real dates only. Gaps listed. No invented history of mature HITL operation before August/September 2026 baseline |
| Screenshot status | Not required for this draft. Evidence annex reserved for later UI / CSV screenshots |

---

## 1. Why this gate exists

AIMS expects human oversight to be real, not a 0.2-second click. For T4L grading, the main failure mode is automation bias: partners treating Gemini's advisory score as final without review (see awareness briefing example of ungoverned classroom AI grading).

This gate exists to ensure:

1. AI output is advisory only  
2. A named human makes an accept / edit / reject decision  
3. The decision is dated and attributable  
4. Anti-rubber-stamp controls (criteria acknowledgement + minimum dwell) leave an audit trail  
5. AI never awards programme points alone

Primary risks controlled (from PR003):

| Risk ID | Title | Gate relevance |
|---------|-------|----------------|
| R-T4L-01 | Rubber-stamping HITL | Criteria + 25s dwell + decision evidence |
| R-T4L-02 | Unfair / biased scores | Edit / reject override path |
| R-T4L-03 | AI treated as final authority | Advisory-only + mandatory decision before human-final outcomes |
| R-T4L-04 | Delayed human review | Learner explain + dispute path |
| R-T4L-06 | Model / rubric drift | HITL CSV feeds monitoring |
| R-T4L-07 | Supplier outage | Manual human scoring still allowed |

---

## 2. Gate definition

### 2.1 Gate name
T4L Advisory Grade Human Gate

### 2.2 What must pass through the gate
Any learner programme / podcast submission that receives an AI advisory grade (ai_grade.status = completed) before that estimate is treated as the partner's accepted outcome.

### 2.3 Gate rule (normative)

Where an AI advisory grade exists, the partner must record one of: accept, edit, or reject, after acknowledging review criteria.  
Accept is blocked until the partner has spent at least 25 seconds in the review drawer (anti-rubber-stamp), unless a prior decision already exists.  
The AI grade must not by itself change submission status to a final learner outcome or award programme points.

### 2.4 What the gate is not
- Not optional "nice to have" review when AI has scored  
- Not a rubber-stamp button  
- Not a substitute for organisational accountability  
- Not approval of the Gemini supplier model itself (that sits in REG 009 / supplier controls)

---

## 3. Operating context

| Item | Detail |
|------|--------|
| Application | https://app.t4leader.com |
| Partner surface | Programme submissions (/partner/programme-submissions) |
| Model | Google Gemini (gemini-3-flash-preview) via grade-submission Edge Function |
| Data store | Supabase programme_component_submissions |
| Decision authority | Partner / organisation reviewer (human) |
| System owner | Syntiche Musawu |

---

## 4. Roles and responsibilities

| Role | Responsibility |
|------|----------------|
| Learner | Submits work; may view AI explanation; may dispute / request human review if partner has not decided |
| Partner reviewer | Operates the gate for assigned organisations: criteria, accept / edit / reject, score, save |
| Super-admin / delivery | Configures grading path; monitors HITL; exports AI vs human CSV from Admin - Programme Submissions (/admin/programme-submissions); responds to incidents |
| System owner (Syntiche) | Maintains gate design, evidence fields, test script, and this control record |
| AIMS coordinator | Ensures gate records are filed, dated, and available for Stage 1 readiness |
| Management | Signs acceptability that residual risk is OK with this gate operating as described |

---

## 5. HITL procedure (standard operating steps)

### 5.1 Happy path  -  partner gate

1. Learner submits eligible artefact.  
2. System triggers advisory grading; ai_grade written when complete.  
3. Partner opens Programme submissions.  
4. Partner opens the submission review drawer.  
5. Partner reviews criteria ("what good looks like") and acknowledges them.  
6. Partner reviews learner answers against criteria.  
7. For Accept: wait >= 25 seconds dwell in the drawer, then select Accept.  
8. Or select Edit (enter human score different from AI if overriding) or Reject.  
9. Partner sets status / notes as required and saves.  
10. System persists decision fields (see Section 6).  
11. Only after human save do normal partner / checklist / points rules apply  -  not AI alone.

### 5.2 Fallback  -  AI unavailable or error

1. If ai_grade is missing or error, partner reviews manually.  
2. Partner sets score / status without Accept of an AI estimate.  
3. Record remains a valid human gate action (supports R-T4L-07).

### 5.3 Fallback  -  delayed partner (learner path)

1. Learner may see AI estimate with explanation ("explain itself").  
2. If no partner decision yet, learner may dispute / request human review.  
3. Status moves toward human attention (e.g. needs_revision).  
4. Partner then completes Section 5.1.

### 5.4 Prohibited behaviours

- Accepting AI without reading criteria  
- Accepting within seconds to clear backlog (defeats dwell control)  
- Treating AI score as final without recorded decision  
- Pasting learner submission content into unapproved consumer AI tools (Tier 3 data)  
- Backdating decision timestamps or evidence files  

---

## 6. Evidence the gate must produce (audit fields)

Every gated decision should leave dated records. Minimum fields:

| Evidence field | Meaning |
|----------------|---------|
| ai_grade (status, score, model, graded_at, feedback) | Advisory AI output |
| ai_decision (accept \| edit \| reject) | Human choice |
| ai_decision_at | When the human decided |
| criteria_acknowledged / criteria_acknowledged_at | Criteria-first control |
| review_opened_at | When review drawer opened |
| review_duration_ms | Dwell / time-in-review |
| score / final_score / partner_score_50 | Human scoring outcomes |
| reviewed_by / reviewer_name / reviewed_at | Attribution |
| status | Workflow state after human action |
| learner_disputed_at / learner_dispute_note | Delayed-human path (if used) |

Export: Partner UI Export AI vs human CSV and/or scripts/aims/hitl_gate_test.py --auto produce machine-readable evidence for monitoring and Stage 1 packs.

Product references (implementation):
- Partner UI: src/pages/partner/ProgrammeSubmissionsPage.tsx (ACCEPT_MIN_DWELL_SEC = 25)
- HITL metrics / CSV: src/utils/programmeAiHitl.ts
- Learner explain / dispute: src/components/courses/LearnerAiExplainPanel.tsx
- Grading function: supabase/functions/grade-submission/

---

## 7. Control design summary (what "good HITL" looks like)

| Control | Design | Pass condition |
|---------|--------|----------------|
| Advisory-only | AI does not change status / award points alone | AI-complete rows awaiting human remain non-final until partner save |
| Mandatory decision | accept / edit / reject when AI grade exists | ai_decision populated on gated outcomes |
| Criteria-first | Acknowledge criteria before deciding | criteria_acknowledged = true on decided rows |
| Anti-rubber-stamp | Accept blocked for 25s | review_duration_ms typically >= 20,000 on Accept path |
| Human override | Edit / Reject allowed | Edited/rejected samples exist in evidence pack |
| Attribution | Reviewer identity + timestamps | reviewer_name / reviewed_at / ai_decision_at present |
| Exportability | CSV / auto report | Export runs without error |
| Dispute path | Learner can request human | Dispute fields available when partner delayed |

---

## 8. Current operating baseline (honest status)

Baseline auto run (no UI screenshots attached to this draft):

| Item | Value |
|------|--------|
| Run date (UTC) | 17 September 2026, 06:51 |
| Environment | Production data via partner login |
| Partner account used | nbokete@data-sentinels.com |
| Evidence folder | docs/aims/evidence/hitl/20260917-065134/ |
| Submissions loaded | 3 |
| AI completed | 3 |
| Awaiting human (ai_decision empty) | 3 |
| Accept / Edit / Reject recorded | 0 |

Interpretation for AIMS:
- Demonstrated: advisory AI grades land; export path works (S01, S07).  
- Not yet demonstrated in this baseline: criteria ack on decided rows, dwell on Accept, Edit, Reject, dispute path (S02-S06, S09)  -  because no partner has completed the new gate decisions on these rows yet.  
- Logged gap: one legacy row is approved with a human reviewer (Nono, 26 August 2026) but without ai_decision. This is recorded honestly as pre-gate-field practice, not as proof that AI approved alone. Future approvals should use accept / edit / reject.

Statement for this draft:  
The gate control is designed and implemented in product. The operational evidence pack for full HITL (Accept/Edit/Reject with dwell) is in progress. This document defines the standard; screenshots and completed S02-S06 runs will be annexed when executed.

---

## 9. Evidence annex plan (screenshots later  -  not in this draft)

When UI evidence is collected, attach under Drive 04 Gate Records / T4L-grading / YYYY-MM-DD/ using names:

| Annex ID | Content | Maps to |
|----------|---------|---------|
| A1 | Terminal / auto report baseline | S01, S07 |
| A2 | CSV headers + sample rows | S07, monitoring feed |
| A3 | Criteria blocked  to  acknowledged | S02 |
| A4 | Accept blocked by dwell | S03 |
| A5 | Accept after dwell saved | S04 |
| A6 | Edit with score delta | S05 |
| A7 | Reject saved | S06 |
| A8 | Learner explain + dispute (optional) | S09 |
| A9 | Points not AI-awarded before/after | S10 |

Until annexes exist, this document remains valid as the procedure and control definition.

---

## 10. Escalation and concerns

| Trigger | Action |
|---------|--------|
| Partner suspects unfair AI score | Use Edit or Reject; note reason in partner notes |
| Repeated rubber-stamp pattern (very low dwell) | Raise in weekly delivery sync; review HITL export |
| AI outage / mass errors | Use manual scoring; log as supplier incident (R-T4L-07) |
| Privacy concern (wrong tool / leak) | Stop; escalate; follow Tier 3 data rules |
| Gate control weakened in a release (dwell removed, etc.) | Stop expansion; update Impact + Risk + this gate record same day |

Concerns should be raised early  -  logging a gap is expected; hiding it fails the audit culture AIMS described.

---

## 11. Cadence (link to Section 4 Monitoring / Section 7)

| Cadence | Gate-related activity |
|---------|------------------------|
| Per decision | Partner follows Section 5; system writes Section 6 fields |
| Weekly delivery sync | Blockers on backlog / awaiting-human counts |
| Monthly | Review Accept / Edit / Reject mix, average dwell, score deltas from CSV (feeds Section 4 Monitoring) |
| On change | Re-test gate after model / prompt / rubric / UI gate changes |

---

## 12. Open actions before calling the gate "audit-ready"

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Complete UI Accept path with >=25s dwell on a fresh AI-graded row | Partner + Syntiche | Open |
| 2 | Complete Edit path with human ≠ AI score | Partner + Syntiche | Open |
| 3 | Complete Reject path | Partner + Syntiche | Open |
| 4 | Re-run hitl_gate_test.py --auto and attach updated CSV/report | Syntiche | Open |
| 5 | Attach screenshot annex A1-A7 (real dates) | Syntiche | Open |
| 6 | Decide partner SLA for awaiting-human backlog (R-T4L-04) | Delivery + Syntiche | Open |
| 7 | Record legacy approve-without-ai_decision as known historical gap | Syntiche | Logged (baseline 17 Sep 2026) |

---

## 13. Statement of gate effectiveness (draft)

Design effectiveness: Adequate for Medium residual risk when operated as designed (aligned to Impact + Risk drafts).  

Operating effectiveness (as of 17 September 2026): Partial.  
- Design controls are in production code.  
- Baseline export proves advisory grades and evidence schema.  
- Full operating proof (Accept/Edit/Reject + dwell + criteria on decided rows) is not yet complete and must not be claimed as complete until Section 12 actions are closed.

This partial status is intentional and honest for Stage 1 readiness culture.

---

## 14. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / System owner | Syntiche Musawu | | 17 September 2026 |
| Technical / product review | | | |
| AIMS coordinator review | | | |
| Management acknowledgement | | | |

Author acknowledgement:  
I confirm this draft defines the T4L grading human gate as implemented, links to Impact/Risk controls, records the 17 September 2026 baseline honestly, and does not claim screenshot / full HITL operating evidence that has not yet been completed.

Next review: after first complete Accept/Edit/Reject evidence pack, or within one month, whichever is sooner.

---

## Appendix A  -  One-page auditor path

1. Read this gate definition (Section 2-Section 5).  
2. Open linked Risk rows R-T4L-01 / 03 / 04.  
3. Inspect baseline folder 20260917-065134 (CSV + auto report).  
4. Ask for annex screenshots A3-A7 once marked complete.  
5. Confirm monthly monitoring will consume the same CSV fields.

One-sentence control statement:  
T4L grading may advise; only a partner's dated accept, edit, or reject  -  after criteria acknowledgement and (for accept) minimum dwell  -  authorises treating the outcome as human-final, and AI never awards programme points alone.

---

End of DRAFT  -  Section 3 Gate / HITL Control Record  -  T4L grading (no screenshots in this version)
