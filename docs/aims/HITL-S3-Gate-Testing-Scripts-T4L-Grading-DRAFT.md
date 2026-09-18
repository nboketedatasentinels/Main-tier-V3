# §3 Gate / HITL — Testing scripts (T4L grading)

**Document status:** DRAFT  
**Purpose:** Runnable test scripts to produce **dated screenshot + export evidence** that human-in-the-loop is real (not rubber-stamping).  
**System:** T4L Programme & Podcast Advisory Grading  
**Related:** FRM001 Impact · PR003 Risk (R-T4L-01, R-T4L-03, R-T4L-04)  
**Date:** 16 September 2026  
**Owner:** Syntiche Musawu  

**Where to run:** Production `https://app.t4leader.com` (or staging if you use it — note which in every screenshot filename).  
**Partner page:** Programme submissions (partner portal).  
**Evidence folder (suggested):** Drive `04 Gate Records` → `T4L-grading/` → `YYYY-MM-DD/`

---

## 0. How to capture evidence (do this every run)

1. Use **real clock dates** — never backdate filenames or forms.  
2. Screenshot naming:

```text
T4L-HITL-S##-<short-result>-YYYYMMDD-HHmm.png
```

Example: `T4L-HITL-S03-accept-blocked-dwell-20260916-1655.png`

3. Keep a one-line log in `HITL-test-log-YYYYMMDD.md` with: script ID, pass/fail, screenshot names, tester name.  
4. Prefer a **test learner org** you control — do not use real client sensitive content in screenshots if avoidable (blur names/emails if needed).  
5. Include URL bar + visible date/time in OS menu bar when possible.

### Roles needed

| Role | Account |
|------|---------|
| Learner | Can submit a programme / podcast artefact |
| Partner | Assigned to that learner’s organisation; can open Programme submissions |
| (Optional) Admin | Only if you need to confirm DB fields / webhook |

### Preconditions (once)

- [ ] Gemini grading path is live (submission gets `ai_grade` within a few minutes)  
- [ ] Partner is assigned to the org  
- [ ] You can open **Programme submissions** and see **Export AI vs human CSV**  
- [ ] Browser clock is correct  

If AI never grades: still run **S08** (manual path) and log grading outage as evidence for R-T4L-07.

---

## Script pack overview

| ID | Script | Proves | Must screenshot |
|----|--------|--------|-----------------|
| S01 | Advisory AI grade lands | AI advises; status/points not auto-final | List + AI completed state |
| S02 | Criteria before decision | Criteria-first gate | Criteria panel + disabled decisions |
| S03 | Accept blocked by dwell | Anti-rubber-stamp (25s) | Accept disabled + timer/wait copy |
| S04 | Accept after dwell | Genuine accept path | Accept enabled → saved Accepted |
| S05 | Edit AI score | Human can override | Edit + different score saved |
| S06 | Reject AI | Human can refuse AI | Reject saved |
| S07 | HITL dashboard + CSV | Aggregate evidence + drift export | Stats strip + CSV open in Sheets |
| S08 | AI error / manual score | Human fallback | Error or no-AI + manual save |
| S09 | Learner explain + dispute | Delayed-human path | Learner panel + dispute → needs revision |
| S10 | Points not AI-awarded | AI never awards points alone | Points/status unchanged until partner save |

**Minimum for first evidence pack:** S01–S07 + S10. Add S08–S09 when you can.

---

## S01 — Advisory AI grade lands (no silent finalisation)

**Goal:** Show submission is AI-graded but still awaits human.

### Steps
1. As **learner**, submit an eligible programme artefact (or podcast grade path).  
2. Wait until AI grading completes (refresh if needed).  
3. As **partner**, open **Programme submissions**.  
4. Find the row: AI graded / awaiting human (no accept/edit/reject yet).  
5. Open the submission drawer.  
6. Confirm status is not auto-approved solely by AI; points not awarded by AI alone.

### Expected
- `ai_grade` completed (score/feedback visible after gate rules allow).  
- Human decision still **pending**.  
- Copy on page states AI never awards points alone.

