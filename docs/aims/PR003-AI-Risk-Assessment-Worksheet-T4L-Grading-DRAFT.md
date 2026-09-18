# AI Risk Assessment Worksheet

**Document status:** DRAFT  
**Document ID:** PR003 / Risk Worksheet (working draft — align ID with AIMS register when assigned)  
**System name:** T4L Programme & Podcast Advisory Grading Model  
**Short name:** T4L grading  
**Organisation:** Data Sentinels / Transformation Leader (T4L)  
**System owner:** Syntiche Musawu  
**Prepared for:** AIMS risk assessment pack (pre-chat with AIMS)  
**Version:** 0.1 Draft  
**Date created:** 16 September 2026  
**Last updated:** 16 September 2026  

**Parent / linked documents:**
- Impact Assessment: `docs/aims/FRM001-AI-System-Impact-Assessment-T4L-Grading-DRAFT.md` (same date)
- Gate / HITL control record: `docs/aims/GATE-T4L-001-HITL-Control-Record-DRAFT.md`
- Risk register: to be linked when AIMS register ID is assigned
- Monitoring notes; REG 009 (approved tools) — when filed
- Test scripts: `docs/aims/HITL-S3-Gate-Testing-Scripts-T4L-Grading-DRAFT.md`

> Filing instruction: copy the official AIMS **AI Risk Assessment Worksheet** template, label **DRAFT**, paste/adapt this content, then store the signed final in Drive folder **02 Risk Assessments**.

---

## 0. Document control

| Field | Value |
|-------|--------|
| Assessment type | AI Risk Assessment Worksheet |
| Scope | T4L grading only (same system as Impact Assessment §1) |
| Out of scope | Oil Lab, anomaly detection, Celo, AI governance agent, LIFT assessment engine |
| Lifecycle stage | Build / pilot — advisory grading with mandatory human gate |
| Impact assessment residual level | Medium (see linked FRM001 draft) |
| Assessment basis | Current product design + shipped HITL controls as of 16 September 2026 |
| Honesty note | No backdating. AIMS evidence baseline starts August/September 2026. Gaps are listed openly. |
| Next review | Monthly while pilot/live; immediately after material model, prompt, rubric, or gate change |

---

## 1. System summary (from Impact Assessment)

**One-sentence statement:**  
T4L grading uses Google Gemini to produce an **advisory** rubric score on learner submissions; partners must **accept / edit / reject** with timed review evidence before outcomes are treated as human-final; AI never awards programme points alone.

| Item | Detail |
|------|--------|
| Model | Google Gemini (`gemini-3-flash-preview` via `grade-submission` Edge Function) |
| Hosting | Supabase + `https://app.t4leader.com` |
| Decision authority | Human (partner) for gated outcomes |
| Primary harm domains | Fairness, automation bias, privacy, drift, reputation / client trust |

---

## 2. Risk assessment method

### 2.1 Scales

**Likelihood (L)**

| Score | Label | Meaning |
|------:|-------|---------|
| 1 | Rare | Unlikely in normal operation within 12 months |
| 2 | Unlikely | Possible but not expected routinely |
| 3 | Possible | Could occur several times a year without strong controls |
| 4 | Likely | Expected periodically if controls weaken |
| 5 | Almost certain | Expected without effective controls |

**Impact / consequence (I)**

| Score | Label | Meaning |
|------:|-------|---------|
| 1 | Negligible | Minimal learner / org / business effect |
| 2 | Minor | Limited unfairness or delay; recoverable locally |
| 3 | Moderate | Material unfairness, privacy concern, or client complaint risk |
| 4 | Major | Systemic unfair grading, serious privacy incident, or contractual damage |
| 5 | Severe | Regulatory / certification failure, major client loss, or widespread learner harm |

**Risk score = L × I**

| Score band | Rating | Default treatment expectation |
|-----------:|--------|-------------------------------|
| 1–4 | Low | Monitor; accept with justification if needed |
| 5–9 | Medium | Mitigate; document controls + evidence |
| 10–15 | High | Mitigate before expansion; escalate to AIMS / management |
| 16–25 | Critical | Avoid or stop until redesigned |

