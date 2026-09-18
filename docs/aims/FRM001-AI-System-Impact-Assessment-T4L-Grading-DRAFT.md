# AI System Impact Assessment Form

**Document status:** DRAFT  
**Document ID:** FRM001 (working draft — align ID with AIMS register when assigned)  
**System name:** T4L Programme & Podcast Advisory Grading Model  
**Short name:** T4L grading  
**Organisation:** Data Sentinels / Transformation Leader (T4L)  
**System owner:** Syntiche Musawu  
**Prepared for:** AIMS impact assessment pack (pre-chat with AIMS)  
**Version:** 0.1 Draft  
**Date created:** 16 September 2026  
**Last updated:** 16 September 2026  
**Related documents (to link when filed):**
- AI Risk Assessment Worksheet — T4L grading: `docs/aims/PR003-AI-Risk-Assessment-Worksheet-T4L-Grading-DRAFT.md`
- Gate / HITL control record: `docs/aims/GATE-T4L-001-HITL-Control-Record-DRAFT.md`
- Gate test scripts: `docs/aims/HITL-S3-Gate-Testing-Scripts-T4L-Grading-DRAFT.md`
- Monitoring notes
- Approved tools register (REG 009), when circulated

> Instruction for filing: make a Google Docs copy of the official AIMS template, label it **DRAFT**, paste/adapt this content, then drop the final signed version in the shared AIMS Drive folder.

---

## 0. Document control

| Field | Value |
|-------|--------|
| Assessment type | AI System Impact Assessment |
| Scope of this form | T4L grading only (not Oil Lab, anomaly detection, Celo, or AI governance agent) |
| Lifecycle stage at assessment | Build / pilot — advisory grading live in product design; human gate required before learner outcomes are final |
| Next planned review | After risk worksheet complete, then monthly while in pilot / live |
| Honesty note | AIMS baseline is treated as starting properly from August/September 2026. No backdating of earlier informal practice. |

---

## 1. System identification

### 1.1 What the system is
An automated advisory grading capability on the Transformation Leader (T4L) platform. When a learner submits a programme artefact (e.g. capstone / case study / practical / related programme component) or eligible course-podcast work, a cloud model (**Google Gemini**, currently configured as `gemini-3-flash-preview`) scores the submission against a stored rubric and writes an **advisory** grade (`ai_grade`) onto the submission record.

Partners then open the submission already pre-graded and must **accept, edit, or reject** the AI estimate. The AI does **not** change submission status by itself and does **not** award programme points by itself.

### 1.2 What the system is not
- Not a final autonomous grader of learner performance
- Not a points engine
- Not a replacement for partner / organisational accountability
- Not a general-purpose chatbot exposed to learners for open conversation
- Not in scope for other Data Sentinels AI tools (Oil Lab, anomaly detection, Celo receipt scanning, AI governance agent)

### 1.3 Business purpose / problem it solves
Partners review large volumes of written programme evidence. Manual-only review is slow and inconsistent. Advisory AI grading aims to:
- Speed partner review
- Apply a consistent rubric first draft
- Surface structured feedback learners can understand
- Keep a human accountable for the final decision

### 1.4 In-scope components
- `programme_component_submissions` advisory grading path (`grade-submission` Edge Function)
- Rubric matching by `component_id`
- Partner HITL review UI (accept / edit / reject) with evidence fields
- HITL export (CSV) for monitoring / drift analysis
- Learner-facing AI explanation + dispute path where human review is missing or delayed (podcast / explain panel)

### 1.5 Out of scope for this assessment
- LIFT personality / leadership assessment scoring logic (separate product surface; not this grading model)
- Mentor / coach session notes generation
- Non-T4L Data Sentinels products
- Free-consumer use of ChatGPT/Claude by staff for internal work (covered by AI use policy / REG 009, not this system form)

---

## 2. Intended use and operating context

### 2.1 Intended users

| Role | How they interact |
|------|-------------------|
| Learner | Submits work; may see AI feedback / explanation; may dispute and request human attention |
| Partner / organisation reviewer | Reviews AI estimate; accepts, edits, or rejects; records human score / status |
| Super-admin / delivery team | Configures, monitors, exports HITL evidence; responds to incidents |
| Mentors / coaches | Not primary graders of these artefacts; may see related learner context elsewhere |

### 2.2 Intended use cases
1. Pre-grade programme component submissions against artefact rubrics
2. Support partner decisions with an advisory score, pass signal, and feedback text
3. Provide learners with an explanation of AI feedback when they need to understand or challenge it
4. Produce dated HITL evidence (decision, dwell time, criteria acknowledgement, score delta) for governance / monitoring

### 2.3 Prohibited / unintended uses
- Treating AI score as final without human decision where a partner gate is required
- Using learner submission content outside T4L grading / support / audit purposes
- Feeding client/learner personal data into unapproved consumer AI tools
- Silently changing pass/fail or points based only on the model output
- Using the model to generate discriminatory or punitive decisions without human review

