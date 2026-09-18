# Section 5 Data and Model Record

Document status: DRAFT  
Document ID: DATA-T4L-001 (working draft - align with AIMS register when assigned)  
Drive folder: 05 Data Records  
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
- Baseline HITL export: docs/aims/evidence/hitl/20260917-065134/

Filing: label DRAFT; store under Drive 05 Data Records / T4L-grading/. Do not backdate.

---

## 0. Document control

| Field | Value |
|-------|--------|
| Document type | AI data and model record |
| Purpose | Inventory data used by T4L grading, where it flows, who can access it, and which model/provider is in use |
| Scope | T4L advisory grading only |
| Out of scope | Oil Lab, anomaly detection, Celo, AI governance agent, LIFT assessment engine, general staff ChatGPT use |
| Visuals | Plain text tables only in this draft (optional one-page flow can be added later; no ERD required) |
| Testing | No dedicated test suite. Field existence is already evidenced by HITL CSV / hitl_gate_test.py |
| Honesty rule | Real dates only. Gaps listed openly |

---

## 1. System data summary

T4L grading stores learner submission text in Supabase, sends content needed for scoring to Google Gemini via a server-side Edge Function, writes an advisory ai_grade back to the same row, and keeps partner HITL decision fields for audit.

Simple flow (text only):

1. Learner submits answers on app.t4leader.com  
2. Row saved in programme_component_submissions  
3. Webhook / Edge Function grade-submission calls Gemini with rubric + answers  
4. ai_grade written to the row (advisory)  
5. Partner reviews in Programme submissions; accept / edit / reject and scores saved  
6. HITL export / monitoring reads the same fields  

---

## 2. Data inventory

### 2.1 Primary store

| Item | Detail |
|------|--------|
| System | Supabase (PostgreSQL) |
| Table | public.programme_component_submissions |
| App | https://app.t4leader.com |
| Access control | Supabase Auth + Row Level Security (partners/admins for org scope; learners for own rows as designed) |

### 2.2 Input data (into the AI path)

| Data element | Description | Sensitivity | Source |
|--------------|-------------|-------------|--------|
| answers (jsonb) | Learner written responses to programme / podcast prompts | Tier 3 - learner / client content | Learner submission |
| component_id / component_type / component_title | Which artefact is being graded | Low-Medium | Platform catalogue |
| Rubric text | Scoring criteria matched by component_id | Internal | grade-submission rubrics |
| user_id | Learner identity key | Personal | Auth / profile |
| organization_id | Org context for partner review | Internal / client | Membership |

### 2.3 Output data (from the AI path)

| Data element | Description | Sensitivity |
|--------------|-------------|-------------|
| ai_grade.status | pending / completed / error | Operational |
| ai_grade.score / ai_score_50 | Advisory numeric score | Operational (affects learner experience if shown) |
| ai_grade.pass | Advisory pass signal (where used) | Operational |
| ai_grade.feedback / feedback_for_partner | Model-written comments | May reflect learner content |
| ai_grade.model | Model id string | Operational |
| ai_grade.graded_at | When graded | Operational |
| ai_grade.error | Error message if failed | Operational |

### 2.4 Human gate / audit data (not model outputs, but part of the record)

| Data element | Description |
|--------------|-------------|
| ai_decision | accept / edit / reject |
| ai_decision_at | Decision timestamp |
| criteria_acknowledged / criteria_acknowledged_at | Criteria-first control |
| review_opened_at / review_duration_ms | Dwell evidence |
| score / partner_score_50 / final_score | Human scoring |
| reviewed_by / reviewer_name / reviewed_at | Attribution |
| partner_notes | Reviewer comments |
| status | submitted / in_review / approved / needs_revision |
| learner_disputed_at / learner_dispute_note | Learner dispute path |

### 2.5 Related profile data (not stored in submission row, but may be joined for display)

| Data element | Where | Use |
|--------------|-------|-----|
| email, full name | profiles | Partner list display / CSV learner columns when resolved |

---

## 3. Data classification (AIMS AI-use tiers)

| Tier | Examples in this system | Rule |
|------|-------------------------|------|
| Tier 1 Open / public | Public marketing copy about T4L (not submission content) | Low restriction |
| Tier 2 Company confidential | Internal rubrics, operational metrics, proposals about the system | Not for free consumer AI accounts |
| Tier 3 Client / learner data | answers text, feedback that quotes answers, org-linked identity | Only via approved platform path (Gemini through Edge Function). No paste into unapproved consumer tools |

Default for T4L grading content: treat submission answers and model feedback as Tier 3.

---

## 4. Lawful use and purpose limitation

| Topic | Statement |
|-------|-----------|
| Purpose | Grade and review programme learning evidence; support partners; produce HITL audit evidence |
| Not for | Training unrelated public models outside the contracted provider path; marketing lists; staff experimentation in personal AI accounts |
| Human finality | AI outputs are advisory; human gate governs final programme outcomes where partner review applies |
| Points | AI does not award programme points alone |