### 2.2 Treatment options (AIMS)
- **Mitigate** — reduce likelihood and/or impact with controls  
- **Avoid** — do not use the capability in that way  
- **Accept** — residual risk consciously accepted (statement of acceptability)  
- **Transfer** — limited for this system (supplier contracts / insurance); accountability stays with Data Sentinels

### 2.3 Inherent vs residual
- **Inherent** = risk if AI grading ran with weak or no governance  
- **Residual** = risk with current controls + stated monitoring cadence  

---

## 3. Risk register entries (T4L grading)

### R-T4L-01 — Automation bias / rubber-stamping HITL

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-01 |
| Title | Partner accepts AI grade without genuine review |
| Description | Reviewer clicks Accept quickly; AI estimate becomes de facto final grade. Matches the failure mode highlighted in AIMS awareness (ungoverned AI grading in education settings). |
| Affected parties | Learners, client organisations, Data Sentinels reputation |
| Inherent L / I / Score | 4 × 4 = **16 Critical** |
| Existing controls | Mandatory accept/edit/reject; criteria acknowledgement; **25s Accept dwell**; review duration persisted; HITL CSV with dwell + score delta |
| Residual L / I / Score | 2 × 4 = **8 Medium** |
| Treatment | **Mitigate** |
| Control owner | Syntiche (product) + Partners (operational use) |
| Evidence required | Dated HITL rows: decision, `review_duration_ms`, `criteria_acknowledged`, decision timestamp |
| Monitoring | Monthly Accept vs Edit vs Reject rates + average dwell + average \|human−AI\| score delta |
| Status | Controls shipped; monthly monitoring cadence **not yet formally started** (gap) |

---

### R-T4L-02 — Unfair / biased advisory scores

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-02 |
| Title | Model or rubric produces systematically unfair scores |
| Description | Bias by language, culture, writing style, sector examples, or incomplete rubrics → inconsistent treatment across cohorts. |
| Affected parties | Learners, organisations |
| Inherent L / I / Score | 3 × 4 = **12 High** |
| Existing controls | Rubric-by-`component_id`; human edit/reject path; learner explain + dispute; HITL export for AI vs human deltas |
| Residual L / I / Score | 2 × 3 = **6 Medium** |
| Treatment | **Mitigate** |
| Control owner | Syntiche + rubric owners / delivery |
| Evidence required | Sample edited/rejected cases; monthly score-delta review; dispute logs |
| Monitoring | Monthly review of large score deltas and reject reasons; escalate pattern bias |
| Status | Technical controls present; formal bias review ritual **open** |

---

### R-T4L-03 — AI treated as final authority (status / points)

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-03 |
| Title | AI silently finalises status or awards points |
| Description | Design regression or misconfiguration causes `ai_grade` to change submission status or award programme points without human gate. |
| Affected parties | Learners, partners, certification integrity |
| Inherent L / I / Score | 3 × 5 = **15 High** |
| Existing controls | Product rule: advisory only — AI does **not** change status or award points alone; partner remains gate; manual scoring fallback on AI error |
| Residual L / I / Score | 1 × 5 = **5 Medium** |
| Treatment | **Mitigate** (design control) + **Accept** residual engineering failure risk with monitoring |
| Control owner | Syntiche (engineering) |
| Evidence required | Code/deploy notes; sample submissions where AI completed but status unchanged until human decision |
| Monitoring | Spot-check production rows monthly; regression tests on grading path when changing function |
| Status | Design control in place; keep under change control |

---

### R-T4L-04 — Delayed or missing human review

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-04 |
| Title | Partner backlog leaves AI feedback looking final |
| Description | Learners see AI feedback for long periods without partner decision; perceive AI as the grader. |
| Affected parties | Learners, organisations |
| Inherent L / I / Score | 4 × 3 = **12 High** |
| Existing controls | Learner AI explanation panel; dispute path toward `needs_revision` / human attention |
| Residual L / I / Score | 3 × 3 = **9 Medium** |
| Treatment | **Mitigate** |
| Control owner | Partners (ops) + Syntiche (product SLA design) |
| Evidence required | Dispute events; ageing report of AI-complete / human-pending |
| Monitoring | Count of `awaitingHuman` from HITL stats; agree SLA (open process item) |
| Status | Technical fallback exists; **partner SLA not yet decided** (gap from Impact Assessment) |

