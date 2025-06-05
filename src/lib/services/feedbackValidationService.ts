// lib/services/feedbackValidationService.ts
import OpenAI from 'openai';
import { eq } from 'drizzle-orm';
import { db } from '../../server/db/index';
import { feedbackSubmissions, agentExecutions } from '../../server/db/schema';
import { 
  agentConfigs,
  agentResultSchema,
  coordinatorResultSchema,
  type AgentResult,
  type CoordinatorResult,
  tosAgentPrompt,
  actionabilityAgentPrompt,
  toneAgentPrompt,
  coordinatorAgentPrompt
} from '~/lib/agents/definitions';

export interface ValidationProgress {
  stage: 'initializing' | 'agents_running' | 'coordination' | 'complete' | 'error';
  message: string;
  agentProgress: {
    tos: 'pending' | 'running' | 'complete' | 'error';
    actionability: 'pending' | 'running' | 'complete' | 'error';
    tone: 'pending' | 'running' | 'complete' | 'error';
  };
  results?: {
    tos?: AgentResult;
    actionability?: AgentResult;
    tone?: AgentResult;
    coordinator?: CoordinatorResult;
  };
}

export class FeedbackValidationService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ 
      apiKey,
      maxRetries: 3,
      timeout: 30000,
    });
  }

  async validateFeedback(
    feedbackId: number,
    content: string,
    onProgress?: (progress: ValidationProgress) => void
  ): Promise<CoordinatorResult> {
    try {
      // Initialize progress
      const initialProgress: ValidationProgress = {
        stage: 'initializing',
        message: '🔄 Preparing agents for quorum analysis...',
        agentProgress: {
          tos: 'pending',
          actionability: 'pending',
          tone: 'pending',
        },
        results: {}
      };
      onProgress?.(initialProgress);

      // Update database status
      await db.update(feedbackSubmissions)
        .set({ status: 'pending' })
        .where(eq(feedbackSubmissions.id, feedbackId));

      // Stage 1: Run three agents in parallel
      onProgress?.({
        ...initialProgress,
        stage: 'agents_running',
        message: '🤖 Agents entering quorum...',
        agentProgress: {
          tos: 'running',
          actionability: 'running', 
          tone: 'running',
        }
      });

      const agentPromises = [
        this.runAgent('tos', feedbackId, content, onProgress),
        this.runAgent('actionability', feedbackId, content, onProgress),
        this.runAgent('tone', feedbackId, content, onProgress),
      ];

      const [tosResult, actionabilityResult, toneResult] = await Promise.all(agentPromises);

      // Update progress with agent results
      const agentResults = {
        tos: tosResult,
        actionability: actionabilityResult,
        tone: toneResult,
      };

      onProgress?.({
        stage: 'coordination',
        message: '🧠 Coordinator analyzing agent consensus...',
        agentProgress: {
          tos: 'complete',
          actionability: 'complete',
          tone: 'complete',
        },
        results: agentResults
      });

      // Stage 2: Coordinator makes final decision
      const coordinatorResult = await this.runCoordinator(feedbackId, agentResults);

      // Update database with final results
      await db.update(feedbackSubmissions)
        .set({
          tosAgentResult: tosResult,
          actionabilityAgentResult: actionabilityResult,
          toneAgentResult: toneResult,
          coordinatorResult: coordinatorResult,
          finalVerdict: coordinatorResult.finalVerdict,
          suggestions: coordinatorResult.suggestions,
          status: coordinatorResult.finalVerdict === 'flag' ? 'flagged' : 
                  coordinatorResult.finalVerdict === 'accept' ? 'accepted' : 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(feedbackSubmissions.id, feedbackId));

      // Final progress update
      onProgress?.({
        stage: 'complete',
        message: this.getFinalMessage(coordinatorResult),
        agentProgress: {
          tos: 'complete',
          actionability: 'complete', 
          tone: 'complete',
        },
        results: {
          ...agentResults,
          coordinator: coordinatorResult,
        }
      });

      return coordinatorResult;

    } catch (error) {
      console.error('Validation error:', error);
      
      // Update database with error status
      await db.update(feedbackSubmissions)
        .set({ 
          status: 'rejected',
          updatedAt: new Date() 
        })
        .where(eq(feedbackSubmissions.id, feedbackId));
      
      onProgress?.({
        stage: 'error',
        message: '❌ Validation failed. Please try again.',
        agentProgress: {
          tos: 'error',
          actionability: 'error',
          tone: 'error',
        }
      });

      throw error;
    }
  }

  private async runAgent(
    agentType: 'tos' | 'actionability' | 'tone',
    feedbackId: number,
    content: string,
    onProgress?: (progress: ValidationProgress) => void
  ): Promise<AgentResult> {
    const executionRecord = await db.insert(agentExecutions).values({
      feedbackId,
      agentType,
      executionId: `${agentType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'running',
      startedAt: new Date(),
    }).returning();

    try {
      const config = agentConfigs[agentType];
      
      const response = await this.openai.chat.completions.create({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: config.instructions
          },
          {
            role: 'user',
            content: `Please analyze this feedback: "${content}"`
          }
        ],
        temperature: config.temperature,
        max_tokens: 1000,
      });

      const responseContent = response.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response content from OpenAI');
      }

      // Parse and validate the response
      let result: AgentResult;
      try {
        const parsed = JSON.parse(responseContent);
        result = agentResultSchema.parse(parsed);
      } catch (parseError) {
        console.error(`Failed to parse ${agentType} agent response:`, responseContent);
        // Fallback result
        result = {
          score: 50,
          verdict: 'flag',
          reasoning: `Agent response could not be parsed. Original response: ${responseContent}`,
          suggestions: ['Please try submitting your feedback again'],
          confidence: 0
        };
      }

      // Update execution record
      await db.update(agentExecutions)
        .set({
          status: 'completed',
          result: result,
          completedAt: new Date(),
        })
        .where(eq(agentExecutions.id, executionRecord[0]!.id));

      return result;

    } catch (error) {
      console.error(`${agentType} agent error:`, error);
      
      await db.update(agentExecutions)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(agentExecutions.id, executionRecord[0]!.id));

      // Return fallback result instead of throwing
      return {
        score: 50,
        verdict: 'flag',
        reasoning: `${agentType} agent encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestions: ['Please try submitting your feedback again'],
        confidence: 0
      };
    }
  }

  private async runCoordinator(
    feedbackId: number,
    agentResults: { tos: AgentResult; actionability: AgentResult; tone: AgentResult }
  ): Promise<CoordinatorResult> {
    const executionRecord = await db.insert(agentExecutions).values({
      feedbackId,
      agentType: 'coordinator',
      executionId: `coordinator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'running',
      startedAt: new Date(),
    }).returning();

    try {
      const coordinatorPrompt = `
        Analyze these agent results and make a final decision:
        
        TOS Compliance Agent Result:
        ${JSON.stringify(agentResults.tos, null, 2)}
        
        Actionability Assessment Agent Result:
        ${JSON.stringify(agentResults.actionability, null, 2)}
        
        Tone Analysis Agent Result:
        ${JSON.stringify(agentResults.tone, null, 2)}
        
        Make your decision based on the criteria in your instructions.
      `;

      const response = await this.openai.chat.completions.create({
        model: agentConfigs.coordinator.model,
        messages: [
          {
            role: 'system',
            content: agentConfigs.coordinator.instructions
          },
          {
            role: 'user',
            content: coordinatorPrompt
          }
        ],
        temperature: agentConfigs.coordinator.temperature,
        max_tokens: 1000,
      });

      const responseContent = response.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response content from coordinator');
      }

      // Parse and validate the response
      let result: CoordinatorResult;
      try {
        const parsed = JSON.parse(responseContent);
        result = coordinatorResultSchema.parse(parsed);
      } catch (parseError) {
        console.error('Failed to parse coordinator response:', responseContent);
        // Fallback decision based on agent scores
        result = this.makeFallbackDecision(agentResults);
      }

      // Update execution record
      await db.update(agentExecutions)
        .set({
          status: 'completed',
          result: result,
          completedAt: new Date(),
        })
        .where(eq(agentExecutions.id, executionRecord[0]!.id));

      return result;

    } catch (error) {
      console.error('Coordinator error:', error);
      
      await db.update(agentExecutions)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(agentExecutions.id, executionRecord[0]!.id));

      // Return fallback decision
      return this.makeFallbackDecision(agentResults);
    }
  }

  private makeFallbackDecision(agentResults: { tos: AgentResult; actionability: AgentResult; tone: AgentResult }): CoordinatorResult {
    const scores = [agentResults.tos.score, agentResults.actionability.score, agentResults.tone.score];
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const failCount = Object.values(agentResults).filter(r => r.verdict === 'fail').length;
    const flagCount = Object.values(agentResults).filter(r => r.verdict === 'flag').length;
    
    let finalVerdict: 'accept' | 'flag' | 'deny';
    let reasoning: string;
    
    if (failCount > 0) {
      finalVerdict = 'deny';
      reasoning = 'One or more agents identified significant issues with this feedback.';
    } else if (flagCount > 0 || averageScore < 70) {
      finalVerdict = 'flag';
      reasoning = 'Feedback has some concerns that warrant human review.';
    } else {
      finalVerdict = 'accept';
      reasoning = 'Feedback meets quality standards across all evaluation criteria.';
    }

    const allSuggestions = Object.values(agentResults)
      .flatMap(r => r.suggestions || [])
      .filter((suggestion, index, arr) => arr.indexOf(suggestion) === index); // Remove duplicates

    return {
      finalVerdict,
      reasoning,
      suggestions: allSuggestions,
      agentConsensus: flagCount === 0 && failCount === 0,
      confidence: Math.round(averageScore),
    };
  }

  private getFinalMessage(result: CoordinatorResult): string {
    const messages = {
      accept: '✅ Feedback accepted! Great quality submission.',
      flag: '⚠️ Feedback flagged for human review.',
      deny: '❌ Feedback rejected. Please review suggestions and try again.',
    };
    return messages[result.finalVerdict];
  }

  async getSubmissionStatus(feedbackId: number) {
    const submission = await db.select()
      .from(feedbackSubmissions)
      .where(eq(feedbackSubmissions.id, feedbackId))
      .limit(1);

    return submission[0] || null;
  }

  async updateHumanReview(
    feedbackId: number,
    action: 'approved' | 'rejected',
    reviewerId: string,
    notes?: string
  ) {
    return await db.update(feedbackSubmissions)
      .set({
        humanReviewStatus: action,
        humanReviewerId: reviewerId,
        humanReviewNotes: notes,
        status: action === 'approved' ? 'accepted' : 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(feedbackSubmissions.id, feedbackId));
  }

  async getPendingReviews() {
    return await db.select()
      .from(feedbackSubmissions)
      .where(eq(feedbackSubmissions.status, 'flagged'))
      .orderBy(feedbackSubmissions.createdAt);
  }
}