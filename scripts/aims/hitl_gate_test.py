#!/usr/bin/env python3
"""
AIMS §3 Gate / HITL — runnable terminal test script (T4L grading)

What it does:
  1) --auto   : logs into Supabase, pulls programme_component_submissions,
                asserts advisory-only + HITL field evidence, writes CSV + report
  2) --guided : walks S01–S10 in the terminal; you take screenshots when prompted
  3) --all    : auto then guided

Setup (once):
  python3 -m venv .venv-aims
  source .venv-aims/bin/activate
  pip install -r scripts/aims/requirements.txt

Env (from repo .env or export):
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  AIMS_PARTNER_EMAIL      # partner who can read org submissions
  AIMS_PARTNER_PASSWORD
  VITE_APP_BASE_URL       # optional, default https://app.t4leader.com

Examples:
  python3 scripts/aims/hitl_gate_test.py --auto
  python3 scripts/aims/hitl_gate_test.py --guided
  python3 scripts/aims/hitl_gate_test.py --all
  python3 scripts/aims/hitl_gate_test.py --auto --org-id <uuid>
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Optional deps
# ---------------------------------------------------------------------------

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None  # type: ignore

try:
    from supabase import create_client, Client
except ImportError:  # pragma: no cover
    create_client = None  # type: ignore
    Client = Any  # type: ignore


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "docs" / "aims" / "evidence" / "hitl"
APP_DEFAULT = "https://app.t4leader.com"
PARTNER_SUBMISSIONS_PATH = "/partner/programme-submissions"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def stamp() -> str:
    return utc_now().strftime("%Y%m%d-%H%M%S")


def load_env() -> None:
    if load_dotenv:
        env_path = ROOT / ".env"
        if env_path.exists():
            load_dotenv(env_path)
        load_dotenv()


def require_env(*keys: str) -> dict[str, str]:
    missing = [k for k in keys if not os.getenv(k)]
    if missing:
        sys.exit(
            "Missing env vars: "
            + ", ".join(missing)
            + "\nSet them in .env or export them, then re-run."
        )
    return {k: os.environ[k] for k in keys}


def ai_status(row: dict[str, Any]) -> str | None:
    grade = row.get("ai_grade")
    if isinstance(grade, str):
        try:
            grade = json.loads(grade)
        except json.JSONDecodeError:
            return None
    if not isinstance(grade, dict):
        return None
    status = grade.get("status")
    return str(status) if status is not None else None


def ai_score(row: dict[str, Any]) -> float | None:
    grade = row.get("ai_grade")
    if isinstance(grade, str):
        try:
            grade = json.loads(grade)
        except json.JSONDecodeError:
            return None
    if not isinstance(grade, dict):
        return None
    score = grade.get("score")
    try:
        return float(score) if score is not None else None
    except (TypeError, ValueError):
        return None


def ai_model(row: dict[str, Any]) -> str | None:
    grade = row.get("ai_grade")
    if isinstance(grade, str):
        try:
            grade = json.loads(grade)
        except json.JSONDecodeError:
            return None
    if not isinstance(grade, dict):
        return None
    model = grade.get("model")
    return str(model) if model else None


@dataclass
class CheckResult:
    script_id: str
    title: str
    passed: bool | None  # None = skipped / needs UI
    detail: str
    evidence: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

def connect() -> Client:
    if create_client is None:
        sys.exit(
            "Package 'supabase' not installed.\n"
            "Run:\n"
            "  python3 -m venv .venv-aims && source .venv-aims/bin/activate\n"
            "  pip install -r scripts/aims/requirements.txt"
        )
    cfg = require_env("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY")
    return create_client(cfg["VITE_SUPABASE_URL"], cfg["VITE_SUPABASE_ANON_KEY"])


def partner_login(sb: Client) -> dict[str, Any]:
    cfg = require_env("AIMS_PARTNER_EMAIL", "AIMS_PARTNER_PASSWORD")
    auth = sb.auth.sign_in_with_password(
        {"email": cfg["AIMS_PARTNER_EMAIL"], "password": cfg["AIMS_PARTNER_PASSWORD"]}
    )
    user = auth.user
    if not user:
        sys.exit("Login failed — no user returned. Check AIMS_PARTNER_EMAIL / PASSWORD.")
    print(f"✓ Signed in as {cfg['AIMS_PARTNER_EMAIL']} ({user.id})")
    return {"id": user.id, "email": cfg["AIMS_PARTNER_EMAIL"]}


def fetch_submissions(sb: Client, org_id: str | None, limit: int = 200) -> list[dict[str, Any]]:
    # DB column is user_id (mapped to uid in the TypeScript client).
    cols = (
        "id, user_id, organization_id, component_id, component_type, component_title, "
        "status, score, final_score, partner_score_50, ai_grade, ai_decision, "
        "ai_decision_at, criteria_acknowledged, criteria_acknowledged_at, "
        "review_opened_at, review_duration_ms, reviewed_at, reviewer_name, "
        "learner_disputed_at, learner_dispute_note, created_at, last_updated_at"
    )
    q = sb.table("programme_component_submissions").select(cols).limit(limit)
    if org_id:
        q = q.eq("organization_id", org_id)
    # Prefer recent
    try:
        q = q.order("last_updated_at", desc=True)
    except Exception:
        pass
    res = q.execute()
    rows = list(res.data or [])
    print(f"✓ Loaded {len(rows)} submission row(s)" + (f" for org {org_id}" if org_id else ""))
    return rows


# ---------------------------------------------------------------------------
# Auto checks (API / DB evidence)
# ---------------------------------------------------------------------------

def run_auto_checks(rows: list[dict[str, Any]]) -> list[CheckResult]:
    results: list[CheckResult] = []

    ai_done = [r for r in rows if ai_status(r) == "completed"]
    awaiting = [r for r in ai_done if not r.get("ai_decision")]
    decided = [r for r in ai_done if r.get("ai_decision") in ("accept", "edit", "reject")]
    with_dwell = [r for r in decided if r.get("review_duration_ms") is not None]
    with_criteria = [r for r in decided if r.get("criteria_acknowledged") is True]
    edited = [r for r in decided if r.get("ai_decision") == "edit"]
    accepted = [r for r in decided if r.get("ai_decision") == "accept"]
    rejected = [r for r in decided if r.get("ai_decision") == "reject"]
    disputed = [r for r in rows if r.get("learner_disputed_at")]
    ai_errors = [r for r in rows if ai_status(r) == "error"]

    # S01 — AI can complete while human still pending
    ok_s01 = len(ai_done) > 0 and (len(awaiting) > 0 or len(decided) > 0)
    results.append(
        CheckResult(
            "S01",
            "Advisory AI grade lands",
            ok_s01,
            f"ai_completed={len(ai_done)}, awaiting_human={len(awaiting)}, decided={len(decided)}",
        )
    )

    # S02 — only meaningful once someone has decided
    ok_criteria = len(with_criteria) > 0
    results.append(
        CheckResult(
            "S02",
            "Criteria acknowledgement present on decided rows",
            ok_criteria if decided else None,
            (
                f"decided_with_criteria_ack={len(with_criteria)} / decided={len(decided)}"
                if decided
                else "No human AI decisions yet — run Accept/Edit/Reject in UI first"
            ),
        )
    )

    ok_dwell = False
    dwell_detail = "no decided rows with review_duration_ms"
    if with_dwell:
        # Accept path should show meaningful dwell; allow >= 20s (UI enforces 25 for accept)
        long_enough = [r for r in with_dwell if int(r.get("review_duration_ms") or 0) >= 20_000]
        ok_dwell = len(long_enough) > 0
        samples = sorted(int(r["review_duration_ms"]) for r in with_dwell if r.get("review_duration_ms") is not None)
        dwell_detail = (
            f"dwell_samples={len(with_dwell)}, "
            f">=20s={len(long_enough)}, "
            f"min_ms={samples[0]}, max_ms={samples[-1]}"
        )
    results.append(
        CheckResult(
            "S03/S04",
            "Dwell evidence on human decisions (>=20s sample)",
            ok_dwell if decided else None,
            dwell_detail if decided else "No human AI decisions yet — run Accept in UI first",
        )
    )

    results.append(
        CheckResult(
            "S05",
            "Edit decisions exist",
            len(edited) > 0 if decided else None,
            f"edited={len(edited)}",
        )
    )
    results.append(
        CheckResult(
            "S06",
            "Reject decisions exist",
            len(rejected) > 0 if decided else None,
            f"rejected={len(rejected)}",
        )
    )
    results.append(
        CheckResult(
            "S04b",
            "Accept decisions exist",
            len(accepted) > 0 if decided else None,
            f"accepted={len(accepted)}",
        )
    )

    # S07 — enough columns to export
    results.append(
        CheckResult(
            "S07",
            "HITL exportable field coverage",
            len(ai_done) > 0,
            "CSV written by this script (see evidence folder)",
        )
    )

    results.append(
        CheckResult(
            "S08",
            "AI error rows (manual path opportunity)",
            True if ai_errors else None,
            f"ai_error_rows={len(ai_errors)}" + ("" if ai_errors else " (none yet — optional)"),
        )
    )

    results.append(
        CheckResult(
            "S09",
            "Learner dispute path used",
            True if disputed else None,
            f"disputed_rows={len(disputed)}" + ("" if disputed else " (run dispute in UI if empty)"),
        )
    )

    # S10 — distinguish true silent AI approve vs legacy human approve before ai_decision existed
    silent_ai_finals = [
        r
        for r in ai_done
        if not r.get("ai_decision")
        and str(r.get("status") or "") == "approved"
        and not r.get("reviewed_at")
        and not r.get("reviewed_by")
    ]
    legacy_human_no_ai_decision = [
        r
        for r in ai_done
        if not r.get("ai_decision")
        and str(r.get("status") or "") == "approved"
        and (r.get("reviewed_at") or r.get("reviewed_by"))
    ]
    s10_pass = len(silent_ai_finals) == 0
    s10_detail = (
        f"silent_ai_approvals={len(silent_ai_finals)}, "
        f"legacy_human_approve_without_ai_decision={len(legacy_human_no_ai_decision)}"
    )
    if legacy_human_no_ai_decision and not silent_ai_finals:
        s10_detail += (
            " — PASS on silent-AI rule; log legacy rows as AIMS gap "
            "(approved before accept/edit/reject fields were required)"
        )
    results.append(
        CheckResult(
            "S10",
            "No silent approve by AI alone (legacy human-without-ai_decision noted separately)",
            s10_pass,
            s10_detail,
        )
    )

    return results


def write_csv(rows: list[dict[str, Any]], path: Path) -> None:
    headers = [
        "submission_id",
        "organization_id",
        "component_id",
        "component_type",
        "status",
        "ai_status",
        "ai_score",
        "ai_model",
        "human_decision",
        "human_decision_at",
        "human_score",
        "final_score",
        "score_delta_human_minus_ai",
        "criteria_acknowledged",
        "criteria_acknowledged_at",
        "review_opened_at",
        "review_duration_ms",
        "reviewer_name",
        "reviewed_at",
        "learner_disputed_at",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in rows:
            a_score = ai_score(r)
            h_score = r.get("final_score")
            if h_score is None:
                h_score = r.get("score")
            try:
                h_num = float(h_score) if h_score is not None else None
            except (TypeError, ValueError):
                h_num = None
            delta = None
            if a_score is not None and h_num is not None:
                delta = h_num - a_score
            w.writerow(
                {
                    "submission_id": r.get("id"),
                    "organization_id": r.get("organization_id"),
                    "component_id": r.get("component_id"),
                    "component_type": r.get("component_type"),
                    "status": r.get("status"),
                    "ai_status": ai_status(r),
                    "ai_score": a_score,
                    "ai_model": ai_model(r),
                    "human_decision": r.get("ai_decision"),
                    "human_decision_at": r.get("ai_decision_at"),
                    "human_score": h_num,
                    "final_score": r.get("final_score"),
                    "score_delta_human_minus_ai": delta,
                    "criteria_acknowledged": r.get("criteria_acknowledged"),
                    "criteria_acknowledged_at": r.get("criteria_acknowledged_at"),
                    "review_opened_at": r.get("review_opened_at"),
                    "review_duration_ms": r.get("review_duration_ms"),
                    "reviewer_name": r.get("reviewer_name"),
                    "reviewed_at": r.get("reviewed_at"),
                    "learner_disputed_at": r.get("learner_disputed_at"),
                }
            )


def write_report(
    out_dir: Path,
    results: list[CheckResult],
    csv_name: str,
    partner_email: str,
) -> Path:
    report = out_dir / f"HITL-auto-report-{stamp()}.md"
    lines = [
        "# HITL Gate — auto test report",
        "",
        f"- Generated (UTC): `{utc_now().isoformat()}`",
        f"- Partner: `{partner_email}`",
        f"- CSV: `{csv_name}`",
        "",
        "| Script | Result | Detail |",
        "|--------|--------|--------|",
    ]
    for r in results:
        if r.passed is True:
            mark = "PASS"
        elif r.passed is False:
            mark = "FAIL"
        else:
            mark = "SKIP / NEED UI"
        lines.append(f"| {r.script_id} | {mark} | {r.title} — {r.detail} |")
    lines.extend(
        [
            "",
            "## Next",
            "1. Open the CSV and screenshot column headers (S07).",
            "2. Run `--guided` and capture UI screenshots for S02–S06 / S09.",
            "3. Drop this folder into Drive `04 Gate Records`.",
            "",
        ]
    )
    report.write_text("\n".join(lines), encoding="utf-8")
    return report


# ---------------------------------------------------------------------------
# Guided UI walkthrough (screenshots)
# ---------------------------------------------------------------------------

GUIDED_STEPS = [
    {
        "id": "S01",
        "title": "Advisory AI grade lands",
        "do": [
            "As learner: submit a programme artefact.",
            "Wait for Gemini to grade (refresh partner list).",
            "As partner: open Programme submissions — row should show AI graded / awaiting human.",
        ],
        "shot": "T4L-HITL-S01-awaiting-human",
    },
    {
        "id": "S02",
        "title": "Criteria before decision",
        "do": [
            "Open the submission drawer.",
            "Before acknowledging criteria, confirm Accept/Edit/Reject are blocked.",
            "Acknowledge criteria.",
        ],
        "shot": "T4L-HITL-S02-criteria-gate",
    },
    {
        "id": "S03",
        "title": "Accept blocked by 25s dwell",
        "do": [
            "Immediately try Accept (within a few seconds).",
            "Screenshot disabled Accept / wait message.",
        ],
        "shot": "T4L-HITL-S03-accept-blocked-dwell",
    },
    {
        "id": "S04",
        "title": "Accept after dwell",
        "do": [
            "Stay in the drawer ≥ 25 seconds.",
            "Accept and Save.",
            "Screenshot list showing Accepted.",
        ],
        "shot": "T4L-HITL-S04-accepted",
    },
    {
        "id": "S05",
        "title": "Edit AI score",
        "do": [
            "Open a NEW AI-graded submission.",
            "Acknowledge criteria, wait dwell if required, choose Edit.",
            "Enter a human score different from AI. Save. Screenshot.",
        ],
        "shot": "T4L-HITL-S05-edited",
    },
    {
        "id": "S06",
        "title": "Reject AI",
        "do": [
            "Open another NEW AI-graded submission.",
            "Reject and Save. Screenshot Rejected state.",
        ],
        "shot": "T4L-HITL-S06-rejected",
    },
    {
        "id": "S07",
        "title": "HITL strip + CSV",
        "do": [
            "Screenshot the Human-in-the-loop evidence stats on the page.",
            "Click Export AI vs human CSV (or use the CSV this script wrote).",
            "Screenshot CSV headers in Excel/Sheets/Numbers.",
        ],
        "shot": "T4L-HITL-S07-stats-and-csv",
    },
    {
        "id": "S08",
        "title": "AI error → manual score (optional)",
        "do": [
            "If you have an ai_grade error row, score it manually and Save.",
            "Otherwise mark N/A in your log.",
        ],
        "shot": "T4L-HITL-S08-manual-fallback",
    },
    {
        "id": "S09",
        "title": "Learner explain + dispute",
        "do": [
            "As learner, open AI-completed work still awaiting partner.",
            "Screenshot AI ESTIMATE (EXPLAIN ITSELF).",
            "Dispute / request human review. Screenshot needs_revision.",
        ],
        "shot": "T4L-HITL-S09-dispute",
    },
    {
        "id": "S10",
        "title": "AI does not award points alone",
        "do": [
            "Before partner save: confirm points/status not finalised by AI alone.",
            "After partner decision: note what actually awarded points (if anything).",
        ],
        "shot": "T4L-HITL-S10-no-ai-points",
    },
]


def run_guided(out_dir: Path) -> Path:
    base = os.getenv("VITE_APP_BASE_URL", APP_DEFAULT).rstrip("/")
    url = f"{base}{PARTNER_SUBMISSIONS_PATH}"
    out_dir.mkdir(parents=True, exist_ok=True)
    shots_dir = out_dir / "screenshots"
    shots_dir.mkdir(exist_ok=True)
    log_path = out_dir / f"HITL-guided-log-{stamp()}.md"

    print("\n=== GUIDED HITL UI TEST ===")
    print(f"Partner page: {url}")
    print(f"Save screenshots into: {shots_dir}")
    print("Name files like: T4L-HITL-S03-accept-blocked-dwell-YYYYMMDD-HHMM.png\n")
    input("Press Enter when the partner page is open and you are ready… ")

    lines = [
        "# HITL guided run log",
        f"- Started (UTC): `{utc_now().isoformat()}`",
        f"- Partner URL: `{url}`",
        f"- Screenshots dir: `{shots_dir}`",
        "",
    ]

    for step in GUIDED_STEPS:
        print("\n" + "=" * 60)
        print(f"{step['id']} — {step['title']}")
        print("=" * 60)
        for i, item in enumerate(step["do"], 1):
            print(f"  {i}. {item}")
        print(f"\n  Screenshot prefix: {step['shot']}")
        print(f"  Put file(s) in: {shots_dir}")
        ans = input("  Result [p=pass / f=fail / s=skip]: ").strip().lower() or "s"
        note = input("  Notes (optional): ").strip()
        label = {"p": "PASS", "f": "FAIL", "s": "SKIP"}.get(ans, ans.upper())
        lines.append(f"## {step['id']} — {step['title']}")
        lines.append(f"- Result: **{label}**")
        if note:
            lines.append(f"- Notes: {note}")
        lines.append(f"- Expected screenshot prefix: `{step['shot']}`")
        lines.append("")

    lines.append(f"- Finished (UTC): `{utc_now().isoformat()}`")
    log_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n✓ Guided log written: {log_path}")
    return log_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="AIMS §3 HITL gate test (T4L grading)")
    parser.add_argument("--auto", action="store_true", help="Run Supabase/DB assertions + CSV export")
    parser.add_argument("--guided", action="store_true", help="Interactive screenshot walkthrough")
    parser.add_argument("--all", action="store_true", help="Run --auto then --guided")
    parser.add_argument("--org-id", default=None, help="Filter submissions to one organisation UUID")
    parser.add_argument(
        "--out",
        default=str(DEFAULT_OUT),
        help=f"Evidence output directory (default: {DEFAULT_OUT})",
    )
    parser.add_argument("--limit", type=int, default=200, help="Max rows to pull")
    args = parser.parse_args()

    if not (args.auto or args.guided or args.all):
        parser.print_help()
        print("\nTip: start with  python3 scripts/aims/hitl_gate_test.py --all")
        sys.exit(0)

    load_env()
    out_dir = Path(args.out) / stamp()
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Evidence folder: {out_dir}")

    if args.auto or args.all:
        sb = connect()
        partner = partner_login(sb)
        rows = fetch_submissions(sb, args.org_id, args.limit)
        csv_path = out_dir / "T4L-HITL-export.csv"
        write_csv(rows, csv_path)
        print(f"✓ CSV written: {csv_path}")
        results = run_auto_checks(rows)
        report = write_report(out_dir, results, csv_path.name, partner["email"])
        print(f"✓ Report written: {report}")
        print("\nAuto results:")
        for r in results:
            if r.passed is True:
                mark = "PASS"
            elif r.passed is False:
                mark = "FAIL"
            else:
                mark = "SKIP"
            print(f"  [{mark:4}] {r.script_id:7} {r.title} — {r.detail}")

        # Sign out best-effort
        try:
            sb.auth.sign_out()
        except Exception:
            pass

    if args.guided or args.all:
        run_guided(out_dir)

    print("\nDone. Keep screenshots next to the CSV/report for AIMS §3 Gate Records.")


if __name__ == "__main__":
    main()