Privacy statutes that may apply depending on client location (e.g. POPIA, GDPR) must be considered for Tier 3 processing. Client-specific DPAs sit outside this form but should be linked when available.

---

## 5. Access and sharing

| Who | Access | Notes |
|-----|--------|-------|
| Learner | Own submissions; may see AI explanation | Dispute path if partner delayed |
| Partner reviewer | Submissions for assigned organisations | Operates HITL gate |
| Super-admin / delivery | Broader ops access as per platform roles | Evidence export / support |
| Google (Gemini API) | Receives content required to grade during API call | Supplier / processor |
| Staff personal AI tools | Not authorised for Tier 3 submission paste | REG 009 approved tools only |

Service role is used only on the server grading path as designed. The browser uses the anon key with RLS. Do not put service_role in frontend env files.

---

## 6. Retention and deletion (working position)

| Record | Working position | Confirm with |
|--------|------------------|--------------|
| programme_component_submissions rows | Retained for programme delivery, audit, and AIMS evidence while the org relationship / certification need remains | Platform privacy policy + AIMS coordinator |
| HITL CSV exports / monitoring notes | Keep for AIMS cycle (Stage 1 readiness through surveillance guidance) | MON-T4L-001 |
| Model provider logs | Per Google Gemini / Google Cloud terms | Supplier docs when REG 009 filed |

Open action: confirm exact retention periods in writing with privacy / AIMS lead (do not invent years).

---

## 7. Model and tool record

| Field | Value |
|-------|--------|
| Tool / model name | Google Gemini |
| Current configured model id | gemini-3-flash-preview |
| How invoked | Supabase Edge Function grade-submission |
| Secret | GEMINI_API_KEY in Supabase secrets (not in client) |
| Role of model | Advisory rubric scoring and feedback |
| Human oversight | Mandatory accept / edit / reject when AI grade exists (GATE-T4L-001) |
| Change control | Model / prompt / rubric changes must be dated; trigger monitoring check and risk revisit |
| Approved tools register | List on REG 009 when circulated (open action) |

### 7.1 Change log (start honest)

| Date | Change | By |
|------|--------|-----|
| 17 September 2026 | Data and model record draft created for AIMS pack | Syntiche |
| (prior) | Advisory grading + HITL fields shipped in product (see migrations 0096-0098 and AI grading columns) | Engineering |
| TBD | Formal REG 009 entry for Gemini | Open |

Do not backfill fake older AIMS data-record dates.

---

## 8. Security controls (summary)

| Control | Detail |
|---------|--------|
| Transport | HTTPS to app and Supabase / Gemini endpoints |
| Auth | Supabase Auth |
| Authorisation | RLS on submissions |
| Secrets | API key server-side only |
| Advisory design | AI cannot alone finalise points / status |
| Audit fields | HITL decision, dwell, criteria ack |
| Export hygiene | Prefer test orgs / blur identities in screenshots when sharing externally |

---

## 9. Optional visual (not included in this draft)

If AIMS later asks for a picture, one page is enough:

Learner submit -> Supabase row -> grade-submission -> Gemini -> ai_grade -> Partner HITL -> CSV / monitoring

No entity-relationship diagram is required for this record.

---

## 10. Evidence already available (no new tests required)

| Evidence | Location | Proves |
|----------|----------|--------|
| HITL CSV columns | docs/aims/evidence/hitl/20260917-065134/T4L-HITL-export.csv | Data fields exist and export |
| Auto report | same folder | Monitoring can read the record |
| Gate control | GATE-T4L-001 | How human decisions attach to data |
| Code / migrations | supabase/migrations and grade-submission | Schema and model path |

No additional testing script is required for Section 5 beyond reusing the monthly export.

---

## 11. Open actions

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Confirm retention periods with privacy / AIMS lead | Syntiche + coordinator | Open |
| 2 | Add Gemini grading path to REG 009 when shared | Syntiche / Ayako | Open |
| 3 | Link any client DPA / POPIA-GDPR notes for major clients using grading | Delivery | Open |
| 4 | Date the next model id change in Section 7.1 when it happens | Syntiche | Open |

---

## 12. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / System owner | Syntiche Musawu | | 17 September 2026 |
| AIMS coordinator review | | | |
| Management acknowledgement | | | |

Author acknowledgement:  
I confirm this draft inventories T4L grading data and the Gemini model path as currently designed, uses real dates, and does not claim retention or REG 009 entries that are not yet confirmed.

Next review: when REG 009 is filed, when the model id changes, or within one month, whichever is sooner.

---

## Appendix A - Auditor quick path

1. Read data inventory (Section 2) and model record (Section 7).  
2. Open one HITL CSV and confirm key columns exist.  
3. Confirm Tier 3 handling rule and no service_role in frontend.  
4. Ask for REG 009 listing when available.  
5. Confirm retention open action status.

One-sentence statement:  
T4L grading processes learner submission text in Supabase, sends it to Gemini for advisory scoring only, returns ai_grade to the same record, and keeps human HITL fields for audit under partner-scoped access.

---

End of DRAFT - Section 5 Data and Model Record - T4L grading
