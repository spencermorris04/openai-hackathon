// server/openai.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY;
  if (!apiKey) throw new Error("Missing OpenAI key");

  client = new OpenAI({ apiKey });
  return client;
}