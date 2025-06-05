// lib/schema.ts
import { sql } from "drizzle-orm";
import { index, sqliteTableCreator, integer, text } from "drizzle-orm/sqlite-core";

export const createTable = sqliteTableCreator(
  (name) => `openai-hackathon_${name}`,
);

export const feedbackSubmissions = createTable(
  "feedback_submissions",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    userId: text("user_id"),
    status: text("status", { enum: ["pending", "accepted", "rejected", "flagged"] }).notNull().default("pending"),
    
    // Agent Results
    tosAgentResult: text("tos_agent_result", { mode: "json" }).$type<{
      score: number;
      verdict: 'pass' | 'flag' | 'fail';
      reasoning: string;
      suggestions?: string[];
      confidence: number;
    }>(),
    actionabilityAgentResult: text("actionability_agent_result", { mode: "json" }).$type<{
      score: number;
      verdict: 'pass' | 'flag' | 'fail';
      reasoning: string;
      suggestions?: string[];
      confidence: number;
    }>(),
    toneAgentResult: text("tone_agent_result", { mode: "json" }).$type<{
      score: number;
      verdict: 'pass' | 'flag' | 'fail';
      reasoning: string;
      suggestions?: string[];
      confidence: number;
    }>(),
    coordinatorResult: text("coordinator_result", { mode: "json" }).$type<{
      finalVerdict: 'accept' | 'flag' | 'deny';
      reasoning: string;
      suggestions: string[];
      agentConsensus: boolean;
      confidence: number;
    }>(),
    
    // Final verdict and suggestions
    finalVerdict: text("final_verdict", { enum: ["accept", "flag", "deny"] }),
    suggestions: text("suggestions", { mode: "json" }).$type<string[]>(),
    
    // Human review (for flagged items)
    humanReviewStatus: text("human_review_status", { enum: ["pending", "approved", "rejected"] }),
    humanReviewerId: text("human_reviewer_id"),
    humanReviewNotes: text("human_review_notes"),
    
    createdAt: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("status_idx").on(t.status),
    index("final_verdict_idx").on(t.finalVerdict),
    index("human_review_idx").on(t.humanReviewStatus),
    index("created_at_idx").on(t.createdAt),
  ],
);

export const agentExecutions = createTable(
  "agent_executions",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    feedbackId: integer("feedback_id").references(() => feedbackSubmissions.id),
    agentType: text("agent_type", { enum: ["tos", "actionability", "tone", "coordinator"] }).notNull(),
    executionId: text("execution_id").notNull(),
    status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
    result: text("result", { mode: "json" }),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (t) => [
    index("feedback_agent_idx").on(t.feedbackId, t.agentType),
    index("execution_status_idx").on(t.status),
    index("started_at_idx").on(t.startedAt),
  ],
);

// Legacy posts table (keeping for compatibility)
export const posts = createTable(
  "post",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => new Date()),
  },
  (t) => [index("name_idx").on(t.name)],
);