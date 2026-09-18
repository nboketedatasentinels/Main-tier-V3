# Section 4 Monitoring Plan

Document status: DRAFT  
Document ID: MON-T4L-001 (working draft - align with AIMS register when assigned)  
Drive folder: 03 Monitoring  
System name: T4L Programme and Podcast Advisory Grading Model  
Short name: T4L grading  
Organisation: Data Sentinels / Transformation Leader (T4L)  
System owner: Syntiche Musawu  
Version: 0.1 Draft  
Date created: 17 September 2026  
Last updated: 17 September 2026  

Linked documents:
- Impact Assessment: docs/aims/FRM001-AI-System-Impact-Assessment-T4L-Grading-DRAFT.md
- Risk Assessment: docs/aims/PR003-AI-Risk-Assessment-Worksheet-T4L-Grading-DRAFT.md
- Gate / HITL control record: docs/aims/GATE-T4L-001-HITL-Control-Record-DRAFT.md
- Monitoring plan: docs/aims/MON-T4L-001-Monitoring-Plan-DRAFT.md
- Data and model record: docs/aims/DATA-T4L-001-Data-and-Model-Record-DRAFT.md
- Baseline HITL export: docs/aims/evidence/hitl/20260917-065134/

Filing: label DRAFT; store under Drive 03 Monitoring / T4L-grading/. Do not backdate. File each monthly note with a real date.

---

## 0. Document control

| Field | Value |
|-------|--------|
| Document type | AI system monitoring plan |
| Purpose | Define what we check, how often, thresholds, owners, and what evidence we keep (AIMS Check step) |
| Scope | T4L advisory grading only |
| Out of scope | Oil Lab, anomaly detection, Celo, AI governance agent, LIFT scoring engine |
| Standard intent | Plan-Do-Check-Improve: this document is the Check control that feeds Improve |
| Honesty rule | Real dates only. If a month is missed, record the miss and restart. Do not invent prior monthly notes |
| First formal monitoring note | Not yet filed (baseline auto export exists for 17 September 2026) |

---

## 1. Why we monitor

Without monitoring, the gate can look fine on paper while quality drifts, partners rubber-stamp, or backlog grows. AIMS expects dated checks month after month.

This plan supports these risks from PR003:

| Risk ID | What monitoring watches |
|---------|-------------------------|
| R-T4L-01 | Rubber-stamping (very low dwell; Accept-heavy mix) |
| R-T4L-02 | Unfair or biased scores (large AI vs human deltas; reject patterns) |
| R-T4L-03 | AI treated as final (silent approve without ai_decision) |
| R-T4L-04 | Delayed human review (awaiting-human backlog age) |
| R-T4L-06 | Model / rubric drift (score delta trends after changes) |
| R-T4L-07 | Supplier issues (AI error rate / outages) |
| R-T4L-08 | Inconsistent partner application (Accept/Edit/Reject mix by org when volume allows) |

---

## 2. What we monitor (metrics)

### 2.1 Core monthly metrics

| ID | Metric | Source | Why it matters |
|----|--------|--------|----------------|
| M1 | Count AI graded (completed) | HITL export / partner stats / hitl_gate_test.py | Volume under the gate |
| M2 | Count awaiting human (ai_decision empty) | Same | Backlog / delayed review (R-T4L-04) |
| M3 | Accept / Edit / Reject counts and percentages | Same | Gate is being used; Edit/Reject prove override |
| M4 | Criteria acknowledged rate on decided rows | criteria_acknowledged | Criteria-first control |
| M5 | Average review dwell (ms or seconds) on decided rows | review_duration_ms | Anti-rubber-stamp |
| M6 | Share of Accept decisions with dwell under 20 seconds | review_duration_ms + ai_decision=accept | Rubber-stamp signal |
| M7 | Average absolute score delta (human minus AI) on Edit/Reject (and Accept if scored) | CSV score_delta | Drift / disagreement |
| M8 | AI error count / rate | ai_grade.status = error | Supplier health (R-T4L-07) |
| M9 | Silent-approve suspects (approved + AI complete + no ai_decision + no reviewer) | CSV / script S10 logic | Control breach |
| M10 | Legacy approve without ai_decision (human reviewed before field existed) | CSV | Historical gap (honest log, not new silent AI) |