### Screenshots
- `S01-list-awaiting-human`  
- `S01-drawer-ai-pending-decision`  

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## S02 — Criteria acknowledgement before AI decision

**Goal:** Partner cannot decide on AI until criteria are acknowledged.

### Steps
1. Open an AI-completed submission with **no** prior `aiDecision`.  
2. Observe criteria section (open by default).  
3. Attempt to choose Accept / Edit / Reject **before** acknowledging criteria.  
4. Acknowledge criteria (checkbox / required ack control).  
5. Confirm decision controls become available (Accept still may wait for dwell — see S03).

### Expected
- Decisions blocked until criteria acknowledged.  
- After ack, `criteria_acknowledged` path enabled.

### Screenshots
- `S02-criteria-required-decisions-blocked`  
- `S02-criteria-acknowledged`  

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## S03 — Accept blocked until 25s dwell

**Goal:** Prove anti-rubber-stamp control.

### Steps
1. Open AI-completed submission; acknowledge criteria.  
2. Immediately try **Accept** (within first few seconds).  
3. Note wait messaging / disabled Accept (`ACCEPT_MIN_DWELL_SEC = 25`).  
4. Stay in drawer; watch dwell progress if shown.  
5. Do **not** save yet — screenshot the blocked state.

### Expected
- Accept not allowed until ~25 seconds in the review drawer (unless a prior decision already exists).  
- Toast/copy explains minimum review time if user tries early.

### Screenshots
- `S03-accept-blocked-dwell` (show timer or wait seconds if visible)  

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## S04 — Accept after dwell (happy path)

**Goal:** Record a real Accept with dwell evidence.

### Steps
1. Continue from S03 (or reopen; if already decided, use a **fresh** submission).  
2. Wait ≥ 25 seconds in drawer with criteria acknowledged.  
3. Select **Accept**.  
4. Save.  
5. Return to list; confirm decision shows **Accepted**.  
6. Confirm HITL stats **Accepted** count increased (if visible).

### Expected
- Decision `accept` saved with timestamp.  
- Review duration / dwell captured for export.

### Screenshots
- `S04-accept-enabled-after-dwell`  
- `S04-saved-accepted-on-list`  

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## S05 — Edit AI estimate (human override)

**Goal:** Human can change the score (not forced to AI).

### Steps
1. Open a **new** AI-completed submission (or one without final AI decision).  
2. Acknowledge criteria; wait dwell if you will touch Accept controls as required by UI.  
3. Choose **Edit**.  
4. Enter a **different** human score than the AI overall (write both numbers in the log).  
5. Save.  
6. Confirm list/drawer shows **Edited** and human score.

### Expected
- `ai_decision = edit`  
- Human score ≠ AI score (demonstrate override)  
- Score delta available later in CSV

### Screenshots
- `S05-edit-score-entry` (AI vs human numbers visible if UI shows both)  
- `S05-saved-edited`  

### Log line
- AI score: ____ · Human score: ____ · Delta: ____

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## S06 — Reject AI estimate

**Goal:** Human can refuse the AI estimate.

### Steps
1. Open a fresh AI-completed submission.  
2. Acknowledge criteria; satisfy any dwell rules the UI enforces for the action you take.  
3. Choose **Reject**.  
4. Set appropriate status (e.g. needs revision) per UI.  
5. Save.  
6. Confirm **Rejected** on list / HITL stats.

### Expected
- `ai_decision = reject` dated  
- Learner path can move to revision as designed

### Screenshots
- `S06-reject-selected`  
- `S06-saved-rejected`  

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## S07 — HITL evidence strip + CSV export

**Goal:** Aggregate proof for monitoring / auditors.

### Steps
1. On Programme submissions, scroll to **Human-in-the-loop evidence**.  
2. Screenshot stats: AI graded, Awaiting human, Accepted, Edited, Rejected, Criteria checked, dwell samples / Δ score.  
3. Click **Export AI vs human CSV**.  
4. Open CSV; screenshot columns including:  
   `ai_score`, `human_decision`, `human_score`, `score_delta_human_minus_ai`, `criteria_acknowledged`, `review_duration_ms`, `ai_model`, timestamps.  
