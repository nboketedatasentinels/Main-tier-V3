/**
 * Cloud Function: Grade Programme Submission (AI, advisory only)
 *
 * Firestore trigger on programmeComponentSubmissions/{submissionId}. When a
 * learner submits (or resubmits) a capstone / case study / practical, this
 * grades their answers with Gemini against the matching artefact rubric and
 * writes an `aiGrade` field back onto the submission.
 *
 * ADVISORY ONLY. It never changes `status` and never awards points - the
 * partner remains the sole gate (see approveSubmissionAndAward). The grade is
 * surfaced to the partner in the review drawer as guidance.
 *
 * Secret required: GEMINI_API_KEY  (set with: firebase functions:secrets:set GEMINI_API_KEY)
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { rubricForComponent } from "./grading/rubrics";

const MODEL = "gemini-3-flash-preview";

interface SubmissionDoc {
  componentId?: string | null;
  answers?: Record<string, string> | null;
  aiGrade?: { answersHash?: string } | null;
}

interface AiGradeResult {
  score: number;
  feedback: string;
  pass: boolean;
}

/** Assemble the learner's answers into a single submission string. */
function assembleSubmission(answers: Record<string, string>): string {
  return Object.entries(answers)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n\n");
}

function hashAnswers(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function callGemini(rubric: string, submission: string): Promise<AiGradeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: submission,
    config: {
      systemInstruction: rubric,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["response"],
        properties: {
          response: {
            type: Type.OBJECT,
            required: ["score", "feedback", "pass"],
            properties: {
              score: { type: Type.NUMBER },
              feedback: { type: Type.STRING },
              pass: { type: Type.BOOLEAN },
            },
          },
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  const parsed = JSON.parse(text);
  const r = parsed.response ?? parsed;
  return {
    score: Number(r.score),
    feedback: String(r.feedback ?? ""),
    pass: Boolean(r.pass),
  };
}

export const gradeProgrammeSubmission = functions
  .runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 120 })
  .firestore.document("programmeComponentSubmissions/{submissionId}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? (change.after.data() as SubmissionDoc) : null;
    if (!after) return; // deleted

    const componentId = after.componentId ?? null;
    const rubric = rubricForComponent(componentId);
    if (!rubric) {
      // No rubric for this artefact (e.g. non transforming-business). Skip silently.
      return;
    }

    const answers = after.answers ?? {};
    const submission = assembleSubmission(answers);
    if (!submission) return; // nothing to grade

    const answersHash = hashAnswers(submission);
    // Already graded this exact version (incl. our own write-back) => no-op. Prevents loops.
    if (after.aiGrade?.answersHash === answersHash) return;

    const ref = change.after.ref;
    try {
      const result = await callGemini(rubric, submission);
      await ref.update({
        aiGrade: {
          score: result.score,
          feedback: result.feedback,
          pass: result.pass,
          model: MODEL,
          status: "completed",
          answersHash,
          gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      functions.logger.info(
        `Graded ${context.params.submissionId} (${componentId}): ${result.score} pass=${result.pass}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      functions.logger.error(`AI grade failed for ${context.params.submissionId}: ${message}`);
      await ref.update({
        aiGrade: {
          status: "error",
          error: message.slice(0, 500),
          model: MODEL,
          answersHash,
          gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
  });
