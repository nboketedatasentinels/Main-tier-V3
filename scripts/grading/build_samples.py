"""
Dev utility: build gold + weak sample submissions for every rubric, used by
run_all.py to validate the rubrics. Reads the gold JSONL training data and
writes samples/<artefact>_gold.txt and samples/<artefact>_weak.txt.

The gold sample is assembled from the real distinction-level answers (one
consistent scenario). The weak sample is a deliberately low-effort answer that
every rubric should score low - it proves the grader discriminates.

Run once locally (no API key needed):
    python build_samples.py

SOURCE_DIR points at the training-data in the v2 repo. Edit it if your path
differs. This is a local dev tool; it is not part of the production grader.
"""

import json
from pathlib import Path

SOURCE_DIR = Path(
    "/Users/syntichemusawu/Desktop/Tier-Platform/Man-tier-v2/training-data/transforming-business"
)
SAMPLES_DIR = Path(__file__).parent / "samples"

# rubric stem -> source jsonl filename
ARTEFACTS = {
    "case-study-1-kodak": "case-study-1-kodak.jsonl",
    "case-study-2-sars": "case-study-2-sars.jsonl",
    "capstone-part-a": "capstone-part-a.jsonl",
    "capstone-part-b": "capstone-part-b.jsonl",
    "capstone-part-c": "capstone-part-c.jsonl",
    "practical-1-opportunity-map": "practical-1-opportunity-map.jsonl",
    "practical-2-stakeholder-position": "practical-2-stakeholder-position.jsonl",
    "practical-3-methodology": "practical-3-methodology.jsonl",
    "practical-4-risk-register": "practical-4-risk-register.jsonl",
    "practical-5-briefing-script": "practical-5-briefing-script.jsonl",
    "practical-6-lessons-synthesis": "practical-6-lessons-synthesis.jsonl",
}

# Keep one consistent scenario thread; case-study q1-q3 are case_general.
KEEP_SCENARIOS = {"fleet_logistics", "case_general"}

WEAK_TEMPLATE = (
    "This is my submission. I think this is an important topic and the "
    "opportunity is a good one that we should pursue. The decision maker "
    "should really listen because it matters. I would communicate it better "
    "and push harder next time. There are some risks but we can handle them. "
    "Overall I believe my approach is correct and it would improve things for "
    "the business."
)


def build_gold(jsonl_path: Path) -> str:
    parts, seen = [], set()
    for line in jsonl_path.read_text().splitlines():
        if not line.strip():
            continue
        d = json.loads(line)
        if d.get("scenario") not in KEEP_SCENARIOS:
            continue
        field = d.get("field")
        if field in seen:
            continue
        seen.add(field)
        parts.append(f"{field}: {d.get('output', '').strip()}")
    return "\n\n".join(parts)


def main():
    SAMPLES_DIR.mkdir(exist_ok=True)
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Source data not found: {SOURCE_DIR}\nEdit SOURCE_DIR in this file.")

    for artefact, fname in ARTEFACTS.items():
        src = SOURCE_DIR / fname
        if not src.exists():
            print(f"  SKIP {artefact}: missing {fname}")
            continue
        gold = build_gold(src)
        (SAMPLES_DIR / f"{artefact}_gold.txt").write_text(gold + "\n")
        (SAMPLES_DIR / f"{artefact}_weak.txt").write_text(WEAK_TEMPLATE + "\n")
        print(f"  OK   {artefact}  (gold {len(gold)} chars)")

    print(f"\nWrote samples to {SAMPLES_DIR}")


if __name__ == "__main__":
    main()
