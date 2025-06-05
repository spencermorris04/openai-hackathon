/* ------------------------------------------------------------------
   Musephoria – Writing-Coach API
   ------------------------------------------------------------------
   POST body: ParsedText (structured format)
   Response : SuggestionsResponse (see ~/schemas/writingCoach.ts)
------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

/* ── runtime value ──────────────────────────────────────────────── */
import { SuggestionsResponseSchema } from "~/schemas/writingCoach";
/* ── compile-time type (erased in JS) ───────────────────────────── */
import type { SuggestionsResponse } from "~/schemas/writingCoach";
import type { ParsedText } from "~/utils/textParser";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ------------------------------------------------------------------
   PROMPTS
------------------------------------------------------------------ */

const SYSTEM_PROMPT = `
You are **Musephoria's Writing Coach**. Your job is to turn musicians' raw
peer-feedback into precise, actionable, technically accurate comments.

INPUT FORMAT
------------
You will receive structured text data with:
- words: object mapping "word_1", "word_2", etc. to actual words
- sentences: object mapping "sentence_1", "sentence_2", etc. to full sentences  
- wordToSentence: mapping showing which sentence each word belongs to

OUTPUT FORMAT
-------------
Return *only* JSON that matches the schema you will receive.
If no changes are needed, return: { "suggestions": [] }

SUGGESTION RULES
----------------
• Target specific word IDs (e.g., "word_5") or sentence IDs (e.g., "sentence_2")
• Pinpoint vague or shallow phrases and recommend richer detail
• Employ correct music-production terminology (EQ, compression, rhythm, etc.)
• Maintain the author's voice and tone; don't rewrite everything
• Do *not* fix spelling unless clarity suffers
• Each suggestion object must follow:
  {
    target: { type: "word"|"sentence", id: "word_12" },
    replacement: "new text",
    explanation: "very short reason",
    category: <one of the allowed enums>
  }

IMPORTANT: Only suggest improvements for word/sentence IDs that actually exist in the input data.
`.trim();

/* ------------------------------------------------------------------
   HELPER FUNCTIONS
------------------------------------------------------------------ */

function validateParsedText(data: any): data is Partial<ParsedText> {
  return (
    data &&
    typeof data === "object" &&
    typeof data.words === "object" &&
    typeof data.sentences === "object" &&
    typeof data.wordCount === "number" &&
    typeof data.sentenceCount === "number"
  );
}

function reconstructText(parsed: Partial<ParsedText>): string {
  if (!parsed.words || !parsed.wordToSentence) return "";
  
  const sentences: string[] = [];
  const processedSentences = new Set<string>();
  
  // Reconstruct sentences in order
  Object.entries(parsed.wordToSentence).forEach(([wordId, sentenceId]) => {
    if (!processedSentences.has(sentenceId) && parsed.sentences?.[sentenceId]) {
      sentences.push(parsed.sentences[sentenceId]);
      processedSentences.add(sentenceId);
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
        { error: "Request body must be a valid ParsedText object with words, sentences, wordCount, and sentenceCount." },
        { status: 400 },
      );
    }

    const parsedText = body as Partial<ParsedText>;
    
    // Check if we have meaningful content
    if (!parsedText.wordCount || parsedText.wordCount < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    // Reconstruct the original text for the AI to understand context
    const originalText = reconstructText(parsedText);
    
    if (!originalText.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    /* —— Call OpenAI Responses API ——————————————— */
    const resp = await openai.responses.parse({
      model: "gpt-4o-mini",
      temperature: 0.3,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "assistant",
          content:
            "Here is the schema you must obey:\n" +
            "```json\n" +
            SuggestionsResponseSchema.toString() +
            "\n```",
        },
        {
          role: "user",
          content:
            `STRUCTURED FEEDBACK DATA:\n\n${JSON.stringify(parsedText, null, 2)}\n\n` +
            `ORIGINAL TEXT: "${originalText}"\n\n` +
            `Analyze this feedback and provide suggestions using the exact word/sentence IDs from the structured data.`,
        },
      ],
      text: {
        format: zodTextFormat(
          SuggestionsResponseSchema,   // runtime schema
          "feedback_suggestions",
        ),
      },
    });

    if (!resp.output_parsed) {
      return NextResponse.json(
        { error: "Model did not return valid schema-conformant JSON." },
        { status: 502 },
      );
    }

    const { suggestions } = resp.output_parsed as SuggestionsResponse;
    
    // Validate that all suggested IDs exist in the input data
    const validSuggestions = suggestions.filter(suggestion => {
      if (suggestion.target.type === "word") {
        return parsedText.words?.[suggestion.target.id] !== undefined;
      } else if (suggestion.target.type === "sentence") {
        return parsedText.sentences?.[suggestion.target.id] !== undefined;
      }
      return false;
    });
    
    return NextResponse.json({ suggestions: validSuggestions });
  } catch (err) {
    console.error("writing-coach route error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}