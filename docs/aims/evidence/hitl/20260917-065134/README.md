# T4L grading — §3 Gate / HITL evidence pack (baseline)

**Upload this whole folder to one place only:**  
Google Drive → AIMS shared area → **`04 Gate Records`** → `T4L-grading` → `2026-09-17-baseline/`

Shared finals parent (from Chuulu):  
https://drive.google.com/drive/folders/1pBCJ8jCiqXboJQC1LPIfFmubZkxDT62C  
→ use the **`04 Gate Records`** folder inside that structure (from Ayakwa’s 6-folder share).

---

## What this pack is

| Field | Value |
|-------|--------|
| System | T4L Programme & Podcast Advisory Grading |
| AIMS section | **§3 Gate / HITL** (not Impact, not Risk) |
| Evidence type | Baseline **auto** gate check (terminal + CSV + report) |
| Date (real) | 17 September 2026 |
| Environment | Production (`app.t4leader.com` data via Supabase) |
| Tester / runner | Syntiche (script run as partner `nbokete@data-sentinels.com`) |
| Linked control doc | `GATE-T4L-001-HITL-Control-Record-DRAFT.md` |
| Linked tests | `HITL-S3-Gate-Testing-Scripts-T4L-Grading-DRAFT.md` |
| Linked risks | R-T4L-01, R-T4L-03, R-T4L-04 (see PR003) |

---

## Files to put in the Drive folder

| File | What it is |
|------|------------|
| `README.md` (this file) | Explanations for the auditor / AIMS reviewer |
| `T4L-HITL-auto-baseline-20260917.png` | Terminal screenshot of `--auto` run |
| `T4L-HITL-export.csv` | Machine-readable HITL fields export |
| `HITL-auto-report-20260917-065136.md` | Auto PASS/SKIP/FAIL summary |

Local copies already exist at:  
`docs/aims/evidence/hitl/20260917-065134/`

---

## How to read the terminal screenshot (plain English)

We ran: `python3 scripts/aims/hitl_gate_test.py --auto`

That script logs in as a partner, reads programme submissions, and checks whether Human-in-the-Loop evidence exists.

| Result | Meaning |
|--------|---------|
| **S01 PASS** | AI graded 3 submissions. They are still waiting for a human decision. Good — AI advises, does not finalise alone. |
| **S02 FAIL / later SKIP** | No Accept/Edit/Reject yet, so criteria-on-decision cannot pass. **Expected** at baseline. |
| **S03–S06 SKIP** | Need UI: Accept (with 25s wait), Edit, Reject. Not done yet. |
| **S07 PASS** | We can export HITL evidence (CSV). Important for audits / monitoring. |
| **S08–S09 SKIP** | Optional paths (AI error manual score; learner dispute) — not exercised yet. |
| **S10 note** | One older row is `approved` by a human **without** the newer `ai_decision` field. Logged honestly as a **legacy gap**, not “AI approved by itself.” |

**Bottom line for AIMS:**  
This pack proves the **gate design is testable** and **advisory AI + export work**. It does **not** yet prove full operating HITL (Accept/Edit/Reject + dwell). That comes in the next evidence pack after UI runs.

---

## Consistency check (screenshot quality)

| Check | Status |
|-------|--------|
| Shows command + dateable evidence folder path | Yes |
| Shows partner identity used for the run | Yes |
| Shows PASS/SKIP/FAIL clearly | Yes |
| Cropped black / empty image | **Do not upload** — not usable evidence |
| Claims “full HITL complete” | **No** — do not write that; baseline only |

---

## What NOT to put here

- Do not upload this under **01 Impact** or **02 Risk** (wrong folder).  
- Do not mix Oil Lab / Celo / governance-agent evidence in this folder.  
- Do not backdate filenames.

---

## Next pack (later)

After UI Accept / Edit / Reject screenshots exist, create:  
`04 Gate Records / T4L-grading / 2026-MM-DD-hitl-ui/`  
and attach annexes A3–A7 from GATE-T4L-001 §9.

---

*End — upload cover note for §3 baseline evidence*
