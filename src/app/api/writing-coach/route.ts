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
   ENHANCED PROMPTS
------------------------------------------------------------------ */

const SYSTEM_PROMPT = `
You are **Musephoria's Writing Coach**. Your job is to help musicians give better, more actionable peer feedback.

INPUT FORMAT
------------
You receive structured text data with:
- words: object mapping "word_1", "word_2", etc. to actual words
- sentences: object mapping "sentence_1", "sentence_2", etc. to full sentences  
- wordToSentence: mapping showing which sentence each word belongs to

OUTPUT FORMAT
-------------
Return *only* JSON matching the schema. If no improvements needed: { "suggestions": [] }

SUGGESTION TYPES & RULES
------------------------

**WORD SUGGESTIONS** (type: "word", id: "word_5")
• ONLY for overly harsh/abrasive language that hurts constructiveness
• replacement: Better word choice ("sucks" → "needs improvement", "terrible" → "could be stronger")
• explanation: Brief reason for the change ("Less harsh language")
• Target: specific word ID

**PHRASE SUGGESTIONS** (type: "phrase", id: "word_3:word_7") 
• For improving clarity and flow of 2-6 word phrases
• replacement: Clearer phrasing ("bring the volume up" → "increase the volume")
• explanation: Brief reason ("Clearer phrasing")
• Target: word range like "word_3:word_7"

**SENTENCE SUGGESTIONS** (type: "sentence", id: "sentence_2")
• For nudging users to go deeper and be more specific with their feedback
• replacement: IMPROVED VERSION of their original sentence with more specific details
• explanation: COACHING QUESTION to help them think about specificity

EXAMPLES for sentence suggestions:

User writes: "The vocals suck"
• replacement: "The vocals need improvement in the 2-3kHz range for better clarity and presence"
• explanation: "What specific vocal issues do you hear - clarity, dynamics, or mix placement?"

User writes: "Mix is too loud"  
• replacement: "The mix level should be reduced by about 3-5dB, particularly the drum bus which is overpowering the vocals"
• explanation: "How much quieter would help? Which elements specifically feel too loud?"

User writes: "Sounds off"
• replacement: "The low-mid frequencies around 200-400Hz feel muddy and could use some EQ reduction"
• explanation: "Which frequencies feel problematic? Is it muddiness or harshness?"

CRITICAL RULES
--------------
• For SENTENCE suggestions: replacement = better version of their sentence, explanation = coaching question
• Never fix spelling/grammar unless it severely impedes understanding
• Never change technical terms unless incorrect
• Use exact word/sentence IDs from the input data
• Keep explanations brief but specific

Each suggestion format:
{
  target: { type: "word"|"phrase"|"sentence", id: "word_12" or "word_3:word_7" or "sentence_1" },
  replacement: "improved version of their text",
  explanation: "coaching question or brief reason",
  category: <enum value>
}
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

function validateSuggestionTargets(suggestions: any[], parsedText: Partial<ParsedText>): any[] {
  return suggestions.filter(suggestion => {
    if (suggestion.target.type === "word") {
      return parsedText.words?.[suggestion.target.id] !== undefined;
    } else if (suggestion.target.type === "phrase") {
      // Validate phrase range like "word_3:word_7"
      try {
        const [startId, endId] = suggestion.target.id.split(':');
        const startNum = parseInt(startId.replace('word_', ''));
        const endNum = parseInt(endId.replace('word_', ''));
        
        // Check that all words in the range exist
        for (let i = startNum; i <= endNum; i++) {
          if (!parsedText.words?.[`word_${i}`]) {
            return false;
          }
        }
        return true;
      } catch {
        return false;
      }
    } else if (suggestion.target.type === "sentence") {
      return parsedText.sentences?.[suggestion.target.id] !== undefined;
    }
    return false;
  });
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

    console.log("[writing-coach] Processing text:", originalText);

    /* —— Call OpenAI Responses API ——————————————— */
    const resp = await openai.responses.parse({
      model: "gpt-4.1",
      temperature: 0.2, // Lower temperature for more consistent suggestions
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
            `Analyze this feedback and provide suggestions using the exact word/sentence IDs from the structured data. Focus on making the feedback more constructive and actionable.`,
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
    const validSuggestions = validateSuggestionTargets(suggestions, parsedText);
    
    console.log("[writing-coach] Generated suggestions:", validSuggestions);
    
    return NextResponse.json({ suggestions: validSuggestions });
  } catch (err) {
    console.error("writing-coach route error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}