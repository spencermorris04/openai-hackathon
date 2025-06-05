// src/server/evaluateFeedback.ts
import { Agent, Runner } from "@openai/agents";
import { z } from "zod";

const EvaluationSchema = z.object({
  verdict: z.enum(["pass", "flag", "fail"]),
  score: z.number().min(0).max(100),
  reasoning: z.string().min(5).max(2048),
  suggestions: z.array(z.string()).optional(),
});
type EvalResult = z.infer<typeof EvaluationSchema>;

function extractJson(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*?\}/); // non-greedy
  return match ? JSON.parse(match[0]) : null;
}

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
    ].join("\n"),
  });
}

const toneAgent = makeAgent("Tone-Agent", "detecting respectful, constructive tone");
const helpfulAgent = makeAgent("Helpfulness-Agent", "measuring how actionable / specific feedback is");
const tosAgent = makeAgent("TOS-Agent", "identifying policy or TOS violations");

const runner = new Runner({ model: "gpt-4o-mini" });

type Callbacks = {
  onAgentStart?: (agent: { name: string }) => void;
  onAgentComplete?: (agent: { name: string }, result: any) => void;
};

export async function evaluateFeedback(content: string, cbs: Callbacks = {}) {
  const agentTasks = [
    { agent: toneAgent, name: "Tone-Agent" },
    { agent: helpfulAgent, name: "Helpfulness-Agent" },
    { agent: tosAgent, name: "TOS-Agent" },
  ];

  // Parallel run
  const results: Record<string, EvalResult> = {};

  await Promise.all(
    agentTasks.map(async ({ agent, name }) => {
      cbs.onAgentStart?.({ name });
      const raw = await runner.run(agent, content);
      const parsed = extractJson(String(raw));
      const res = EvaluationSchema.safeParse(parsed);
      if (!res.success) throw new Error(`Agent ${name} output invalid: ${res.error}`);
      results[name] = res.data;
      cbs.onAgentComplete?.({ name }, res.data);
    })
  );

  // Coordinator logic
  const tos = results["TOS-Agent"];
  const tone = results["Tone-Agent"];
  const helpfulness = results["Helpfulness-Agent"];

  let finalVerdict: "accept" | "flag" | "deny";
  let reasoning = "";

  if (tos.verdict === "fail") {
    finalVerdict = "deny";
    reasoning = "Feedback violates TOS.";
  } else if ([tone, helpfulness, tos].some((r) => r.verdict === "flag")) {
    finalVerdict = "flag";
    reasoning = "At least one agent flagged this feedback for review.";
  } else {
    finalVerdict = "accept";
    reasoning = "All agents passed.";
  }

  return {
    finalVerdict,
    reasoning,
    results: {
      tone,
      helpfulness,
      tos,
    },
  };
}