### 2.2 Optional when volume allows

| ID | Metric | Note |
|----|--------|------|
| M11 | Accept/Edit/Reject mix by organisation | Fairness / consistency (R-T4L-08) |
| M12 | Learner dispute count | Delayed-human path usage (R-T4L-04) |
| M13 | Model id mix in period | Detect unexpected model switches |

---

## 3. How we collect evidence

| Method | When | Output |
|--------|------|--------|
| Partner UI: Export AI vs human CSV | Monthly (and after incidents) | Dated CSV in monitoring folder |
| scripts/aims/hitl_gate_test.py --auto | Monthly (same day as CSV) | Auto report + CSV under docs/aims/evidence/hitl/ |
| Partner Programme submissions HITL stats strip | Monthly screenshot optional | Annex for Drive 03 Monitoring |
| Weekly delivery sync note | Weekly | Short blockers line (awaiting-human, outages) |

Preferred export columns (minimum):  
submission_id, status, ai_status, ai_score, ai_model, human_decision, human_decision_at, human_score, score_delta_human_minus_ai, criteria_acknowledged, review_duration_ms, reviewer_name, reviewed_at, learner_disputed_at

---

## 4. Frequency and calendar

| Cadence | Activity | Owner |
|---------|----------|-------|
| Weekly | Note awaiting-human backlog and AI outages in delivery sync | System owner / delivery |
| Monthly | Run export + auto script; complete monthly monitoring note (Section 8 template) | Syntiche |
| After material change | Extra check within 7 days of model, prompt, rubric, or gate UI change | Syntiche |
| Quarterly | Summarise trends for management / AIMS review | Syntiche + AIMS coordinator |

Target day: last working week of each month (or next working day if missed - record the real date).

Baseline start: September 2026. First formal monthly note still due (open action).

---

## 5. Thresholds and responses

These are working thresholds for Stage 1 readiness. Adjust with real data after 2-3 months and update this plan with a real date.

| Metric | Watch threshold | Escalate if | Immediate response |
|--------|-----------------|-------------|--------------------|
| M6 low-dwell Accept share | Above 20% of Accepts under 20s | Above 40% or rising 2 months | Retrain partners; sample reviews; raise in weekly sync |
| M2 awaiting human | Growing month on month | Aged items beyond agreed SLA (SLA still open) | Chase partners; use learner dispute path; set SLA |
| M3 Edit+Reject share | Near 0% with high volume | 0% Edit and Reject for 2 months with many Accepts | Investigate rubber-stamping |
| M7 avg abs delta | Sudden jump after change | Jump after model/rubric change without explanation | Freeze expansion; reassess risk; check rubrics |
| M8 AI errors | Spikes vs prior month | Prolonged outage or mass failures | Manual scoring; supplier incident log |
| M9 silent AI approve | Any new case | Any new case after gate go-live | Incident; fix process; update gate record |

If thresholds are breached: log in the monthly note, open a concern, and do not hide the miss.

---

## 6. Roles

| Role | Monitoring duty |
|------|-----------------|
| System owner (Syntiche) | Runs monthly export/script; writes monthly note; tracks open actions |
| Partners | Operate gate daily; respond to backlog chase-ups |
| AIMS coordinator | Files notes in Drive 03 Monitoring; checks cadence |
| Management | Reviews escalations; resources for fixes |
| Independent audit (Carlo / as assigned) | May sample monitoring notes at Stage 1 readiness |

---

## 7. Record keeping

Store under Drive:

03 Monitoring / T4L-grading / YYYY-MM/

Suggested files per month:
- MON-T4L-YYYY-MM-note.md (or PDF)
- T4L-HITL-export-YYYYMMDD.csv
- HITL-auto-report-YYYYMMDD.md (optional)
- Optional screenshot of HITL stats strip

Naming uses the real run date. Never backdate.