### 2.4 Deployment environment
- Production web application: `https://app.t4leader.com`
- Backend: Supabase (database + Edge Function `grade-submission`)
- Model provider: Google Gemini API (key stored as platform secret, not in client)

### 2.5 Human in the loop (design intent)
Human review is **mandatory for partner-gated outcomes**. The product is designed so HITL is demonstrable, not a 0.2-second rubber stamp:
- Criteria are shown before the AI score is fully actioned
- Accept requires minimum dwell time (**25 seconds**) unless a decision already exists
- Partner must choose **accept / edit / reject**
- System persists: decision, decision time, criteria acknowledgement, review opened time, review duration (ms), human vs AI score delta
- Where partner action is delayed, learners can see explanation and dispute toward `needs_revision` / human path

---

## 3. Stakeholders and who is impacted

| Stakeholder | Nature of impact | Direction |
|-------------|------------------|-----------|
| Learners | Receive advisory scores / feedback framing; fairness of assessment experience; ability to challenge | High relevance |
| Partners | Workload change; risk of automation bias (over-accepting AI); accountability for final grades | High relevance |
| Client organisations (e.g. schools / foundations running T4L) | Quality and credibility of programme evidence; trust in assessment integrity | High relevance |
| Mentors / coaches | Indirect — learner progress context; not primary artefact graders | Medium / low |
| Data Sentinels delivery team | Operational, legal, reputational, and certification evidence obligations | High relevance |
| Model provider (Google) | Processes submission text sent for grading | Medium (supplier dependency) |

### Impact summary
The system can materially affect **how learner work is judged and how quickly**, but final academic/programme outcomes remain **human-owned** where the partner gate applies. Residual impact is therefore driven less by “AI decides alone” and more by **whether humans actually review**, **bias/consistency of rubrics + model**, and **privacy of learner text**.

---

## 4. Data and inputs / outputs

### 4.1 Inputs
- Learner submission answers / artefacts (text and related component metadata)
- Component identity and title
- Rubric definitions mapped to `component_id`
- Organisation / learner identifiers needed to attach the grade to the correct record

### 4.2 Outputs
- Advisory `ai_grade` object (status, score, pass signal, feedback, model id, graded-at timestamp)
- Partner HITL fields (decision, timestamps, criteria acknowledgement, dwell / review duration)
- Optional learner-visible explanation text
- HITL CSV export for monitoring (AI vs human scores, decisions, dwell, deltas)

### 4.3 Personal / sensitive data
May include:
- Names, emails, organisation affiliation
- Written reflections, workplace examples, leadership narratives that can be personal or professionally sensitive

Classification for staff AI-use policy: treat learner submissions as **Tier 3 (client / learner data)** — only via approved platform tooling, not free consumer AI accounts.

### 4.4 Retention / access / storage (summary)
- Stored in T4L Supabase records under platform access controls / RLS
- Access primarily: relevant partners for their orgs, authorised admins, system functions for grading
- Model provider receives content required to grade the submission during API calls
- Detailed retention schedule should be confirmed against platform privacy / data policy and linked from this form when available

### 4.5 Third-party / supplier
| Party | Role | Governance note |
|-------|------|-----------------|
| Google (Gemini API) | Inference provider | Approved-tool / supplier control via REG 009 process when register is shared |
| Supabase | Hosting / DB / functions | Platform infrastructure |

---

## 5. Decisions influenced by AI

| Decision type | AI role | Human role | Notes |
|---------------|---------|------------|-------|
| Draft score / pass signal / feedback | Produces advisory estimate | Reviews and may change | AI never sole authority |
| Submission status (approved / needs revision / etc.) | May inform UI defaults | Partner sets / confirms | AI must not silently finalise |
| Programme points award | None | Existing partner / checklist / points rules | Explicit product rule: AI does not award points alone |
| Learner dispute / request human | Explains itself | Human path via dispute / `needs_revision` | Fallback when review delayed |

### Failure / fallback behaviour
- If grading fails: error state on `ai_grade`; partner can still review and score manually
- If model unavailable: human-only path remains valid
- If partner delayed: learner explanation + dispute path reduces “silent AI authority”

---

## 6. Benefits

| Beneficiary | Benefit |
|-------------|---------|
| Learners | Faster feedback loop; clearer rubric-aligned comments; ability to see why AI scored as it did |
| Partners | Reduced first-pass marking time; more consistent starting point across cohorts |
| Client organisations | Scalable programme delivery without abandoning human accountability |
| Data Sentinels / T4L | Differentiator via governed AI (evidence of HITL, monitoring exports) aligned to AIMS narrative sold to clients |

---

## 7. Potential harms and adverse impacts

