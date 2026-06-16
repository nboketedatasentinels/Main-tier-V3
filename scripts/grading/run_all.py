"""
Validation harness: grade every artefact's gold and weak sample, and print a
pass/fail table. This is how you confirm each rubric is calibrated before it
touches real learners.

Expected: every GOLD scores high and PASSES; every WEAK scores low and FAILS.
Any rubric where gold fails or weak passes needs tuning.

Setup (same venv + key as grade.py):
    source venv/bin/activate
    export GEMINI_API_KEY="your-key"
    python build_samples.py   # once, to create the sample files
    python run_all.py
"""

import sys
from pathlib import Path

from grade import grade, available_rubrics

SAMPLES_DIR = Path(__file__).parent / "samples"


def run_one(artefact: str, kind: str):
    sample = SAMPLES_DIR / f"{artefact}_{kind}.txt"
    if not sample.exists():
        return None
    try:
        r = grade(artefact, sample.read_text())
        return r.get("score"), bool(r.get("pass"))
    except Exception as e:  # noqa: BLE001 - report, don't crash the whole run
        return ("ERR", str(e)[:40])


def main():
    rubrics = available_rubrics()
    print(f"Validating {len(rubrics)} rubrics\n")
    print(f"{'artefact':<34} {'gold':>12} {'weak':>12}   verdict")
    print("-" * 76)

    problems = []
    for artefact in rubrics:
        gold = run_one(artefact, "gold")
        weak = run_one(artefact, "weak")

        def cell(res):
            if res is None:
                return "no sample"
            score, flag = res
            if score == "ERR":
                return "ERROR"
            return f"{score:>5} {'PASS' if flag else 'FAIL'}"

        # A rubric is healthy when gold passes and weak fails.
        ok = (
            gold and gold[0] != "ERR" and gold[1]
            and weak and weak[0] != "ERR" and not weak[1]
        )
        verdict = "ok" if ok else "CHECK"
        if not ok:
            problems.append(artefact)
        print(f"{artefact:<34} {cell(gold):>12} {cell(weak):>12}   {verdict}")

    print("-" * 76)
    if problems:
        print(f"\n{len(problems)} rubric(s) need a look: {', '.join(problems)}")
        sys.exit(1)
    print("\nAll rubrics healthy: every gold passed, every weak failed.")


if __name__ == "__main__":
    main()