Retention: keep for the AIMS certification cycle (and at least until Stage 2 / annual surveillance guidance is confirmed).

---

## 8. Monthly monitoring note template (copy each month)

```text
T4L grading - Monthly monitoring note
Document ID: MON-T4L-YYYY-MM
Period covered: _______________
Run date (real): _______________
Prepared by: _______________
Environment: production / staging
Export file: _______________
Auto report file (if any): _______________

1. Volume
- AI graded (M1): ____
- Awaiting human (M2): ____
- Accepted (M3): ____
- Edited (M3): ____
- Rejected (M3): ____

2. Gate quality
- Criteria ack rate on decided rows (M4): ____
- Average dwell (M5): ____
- Accepts with dwell under 20s (M6): ____ (% = ____)

3. Score / drift
- Average abs score delta (M7): ____
- Notes on outliers: ____

4. Reliability
- AI errors (M8): ____
- New silent-approve suspects (M9): ____
- Legacy approve-without-ai_decision still present (M10): ____

5. Threshold breaches this month
- None / list: ____

6. Incidents / concerns raised
- ____

7. Changes in period (model, prompt, rubric, UI)
- ____

8. Actions for next month
- ____

9. Honesty statement
I confirm figures come from the dated export/report above and were not backdated.

Signed: _______________  Date: _______________
```

---

## 9. Link to Improve (Plan-Do-Check-Improve)

| If Check finds | Improve action |
|----------------|----------------|
| Rubber-stamping | Partner guidance; sample audits; reinforce 25s Accept rule |
| Drift after change | Rubric/prompt fix; temporary tighter human review |
| Backlog | SLA decision; staffing; dispute path reminder |
| Supplier errors | Manual path; vendor follow-up; REG 009 update if needed |
| Control gap in product | Engineering fix; update Gate GATE-T4L-001 same day |

Improvements get real dates in the lifecycle / change log (Section 6 pack when filed).

---

## 10. Current baseline (honest status as of 17 September 2026)

| Item | Status |
|------|--------|
| Monitoring plan (this document) | Draft created |
| Export capability | Working (S07 PASS on baseline auto run) |
| First formal monthly note | Not filed yet |
| UI Accept/Edit/Reject samples for richer metrics | Still open (see Gate Section 12) |
| Partner SLA for awaiting-human | Still open |
| REG 009 listing for Gemini | Pending register circulation |

Interpretation: we can measure. We have not yet completed a full monthly Check cycle. That is recorded honestly.

---

## 11. Open actions

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | File first monthly monitoring note using Section 8 template | Syntiche | Open |
| 2 | Agree partner awaiting-human SLA and add to thresholds | Delivery + Syntiche | Open |
| 3 | After first Accept/Edit/Reject UI pack, recalibrate M6/M7 thresholds | Syntiche | Open |
| 4 | Confirm Drive 03 Monitoring folder path with AIMS coordinator | Syntiche / Ayako | Open |
| 5 | Add Gemini / grading path to REG 009 when available | Syntiche / Ayako | Open |

---

## 12. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / System owner | Syntiche Musawu | | 17 September 2026 |
| AIMS coordinator review | | | |
| Management acknowledgement | | | |

Author acknowledgement:  
I confirm this monitoring plan matches the T4L grading Impact, Risk, and Gate drafts, uses real dates, and does not claim monthly monitoring notes that have not yet been filed.

Next review: after first monthly note, or within one month, whichever is sooner.

---

## Appendix A - Auditor quick path

1. Read this plan (metrics + thresholds + cadence).  
2. Ask for the latest MON-T4L-YYYY-MM note and matching CSV.  
3. Compare metrics to Gate evidence fields in GATE-T4L-001.  
4. Confirm Improve actions were logged when thresholds breached.  
5. Confirm no backdated notes.

One-sentence statement:  
T4L grading is checked at least monthly using HITL export metrics on volume, human decisions, dwell, score deltas, errors, and silent-approve suspects, with dated notes and clear escalation.

---

End of DRAFT - Section 4 Monitoring Plan - T4L grading