| Harm | Who harmed | How it could happen | Severity (draft) |
|------------------|---------------------|------------------|
| Unfair / biased grade framing | Learners, orgs | Model or rubric skew by language, culture, writing style, sector examples | Medium–High |
| Rubber-stamping / automation bias | Learners, orgs | Partner accepts AI too quickly without real review | High |
| False confidence in “AI graded” quality | Clients | Marketing or ops treat advisory score as certified outcome | Medium |
| Delayed human review | Learners | Backlog; AI feedback misread as final | Medium |
| Privacy leakage | Learners, orgs | Submission text sent to unapproved tools or over-shared | High |
| Inconsistent treatment across cohorts | Learners, orgs | Different partners apply accept/edit/reject differently | Medium |
| Model drift over time | Learners, orgs | Provider model/prompt/rubric changes shift scores unnoticed | Medium |
| Reputational / contractual damage | Data Sentinels, clients | Client examples (e.g. schools using ungoverned AI for lessons/grades) show why weak HITL fails | High |

### Who bears harm if controls fail
Primarily **learners and client organisations**; secondarily **Data Sentinels** (trust, certification, commercial proposals that already reference certification journey).

---

## 8. Controls already in place (impact mitigations)

| Control | What it does | Evidence location (product) |
|---------|--------------|-----------------------------|
| Advisory-only design | AI does not change status or award points alone | `grade-submission` design; submission service fields |
| Mandatory partner decision | Accept / edit / reject required when AI grade exists | Programme submissions partner UI |
| Anti-rubber-stamp dwell | Accept blocked until ~25s review dwell (unless prior decision) | Partner review panel |
| Criteria-first review | Reviewer engages criteria; acknowledgement captured | `criteria_acknowledged` fields |
| Dated HITL audit fields | Decision time, review opened, duration ms, score delta | DB fields + HITL CSV export |
| Learner explain + dispute | AI must explain itself; learner can push to human path | `LearnerAiExplainPanel` |
| Manual fallback | Partner can score if AI errors | Partner UI error handling |
| Monitoring hook | Export AI vs human for drift / quality review | `programmeAiHitl.ts` CSV + stats |

### Open process items (must close in AIMS cadence)
1. Monthly group review of Accept vs Edit vs Reject rates (from HITL export)
2. Agree SLA: if partner does not act within N days, learner dispute is the default human path
3. Formalise monitoring note template + owner calendar (monthly)
4. Confirm approved-tool registration for Gemini under REG 009 when circulated
5. Link this impact form to the completed risk worksheet and risk-register row

---

## 9. Residual impact judgement

### 9.1 Overall impact level (draft)
**Medium** (with current controls), elevating toward **High** if HITL becomes performative or monitoring is not run.

### 9.2 Justification
- The system influences assessment experience and partner workload at scale.
- It does **not** autonomously finalise points or status when the partner gate is used as designed.
- Main residual impact sits in human behaviour (rubber-stamping), fairness/bias, privacy of learner text, and drift without monthly checks.
- Product already encodes stronger-than-average HITL evidence compared with “AI grades and nobody checks,” which is the failure mode called out in AIMS awareness (ungoverned classroom AI use).

### 9.3 Go-live / continued-use position
**Acceptable to continue pilot / controlled live use**, provided:
1. This impact assessment is signed as draft→approved through AIMS process
2. Matching risk assessment is completed immediately after
3. Monthly HITL monitoring notes begin (even if early months show “baseline establishing”)
4. No backdated claims of mature AIMS operation before August/September 2026 baseline

### 9.4 Conditions / follow-ups before calling the control environment “audit-ready”
- Risk worksheet completed and linked
- Gate record samples retained (real dated accept/edit/reject events)
- First monthly monitoring note filed
- Open SLA item decided and written down

---

## 10. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / System owner | Syntiche Musawu | | 16 September 2026 |
| Technical / product review | | | |
| AIMS coordinator review (Ayako / as assigned) | | | |
| Management approval (as required by AIMS) | | | |

**Acknowledgement (author):**  
I confirm this draft reflects the current intended design and known controls for T4L advisory grading as of the date above. Dates are real. Gaps are listed rather than hidden.

**Next review trigger (whichever first):**
- Completion of AI Risk Assessment Worksheet for this system
- Material model / prompt / rubric change
- First production incident involving unfair grade or privacy concern
- Monthly AIMS review cycle

---

## Appendix A — Quick reference (for auditors / AIMS chat)

**One-sentence system statement:**  
T4L grading uses Gemini to produce an advisory rubric score on learner submissions; partners must accept, edit, or reject with timed review evidence before outcomes are treated as human-final, and AI never awards programme points alone.

**Plan–Do–Check–Improve mapping (this system):**
- **Plan:** this impact assessment + risk worksheet + policy awareness
- **Do:** build/run advisory grading with HITL gate
- **Check:** HITL CSV / monthly Accept–Edit–Reject and score-delta review
- **Improve:** rubric/prompt/process changes logged with real dates

**Primary product references:**
- Partner review: `src/pages/partner/ProgrammeSubmissionsPage.tsx`
- HITL metrics/export: `src/utils/programmeAiHitl.ts`
- Learner explain/dispute: `src/components/courses/LearnerAiExplainPanel.tsx`
- Grading function: `supabase/functions/grade-submission/`

---

*End of DRAFT — AI System Impact Assessment — T4L grading*