---

### R-T4L-05 — Privacy leakage of learner / client content

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-05 |
| Title | Submission text exposed via unapproved tools or oversharing |
| Description | Learner reflections / workplace detail leave approved path (e.g. pasted into free consumer AI) or are over-accessed internally. Tier-3 client/learner data under AIMS AI-use briefing. |
| Affected parties | Learners, client orgs; POPIA/GDPR exposure where applicable |
| Inherent L / I / Score | 3 × 5 = **15 High** |
| Existing controls | Grading via platform Edge Function + secret API key (not client-side key); access scoped to partners/admins; staff policy: Tier 3 needs clearance / approved tools only |
| Residual L / I / Score | 2 × 4 = **8 Medium** |
| Treatment | **Mitigate** |
| Control owner | Syntiche (platform) + all staff (use policy) |
| Evidence required | REG 009 tool approval for Gemini when circulated; access logs / RLS design notes; incident log if any |
| Monitoring | Confirm Gemini listed on approved tools register; refresher on Tier 1/2/3 AI use |
| Status | Platform path controlled; **REG 009 listing pending** circulation |

---

### R-T4L-06 — Model / prompt / rubric drift

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-06 |
| Title | Score quality drifts after model or rubric change |
| Description | Provider model updates, prompt edits, or rubric changes shift scores; team does not notice until client complaint. |
| Affected parties | Learners, partners, orgs |
| Inherent L / I / Score | 3 × 3 = **9 Medium** |
| Existing controls | Model id stored on grade; HITL CSV (AI vs human); change should be dated in lifecycle/change log |
| Residual L / I / Score | 2 × 3 = **6 Medium** |
| Treatment | **Mitigate** |
| Control owner | Syntiche |
| Evidence required | Monthly monitoring note; change log with real dates (no backdating) |
| Monitoring | Monthly AI−human delta trend; re-assess impact/risk after material changes |
| Status | Export exists; **first formal monthly monitoring note not yet filed** (gap) |

---

### R-T4L-07 — Supplier / third-party dependency (Google Gemini)

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-07 |
| Title | Provider outage, policy change, or quality shift |
| Description | Gemini unavailable or terms/quality change; grading stops or behaviour changes. Accountability remains with Data Sentinels (not outsourced). |
| Affected parties | Partners, learners (delay); delivery team |
| Inherent L / I / Score | 3 × 3 = **9 Medium** |
| Existing controls | Human-only manual scoring remains valid if AI errors; advisory architecture |
| Residual L / I / Score | 2 × 2 = **4 Low** |
| Treatment | **Mitigate** + **Accept** residual supplier dependency |
| Control owner | Syntiche |
| Evidence required | Error-state handling samples; vendor listed when REG 009 available |
| Monitoring | Track grading error rate; escalate prolonged outages |
| Status | Acceptable with manual fallback |

---

### R-T4L-08 — Inconsistent partner application of gate

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-08 |
| Title | Different partners apply accept/edit/reject inconsistently |
| Description | Same quality of work treated differently across organisations → fairness and client-trust risk. |
| Affected parties | Learners, organisations |
| Inherent L / I / Score | 3 × 3 = **9 Medium** |
| Existing controls | Shared rubrics; HITL evidence; edit path; future monthly calibration review |
| Residual L / I / Score | 3 × 2 = **6 Medium** |
| Treatment | **Mitigate** |
| Control owner | Delivery / partners + Syntiche (reporting) |
| Evidence required | Cross-org HITL stats comparison when volume allows |
| Monitoring | Monthly Accept/Edit/Reject mix by organisation (where sample size allows) |
| Status | Reporting capability exists; calibration process **to start with monthly reviews** |

---

