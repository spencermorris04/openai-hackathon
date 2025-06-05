/* ------------------------------------------------------------------
   Musephoria – Feedback-Validator API
   ------------------------------------------------------------------
   POST body: ParsedText (~/utils/textParser.ts)
   Response : { decision:"yes"|"no"; confidence:number; reasoning:string }
------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

/* ── shared runtime helpers ─────────────────────────────────────── */
import type { ParsedText } from "~/utils/textParser";

/* ── OpenAI client ──────────────────────────────────────────────── */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ------------------------------------------------------------------
   SCHEMA THE MODEL *MUST* RETURN
------------------------------------------------------------------ */
import { z } from "zod";

export const ValidationResponseSchema = z.object({
  decision: z.enum(["yes", "no"]),
  /** 0–100 (integer); treat as percentage confidence               */
  confidence: z.number().int().min(0).max(100),
  /** Short paragraph giving the rationale for the decision        */
  reasoning: z.string().min(3),
});
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;

/* ------------------------------------------------------------------
   PROMPT
------------------------------------------------------------------ */

const SYSTEM_PROMPT = `
You are **Musephoria's Feedback Validator**.

Task: judge whether a piece of peer feedback is CONSTRUCTIVE enough to be submitted as-is.

Return *ONLY* valid JSON that matches the schema below.

Guidelines
----------
• Accept feedback that is specific, actionable, and respectful.  
• Reject feedback that is vague, abusive, discriminatory, spam, or malicious.  
• If unsure, set decision:"no" but use a low confidence (e.g. 40-60).  
• confidence is an integer 0-100 representing probability your decision is correct.  
• reasoning should be one concise paragraph (2-4 sentences).  
`.trim();

/* ------------------------------------------------------------------
   Local helpers (input validation + reconstruction)
------------------------------------------------------------------ */

function validateParsedText(data: any): data is ParsedText {
  return (
    data &&
    typeof data === "object" &&
    typeof data.words === "object" &&
    typeof data.sentences === "object" &&
    typeof data.wordCount === "number" &&
    typeof data.sentenceCount === "number"
  );
}

function reconstructText(parsed: ParsedText): string {
  if (!parsed.words || !parsed.wordToSentence) return "";
  const sentences: string[] = [];
  const done = new Set<string>();
  Object.entries(parsed.wordToSentence).forEach(([wordId, sentenceId]) => {
    if (!done.has(sentenceId) && parsed.sentences[sentenceId]) {
      sentences.push(parsed.sentences[sentenceId]);
      done.add(sentenceId);
    }
  });
  return sentences.join(" ");
}

/* ------------------------------------------------------------------
   ROUTE HANDLER
------------------------------------------------------------------ */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!validateParsedText(body)) {
      return NextResponse.json(
        { error: "Body must be a valid ParsedText object." },
        { status: 400 },
      );
    }
    const parsedText = body as ParsedText;
    const originalText = reconstructText(parsedText);

    if (!originalText.trim()) {
      return NextResponse.json(
        { error: "Empty feedback cannot be validated." },
        { status: 400 },
      );
    }

    /* —— OpenAI Responses API call ——————————————— */
    const resp = await openai.responses.parse({
      model: "gpt-4.1",
      temperature: 0.0,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "assistant",
          content:
            "Return JSON adhering to this schema:\n```json\n" +
            ValidationResponseSchema.toString() +
            "\n```",
        },
        {
          role: "user",
          content:
            `FEEDBACK TEXT:\n"${originalText}"\n` +
            `wordCount:${parsedText.wordCount} sentenceCount:${parsedText.sentenceCount}`,
        },
      ],
      text: { format: zodTextFormat(ValidationResponseSchema, "validation") },
    });

    if (!resp.output_parsed) {
      return NextResponse.json(
        { error: "Model failed to produce schema-conformant JSON." },
        { status: 502 },
      );
    }

    const result = resp.output_parsed as ValidationResponse;
    return NextResponse.json(result);
  } catch (err) {
    console.error("[feedback-validator] error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
