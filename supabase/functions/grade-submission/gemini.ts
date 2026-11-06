// Gemini grading call shared by the grade-submission Edge Function (Deno) and
// the AIMS injection-resistance test (scripts/aims/injection_resistance_test.ts,
// run with Node). Keep it runtime-neutral: no Deno or Node globals here, the
// caller passes the API key.

export const MODEL = "gemini-3-flash-preview";

export interface GeminiGrade {
  score: number;
  feedback: string;
  pass: boolean;
}

export function assemble(answers: Record<string, string>): string {
  return Object.entries(answers)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n\n");
}

export async function callGemini(apiKey: string, rubric: string, submission: string): Promise<GeminiGrade> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: rubric }] },
    contents: [{ role: "user", parts: [{ text: submission }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        required: ["response"],
        properties: {
          response: {
            type: "OBJECT",
            required: ["score", "feedback", "pass"],
            properties: {
              score: { type: "NUMBER" },
              feedback: { type: "STRING" },
              pass: { type: "BOOLEAN" },
            },
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  const parsed = JSON.parse(text);
  const r = parsed.response ?? parsed;
  return { score: Number(r.score), feedback: String(r.feedback ?? ""), pass: Boolean(r.pass) };
}
