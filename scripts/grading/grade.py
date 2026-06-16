"""
Reusable rubric grader (Gemini 3 Flash).

Grades a learner submission against an artefact rubric and prints {score, feedback, pass}.

Setup:
    python3 -m venv venv && source venv/bin/activate
    pip install google-genai
    export GEMINI_API_KEY="your-key"

Usage:
    # grade a submission file against a rubric
    python grade.py <artefact> <submission_file>
    # e.g.
    python grade.py case-study-1-kodak ./samples/kodak_answer.txt

    # or pipe the submission in on stdin
    cat answer.txt | python grade.py case-study-1-kodak

    # list available rubrics
    python grade.py --list

<artefact> matches a file in rubrics/ (without the .txt), e.g. "case-study-1-kodak".
"""

import json
import os
import sys
from pathlib import Path

from google import genai
from google.genai import types

MODEL = "gemini-3-flash-preview"
RUBRICS_DIR = Path(__file__).parent / "rubrics"

# Forces clean {response: {score, feedback, pass}} output.
RESPONSE_SCHEMA = genai.types.Schema(
    type=genai.types.Type.OBJECT,
    required=["response"],
    properties={
        "response": genai.types.Schema(
            type=genai.types.Type.OBJECT,
            required=["score", "feedback", "pass"],
            properties={
                "score": genai.types.Schema(type=genai.types.Type.NUMBER),
                "feedback": genai.types.Schema(type=genai.types.Type.STRING),
                "pass": genai.types.Schema(type=genai.types.Type.BOOLEAN),
            },
        ),
    },
)


def available_rubrics():
    return sorted(p.stem for p in RUBRICS_DIR.glob("*.txt"))


def load_rubric(artefact: str) -> str:
    path = RUBRICS_DIR / f"{artefact}.txt"
    if not path.exists():
        rubrics = "\n  ".join(available_rubrics()) or "(none found)"
        sys.exit(f"No rubric for '{artefact}'. Available rubrics:\n  {rubrics}")
    return path.read_text()


def grade(artefact: str, submission: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("GEMINI_API_KEY is not set. Run: export GEMINI_API_KEY=\"your-key\"")

    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="HIGH"),
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        system_instruction=[types.Part.from_text(text=load_rubric(artefact))],
    )
    contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=submission)])
    ]

    raw = ""
    for chunk in client.models.generate_content_stream(
        model=MODEL, contents=contents, config=config
    ):
        if chunk.text:
            raw += chunk.text

    return json.loads(raw)["response"]


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        sys.exit(__doc__)
    if args[0] == "--list":
        print("\n".join(available_rubrics()))
        return

    artefact = args[0]
    # submission: from file arg if given, else stdin
    if len(args) >= 2:
        submission = Path(args[1]).read_text()
    else:
        submission = sys.stdin.read()

    if not submission.strip():
        sys.exit("Empty submission. Pass a file path or pipe text on stdin.")

    result = grade(artefact, submission)
    print(json.dumps(result, indent=2))
    verdict = "PASS" if result.get("pass") else "FAIL"
    print(f"\n=> {result.get('score')} / 100  [{verdict}]", file=sys.stderr)


if __name__ == "__main__":
    main()