### R-T4L-09 — Over-claiming AI maturity / certification in sales

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-09 |
| Title | Commercial claims outpace evidenced AIMS practice |
| Description | Proposals reference certification journey while records are incomplete; auditor or client finds gap between claim and dated evidence. |
| Affected parties | Data Sentinels commercial trust; AIMS certification path |
| Inherent L / I / Score | 3 × 4 = **12 High** |
| Existing controls | AIMS honesty rule (real dates, no backdating); this impact + risk pack; awareness session evidence |
| Residual L / I / Score | 2 × 3 = **6 Medium** |
| Treatment | **Mitigate** |
| Control owner | Leadership (claims) + system owner (evidence pack) |
| Evidence required | Signed drafts with real dates; monthly records once cadence starts |
| Monitoring | Management review of proposal language vs evidence readiness |
| Status | Draft assessments dated 16 September 2026 — do not claim older formal AIMS operation |

---

### R-T4L-10 — Security of model API credentials / webhook path

| Field | Content |
|-------|---------|
| Risk ID | R-T4L-10 |
| Title | Compromise of `GEMINI_API_KEY` or grading webhook abuse |
| Description | Stolen secret or unauthenticated webhook misuse could leak content or pollute grades. |
| Affected parties | Learners (privacy), platform integrity |
| Inherent L / I / Score | 2 × 4 = **8 Medium** |
| Existing controls | Secret in Supabase secrets (not in client); service-role write for grades; deploy/webhook hardening per runbook |
| Residual L / I / Score | 1 × 4 = **4 Low** |
| Treatment | **Mitigate** |
| Control owner | Syntiche / platform ops |
| Evidence required | Secret management practice; deploy checklist from `grade-submission` runbook |
| Monitoring | Rotate key on suspected exposure; review webhook config on change |
| Status | Standard platform controls; keep under change control |

---

## 4. Risk summary table

| Risk ID | Title | Inherent | Residual | Treatment | Priority |
|---------|-------|----------|----------|-----------|----------|
| R-T4L-01 | Rubber-stamping HITL | 16 Critical | 8 Medium | Mitigate | P1 |
| R-T4L-02 | Unfair / biased scores | 12 High | 6 Medium | Mitigate | P1 |
| R-T4L-03 | AI as final authority | 15 High | 5 Medium | Mitigate (+ accept residual eng. failure) | P1 |
| R-T4L-04 | Delayed human review | 12 High | 9 Medium | Mitigate | P1 |
| R-T4L-05 | Privacy leakage | 15 High | 8 Medium | Mitigate | P1 |
| R-T4L-06 | Model / rubric drift | 9 Medium | 6 Medium | Mitigate | P2 |
| R-T4L-07 | Supplier dependency | 9 Medium | 4 Low | Mitigate + Accept | P2 |
| R-T4L-08 | Inconsistent partner gates | 9 Medium | 6 Medium | Mitigate | P2 |
| R-T4L-09 | Over-claiming maturity | 12 High | 6 Medium | Mitigate | P1 |
| R-T4L-10 | API / webhook security | 8 Medium | 4 Low | Mitigate | P2 |

**Highest residual risks to watch:** R-T4L-04 (SLA), R-T4L-01 (HITL quality), R-T4L-05 (privacy / approved tools).

---

## 5. Controls mapped to Plan–Do–Check–Improve

| PDCI stage | What we do for T4L grading | Evidence |
|------------|----------------------------|----------|
| **Plan** | Impact assessment + this risk worksheet + AI responsibility awareness | Dated drafts; sign-in / policy ack when circulated |
| **Do** | Run advisory grading with real HITL (accept/edit/reject, dwell, criteria ack) | Submission HITL fields in production |
| **Check** | Monthly HITL export review; drift / bias / backlog checks | Monitoring notes (to start); CSV exports |
| **Improve** | Rubric/prompt/process changes with real dates; close open SLA / REG 009 items | Change log + updated risk rows |

---

## 6. Open actions (must close for Stage 1 readiness)

