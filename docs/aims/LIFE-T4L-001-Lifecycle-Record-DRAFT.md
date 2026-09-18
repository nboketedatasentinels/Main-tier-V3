# Section 6 Lifecycle Record

Document status: DRAFT  
Document ID: LIFE-T4L-001 (working draft - align with AIMS register when assigned)  
Drive folder: 06 Lifecycle  
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
- Gate test scripts: docs/aims/HITL-S3-Gate-Testing-Scripts-T4L-Grading-DRAFT.md
- Baseline evidence: docs/aims/evidence/hitl/20260917-065134/

Filing: label DRAFT; store under Drive 06 Lifecycle / T4L-grading/. Do not backdate.

---

## 0. Document control

| Field | Value |
|-------|--------|
| Document type | AI system lifecycle record |
| Purpose | Show where T4L grading sits in its life (design to live to change to retire), what must be true before go-live of controls, and what triggers reassessment |
| Scope | T4L advisory grading only |
| Out of scope | Oil Lab, anomaly detection, Celo, AI governance agent, LIFT scoring engine |
| UI / screenshots | Not in this text draft. See Section 9 for where to add UI evidence later |
| Honesty rule | Real dates only. AIMS formal baseline treated as August/September 2026. Do not invent a longer certified history |

---

## 1. Why lifecycle matters

AIMS expects AI systems to be governed across time, not only described once. Lifecycle records show:

1. What stage the system is in  
2. What was required before treating controls as live  
3. What changes force Impact / Risk / Gate / Monitoring / Data updates  
4. How retirement would be handled if the capability is withdrawn  

Plan-Do-Check-Improve continues for as long as the system runs.

---

## 2. Current lifecycle stage

| Field | Value |
|-------|--------|
| Current stage | Build / pilot with production use of advisory grading |
| Application | https://app.t4leader.com |
| Model in use | Google Gemini (gemini-3-flash-preview) via grade-submission |
| Human gate | Designed and implemented (accept / edit / reject, criteria, 25s Accept dwell) |
| AIMS documentation pack (T4L grading) | Sections 1-5 drafted; Section 6 this draft |
| Operating HITL evidence (UI Accept/Edit/Reject pack) | Partial - baseline auto export done; full UI annex still open |
| Formal monthly monitoring note | Not yet filed |

Stage label for AIMS chat: Pilot / controlled live - documentation in progress, not claiming full Stage 1 ready until open actions close.

---

## 3. Lifecycle stages (standard for this system)

| Stage | Meaning for T4L grading | Exit criteria (summary) |
|-------|-------------------------|-------------------------|
| A. Concept / design | Decide advisory grading + human gate | Purpose and non-goals written |
| B. Build | Edge Function, rubrics, UI HITL fields | Code in production path; advisory-only rule held |
| C. Pilot / controlled live | Real orgs use grading with gate | Impact + Risk drafted; Gate defined; export works |
| D. Operate | Steady monthly Check + Improve | Monthly monitoring notes filed; gate evidence samples exist |
| E. Change | Model, prompt, rubric, or gate UI change | Dated change log + re-check monitoring within 7 days |
| F. Retire / replace | Stop Gemini grading or replace model | Communication, manual path confirmed, records retained |

We are in Stage C moving toward Stage D.

---

## 4. Pre-go-live / control checklist (AIMS)

Before calling the governance pack audit-ready for Stage 1 readiness, complete:

| # | Requirement | Linked doc | Status |
|---|-------------|------------|--------|
| 1 | Impact assessment drafted and filed | FRM001 / 01 Impact | Done (draft filed) |
| 2 | Risk assessment drafted and filed | PR003 / 02 Risk | Done (draft filed) |
| 3 | Gate / HITL control defined and filed | GATE-T4L-001 / 04 Gate | Done (draft filed) |
| 4 | Baseline export evidence filed | Gate folder CSV + PNG | Done (baseline) |
| 5 | Monitoring plan drafted and filed | MON-T4L-001 / 03 Monitoring | Done (draft filed) |
| 6 | Data and model record drafted and filed | DATA-T4L-001 / 05 Data | Done (draft filed) |
| 7 | Lifecycle record drafted and filed | This doc / 06 Lifecycle | In progress (this draft) |
| 8 | UI Accept / Edit / Reject evidence annexed | Gate Section 9 annex A3-A7 | Open - add later (Section 9) |
| 9 | First monthly monitoring note | MON-T4L-001 template | Open |
| 10 | Partner awaiting-human SLA decided | Risk R-T4L-04 | Open |
| 11 | Gemini on REG 009 | Data Section 7 | Open |
| 12 | Sign-offs (not DRAFT only) | All forms | Open |

Items 1-7 are the text pack. Items 8-12 are operating / approval close-out.

---

## 5. Change management triggers

Update Impact, Risk, Gate, Monitoring, and/or Data (with real dates) when any of these happen:

| Trigger | Minimum updates |
|---------|-----------------|
| Model id change (e.g. new Gemini version) | Data Section 7.1; Monitoring extra check; Risk revisit if behaviour shifts |
| Prompt or rubric change | Data change log; Monitoring; Risk if scoring fairness affected |
| Gate UI change (dwell, criteria, accept/edit/reject) | Gate control; re-run HITL tests; Monitoring thresholds |
| AI starts awarding points or changing status alone | Stop; treat as control breach; full reassessment |
| New organisation / high-stakes client using grading | Confirm Tier 3 handling; link DPA if required |
| Decision to retire grading | Section 7 retirement steps |

Never backdate change log entries.

### 5.1 Change log (start)

| Date | Event | Notes |
|------|-------|-------|
| 17 September 2026 | Lifecycle record draft created | AIMS pack for T4L grading |
| 17 September 2026 | Baseline HITL auto export | docs/aims/evidence/hitl/20260917-065134/ |
| (product history) | Advisory grading + HITL fields shipped | See migrations / grade-submission; not backdated as AIMS ops |
| TBD | First UI Accept/Edit/Reject annex | See Section 9 |
| TBD | First monthly monitoring note | MON-T4L-001 |

---

## 6. Roles across the lifecycle

| Role | Lifecycle duty |
|------|----------------|
| System owner (Syntiche) | Keeps this record current; owns change log dates |
| Partners | Operate gate in live use |
| AIMS coordinator | Files lifecycle updates; readiness tracking |
| Management | Approves go-live of claims / Stage 1 readiness position |
| Independent reviewer | Samples lifecycle + monitoring at readiness review |

---

## 7. Retirement / replacement (if needed later)

If T4L stops using Gemini advisory grading:

1. Turn off webhook / function or feature flag grading path  
2. Confirm partners can score manually  
3. Notify affected partners  
4. Keep submissions + HITL history for audit retention  
5. Update Impact / Risk / Gate / Data / Monitoring to Retired with real date  
6. Remove or mark REG 009 entry accordingly  

No retirement is planned as of 17 September 2026.

---

## 8. Link to Plan-Do-Check-Improve

| Stage | Where it lives |
|-------|----------------|
| Plan | Impact + Risk + this lifecycle checklist |
| Do | Build/run grading + Gate HITL procedure |
| Check | Monitoring plan + monthly notes + HITL export |
| Improve | Change log + threshold responses + retests |

Certification needs this loop visible over months, not a one-off folder dump.

---

## 9. Where to add UI later (do this when ready)

UI screenshots are not part of this lifecycle text file. Add them here:

Drive path:  
04 Records and Evidence / 04 Gate Records / Gate : HITL Control Record /

(or a subfolder such as 2026-MM-DD-hitl-ui/)

| Annex | What to capture | Maps to |
|-------|-----------------|---------|
| A3 | Criteria blocked, then acknowledged | S02 |
| A4 | Accept blocked before 25s dwell | S03 |
| A5 | Accept after dwell saved | S04 |
| A6 | Edit with different human score | S05 |
| A7 | Reject saved | S06 |
| A8 | Learner explain + dispute (optional) | S09 |
| A9 | Points not awarded by AI alone (before/after) | S10 |

Also keep / refresh:  
- T4L-HITL-auto-baseline PNG  
- T4L-HITL-export.csv  
- GATE-T4L-001 PDF  

After UI annexes are uploaded, add one line to Section 5.1 change log with the real date, and tick checklist item 8 in Section 4.

Do not put UI screenshots in 06 Lifecycle unless AIMS asks. Lifecycle stays the stage / change / retirement record. Gate folder holds HITL visuals.

---

## 10. Open actions

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | File this lifecycle draft in Drive 06 Lifecycle | Syntiche | Open |
| 2 | Add UI annexes to Gate folder (Section 9) | Syntiche / partner | Open |
| 3 | File first monthly monitoring note | Syntiche | Open |
| 4 | Decide awaiting-human SLA | Delivery + Syntiche | Open |
| 5 | REG 009 Gemini listing | Syntiche / Ayako | Open |
| 6 | Collect sign-offs on Sections 1-6 | Owners + management | Open |

---

## 11. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / System owner | Syntiche Musawu | | 17 September 2026 |
| AIMS coordinator review | | | |
| Management acknowledgement | | | |

Author acknowledgement:  
I confirm this lifecycle draft matches the T4L grading pack, uses real dates, records Stage C (pilot / controlled live) honestly, and points UI evidence to the Gate folder rather than claiming it is complete here.

Next review: when UI annex is filed, or within one month, whichever is sooner.

---

## Appendix A - Auditor quick path

1. Read current stage (Section 2) and checklist (Section 4).  
2. Confirm Sections 1-5 exist in Drive.  
3. Ask where UI annexes live (Section 9 -> Gate folder).  
4. Check change log dates are real.  
5. Confirm monthly Check has started or is listed open.

One-sentence statement:  
T4L grading is in pilot / controlled live with advisory Gemini scoring and a defined human gate; AIMS text packs for Impact through Data are drafted, lifecycle is tracked here, and UI HITL screenshots belong in Gate Records when captured.

---

End of DRAFT - Section 6 Lifecycle Record - T4L grading
