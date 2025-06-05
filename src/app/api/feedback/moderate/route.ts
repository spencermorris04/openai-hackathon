/* ------------------------------------------------------------------
   Feedback Moderation Route  ·  /api/feedback/moderate  (POST)
   ------------------------------------------------------------------
   Expects:  { content: string }
   Returns:  {
               success: true,
               finalVerdict: 'accept' | 'flag' | 'deny',
               results: { tone: EvalResult; helpfulness: EvalResult; tos: EvalResult }
             }
------------------------------------------------------------------ */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Agent, Runner } from '@openai/agents';
import dotenv from "dotenv";
dotenv.config();

/* ————————————————————————————————————————————
   1.  Runtime-level checks
   ———————————————————————————————————————————— */
export const runtime = 'nodejs';           // Agents SDK needs Node APIs
if (!process.env.OPEN_AI_KEY) {
  throw new Error('OPENAI_API_KEY env var missing');
}


/* ————————————————————————————————————————————
   2.  Shared evaluation schema (validated with zod)
   ———————————————————————————————————————————— */
const EvaluationSchema = z.object({
  verdict: z.enum(['pass', 'flag', 'fail']),
  score: z.number().min(0).max(100),
  reasoning: z.string().min(5).max(2048),
  suggestions: z.array(z.string()).optional(),
});
type EvalResult = z.infer<typeof EvaluationSchema>;

/* ————————————————————————————————————————————
   3.  Helper – extract first JSON object in text
   ———————————————————————————————————————————— */
function extractJson(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*?\}/);       // non-greedy JSON
  return match ? JSON.parse(match[0]) : null;
}

/* ————————————————————————————————————————————
   4.  Factory – create a simple evaluation agent
   ———————————————————————————————————————————— */
function makeAgent(name: string, focus: string) {
  return new Agent({
    name,
    instructions: [
      `You are an autonomous reviewer specialised in ${focus}.`,
      `Respond **only** with a JSON object exactly matching this schema:`,
      JSON.stringify(EvaluationSchema.shape, null, 2),
      `Do NOT wrap the JSON in markdown fences.`,
      `Field meanings:`,
      `• verdict — "pass" (good), "flag" (borderline / needs human), "fail" (reject)`,
      `• score   — 0-100 quality/confidence score`,
      `• reasoning — brief justification`,
      `• suggestions — concrete ways the author could improve (omit if none)`,
    ].join('\n'),
  });
}

const toneAgent        = makeAgent('Tone-Agent',        'detecting respectful, constructive tone');
const helpfulAgent     = makeAgent('Helpfulness-Agent', 'measuring how actionable / specific feedback is');
const tosAgent         = makeAgent('TOS-Agent',         'identifying policy or TOS violations');

const runner = new Runner({ model: 'gpt-4o-mini' });

/* ————————————————————————————————————————————
   5.  POST handler
   ———————————————————————————————————————————— */
export async function POST(req: Request) {
  /* ----- 5.1  Parse input ------------------------------------------------ */
  const { content } = (await req.json()) as { content?: string };
  if (!content || typeof content !== 'string' || content.trim().length < 10) {
    return NextResponse.json(
      { success: false, error: 'Invalid `content` – must be ≥10 characters' },
      { status: 400 },
    );
  }

  /* ----- 5.2  Run the three agents in parallel --------------------------- */
  const [toneRaw, helpfulRaw, tosRaw] = await Promise.all([
    runner.run(toneAgent,    content),
    runner.run(helpfulAgent, content),
    runner.run(tosAgent,     content),
  ]);

  /* ----- 5.3  Parse & validate each agent’s JSON ------------------------- */
  function safeParse(raw: unknown): EvalResult {
    const parsed = extractJson(String(raw));
    const res = EvaluationSchema.safeParse(parsed);
    if (!res.success) throw new Error(`Agent output invalid: ${res.error}`);
    return res.data;
  }

  let tone: EvalResult, helpfulness: EvalResult, tos: EvalResult;
  try {
    tone        = safeParse(toneRaw);
    helpfulness = safeParse(helpfulRaw);
    tos         = safeParse(tosRaw);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: 'Failed to parse agent response' },
      { status: 500 },
    );
  }

  /* ----- 5.4  Coordinator logic ----------------------------------------- */
  let finalVerdict: 'accept' | 'flag' | 'deny';
  if (tos.verdict === 'fail')           finalVerdict = 'deny';
  else if ([tone, helpfulness, tos].some(r => r.verdict === 'flag')) finalVerdict = 'flag';
  else                                 finalVerdict = 'accept';

  /* ----- 5.5  Respond ---------------------------------------------------- */
  return NextResponse.json({
    success: true,
    finalVerdict,
    results: {
      tone,
      helpfulness,
      tos,
    },
  });
}