| # | Action | Owner | Target | Status |
|---|--------|-------|--------|--------|
| 1 | Start monthly HITL monitoring note (Accept/Edit/Reject, dwell, score delta) | Syntiche | First note in next monthly cycle | Open |
| 2 | Decide partner review SLA (N days) and write it down | Syntiche + delivery | Before Stage 1 readiness | Open |
| 3 | List Gemini / grading path on REG 009 when register shared | Syntiche / Ayako | When REG 009 circulated | Open |
| 4 | Link this worksheet to central risk register ID | AIMS coordinator | When IDs assigned | Open |
| 5 | File first gate-record samples (real dated decisions) | Syntiche | Ongoing from first live reviews | Open |
| 6 | Revisit residual scores after first 30 days of monitoring data | Syntiche | ~30 days after monitoring starts | Open |

---

## 7. Statement of acceptability

### 7.1 Decision
**Residual risk for continued pilot / controlled live use of T4L advisory grading is ACCEPTABLE**, subject to the conditions below.

### 7.2 Why acceptable
1. Inherent risks that would be Critical/High without governance are reduced to **Low–Medium** by advisory-only design and demonstrable HITL controls.  
2. Remaining Medium residuals are understood, owned, and tied to explicit monitoring / open actions — not ignored.  
3. Manual human scoring remains available if AI fails.  
4. This aligns with AIMS expectation: choose controls, document them, and show dated evidence over time (not perfect history invented after the fact).

### 7.3 Conditions of acceptability
1. Impact Assessment (FRM001 draft) and this Risk Worksheet remain linked and signed through AIMS process.  
2. Monthly HITL monitoring begins and is filed with **real dates**.  
3. Partner SLA (R-T4L-04) is decided and communicated.  
4. Gemini remains on the approved-tools path (REG 009) once available.  
5. No claim of long-running certified AIMS operation before the August/September 2026 baseline.  
6. Material model/prompt/rubric changes trigger reassessment (update this worksheet + impact form).

### 7.4 If conditions are breached
Treat as **not acceptable for expansion** until gaps are logged and closed; record the miss honestly (do not backdate).

---

## 8. Reassessment triggers

Re-run or update this worksheet when any of the following occur:
- Model ID / provider change
- Major rubric or prompt change
- Removal or weakening of dwell / accept-edit-reject controls
- Privacy incident or client complaint about AI grading
- Decision to let AI award points or change status without human gate
- AIMS Stage 1 readiness review findings
- Scheduled monthly / management review

---

## 9. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / System owner | Syntiche Musawu | | 16 September 2026 |
| Technical / product review | | | |
| AIMS coordinator review | | | |
| Management approval (acceptability) | | | |

**Author acknowledgement:**  
I confirm this draft risk assessment is consistent with the linked Impact Assessment for T4L grading, uses real dates, and lists residual risks and open actions without concealment.

---

## Appendix A — Auditor quick path (evidence chain)

1. Find risk in this worksheet / register (e.g. R-T4L-01)  
2. Confirm linked Impact Assessment describes the same system  
3. Inspect control (HITL UI + persisted fields)  
4. Pull dated evidence (HITL CSV / gate records / monitoring note)  
5. Confirm treatment (mitigate / accept) matches Statement of Acceptability §7  

**Product references:**
- Partner HITL UI: `src/pages/partner/ProgrammeSubmissionsPage.tsx`
- HITL metrics / CSV: `src/utils/programmeAiHitl.ts`
- Learner explain / dispute: `src/components/courses/LearnerAiExplainPanel.tsx`
- Grading function: `supabase/functions/grade-submission/`

---

## Appendix B — Cross-walk to Impact Assessment harms

| Impact Assessment harm theme | Risk IDs |
|------------------------------|----------|
| Rubber-stamping | R-T4L-01 |
| Bias / unfair grading | R-T4L-02, R-T4L-08 |
| AI as final score | R-T4L-03 |
| Delayed human review | R-T4L-04 |
| Privacy | R-T4L-05, R-T4L-10 |
| Drift | R-T4L-06 |
| Supplier | R-T4L-07 |
| Reputation / weak governance narrative | R-T4L-09 |

---

*End of DRAFT — AI Risk Assessment Worksheet — T4L grading*