5. Store CSV beside screenshots: `T4L-HITL-export-YYYYMMDD.csv`

### Expected
- Stats reflect S04–S06 work.  
- CSV contains dwell + decision + delta fields.

### Screenshots
- `S07-hitl-stats-strip`  
- `S07-csv-columns`  

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## S08 — AI failure → manual human score still works

**Goal:** Supplier/AI outage does not block human gate.

### Steps
1. Find a submission with `ai_grade` error **or** force a case with no completed AI grade (if available in your environment).  
2. As partner, open drawer.  
3. Score / set status manually.  
4. Save without relying on Accept of AI.

### Expected
- UI allows manual review.  
- No hard dependency on Gemini for partner decision.

### Screenshots
- `S08-ai-error-or-absent`  
- `S08-manual-save-success`  

### Pass / Fail
- [ ] Pass  
- [ ] Fail / N/A — notes: _______________

---

## S09 — Learner “explain itself” + dispute (delayed human)

**Goal:** Evidence for R-T4L-04 fallback.

### Steps
1. As learner, open a submission that is AI-completed but **partner not yet decided**.  
2. Screenshot **AI ESTIMATE (EXPLAIN ITSELF)** panel (score/pass/feedback + “Awaiting partner”).  
3. Enter optional dispute note; click request human review / dispute.  
4. Confirm status moves toward **needs_revision** (or equivalent).  
5. As partner, confirm item appears needing attention.

### Expected
- Learner sees explanation.  
- Dispute creates dated human-request path.

### Screenshots
- `S09-learner-explain-panel`  
- `S09-after-dispute-needs-revision`  

### Pass / Fail
- [ ] Pass  
- [ ] Fail / N/A — notes: _______________

---

## S10 — AI does not award programme points alone

**Goal:** Core design control for R-T4L-03.

### Steps
1. After S01 (AI complete, **before** partner save), check learner points / submission status that would indicate points awarded.  
2. Confirm no programme points granted solely from `ai_grade`.  
3. Complete partner Accept/Edit (S04 or S05) under normal points rules.  
4. Only then check whether points/status update per **partner / checklist rules** (not AI).

### Expected
- Pre-human: AI score exists; points not AI-awarded.  
- Post-human: any points follow existing non-AI award path.

### Screenshots
- `S10-before-human-no-ai-points`  
- `S10-after-partner-decision` (annotate what awarded points, if any)

### Pass / Fail
- [ ] Pass  
- [ ] Fail — notes: _______________

---

## Suggested run order (one sitting)

```text
S01 → S02 → S03 → S04 → S05 → S06 → S07 → S10 → (S09) → (S08)
```

Allow ~45–60 minutes including waits for Gemini and 25s dwells (you need **3 fresh AI-graded submissions** ideally: Accept, Edit, Reject).

---

## Run log template (copy per session)

```text
Date (real): _______________
Environment: production / staging
Tester: _______________
Partner account: _______________
Learner account / org: _______________

S01 __  screenshots: 
S02 __  screenshots: 
S03 __  screenshots: 
S04 __  screenshots: 
S05 __  AI: __ Human: __ screenshots: 
S06 __  screenshots: 
S07 __  csv: _______________ screenshots: 
S08 __  screenshots: 
S09 __  screenshots: 
S10 __  screenshots: 

Gaps / bugs found:
1.
2.

Signed: _______________  Time: _______________
```

---

## Map to AIMS evidence chain

| Script | Risk IDs | Gate record use |
|--------|----------|-----------------|
| S01, S10 | R-T4L-03 | AI advisory only |
| S02, S03, S04 | R-T4L-01 | Real HITL / anti-rubber-stamp |
| S05, S06 | R-T4L-01, R-T4L-02 | Human override |
| S07 | R-T4L-01, R-T4L-06 | Monitoring feed |
| S08 | R-T4L-07 | Supplier fallback |
| S09 | R-T4L-04 | Delayed human path |

---

*End — §3 Gate / HITL testing scripts (T4L grading)*
