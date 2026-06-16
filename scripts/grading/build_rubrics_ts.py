"""
Generate functions/src/grading/rubrics.ts from scripts/grading/rubrics/*.txt.

The .txt rubric files are the single source of truth. The Cloud Function needs
them bundled as a TS module, so regenerate after editing any rubric:

    python scripts/grading/build_rubrics_ts.py

Also edit COMPONENT_MAP below if you add a new artefact / pillar with a rubric.
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
RUBRICS_DIR = ROOT / "scripts" / "grading" / "rubrics"
OUT = ROOT / "functions" / "src" / "grading" / "rubrics.ts"

# componentId (artefact HTML filename stem) -> rubric id (txt filename stem).
COMPONENT_MAP = {
    "transforming-business-capstone-part-a": "capstone-part-a",
    "transforming-business-capstone-part-b": "capstone-part-b",
    "transforming-business-capstone-part-c": "capstone-part-c",
    "transforming-business-case-study-1": "case-study-1-kodak",
    "transforming-business-case-study-2": "case-study-2-sars",
    "transforming-business-practical-1": "practical-1-opportunity-map",
    "transforming-business-practical-2": "practical-2-stakeholder-position",
    "transforming-business-practical-3": "practical-3-methodology",
    "transforming-business-practical-4": "practical-4-risk-register",
    "transforming-business-practical-5": "practical-5-briefing-script",
    "transforming-business-practical-6": "practical-6-lessons-synthesis",
}


def main():
    rubric_entries = "\n".join(
        f"  {json.dumps(p.stem)}: {json.dumps(p.read_text())},"
        for p in sorted(RUBRICS_DIR.glob("*.txt"))
    )
    map_entries = "\n".join(
        f"  {json.dumps(k)}: {json.dumps(v)}," for k, v in COMPONENT_MAP.items()
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "/**\n"
        " * AUTO-GENERATED from scripts/grading/rubrics/*.txt - do not edit by hand.\n"
        " * Regenerate with: python scripts/grading/build_rubrics_ts.py\n"
        " */\n\n"
        "export const RUBRICS: Record<string, string> = {\n"
        f"{rubric_entries}\n"
        "};\n\n"
        "export const COMPONENT_TO_RUBRIC: Record<string, string> = {\n"
        f"{map_entries}\n"
        "};\n\n"
        "export function rubricForComponent(componentId: string | null | undefined): string | null {\n"
        "  if (!componentId) return null;\n"
        "  const key = COMPONENT_TO_RUBRIC[componentId];\n"
        "  if (!key) return null;\n"
        "  return RUBRICS[key] ?? null;\n"
        "}\n"
    )
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
