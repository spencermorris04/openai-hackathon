// app/api/feedback/route.ts
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { feedbackSubmissions } from '~/lib/schema';
import { FeedbackValidationService } from '~/lib/services/feedbackValidationService';
import { env } from '~/lib/env';

const app = new Hono().basePath('/api/feedback');

// Enable CORS
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Initialize validation service
const validationService = new FeedbackValidationService(env.OPENAI_API_KEY);

// Validation schemas
const submitFeedbackSchema = z.object({
  content: z.string().min(10, 'Feedback must be at least 10 characters').max(5000, 'Feedback too long'),
  userId: z.string().optional(),
});

const humanReviewSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  notes: z.string().optional(),
});

// Submit feedback endpoint
app.post('/submit', async (c) => {
  try {
    const body = await c.req.json();
    console.log('Submit feedback request:', body);
    
    const validated = submitFeedbackSchema.parse(body);

    // Create feedback submission record
    const submission = await db.insert(feedbackSubmissions).values({
      content: validated.content,
      userId: validated.userId || 'anonymous',
      status: 'pending',
      createdAt: new Date(),
    }).returning();

    const feedbackId = submission[0]!.id;
    
    console.log(`Created feedback submission ${feedbackId}`);

    // Return submission ID immediately for real-time updates
    return c.json({
      success: true,
      feedbackId,
      message: 'Feedback submitted for validation',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      }, 400);
    }
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Submission failed',
    }, 500);
  }
});

// Start validation process (separate from submission)
app.post('/validate/:feedbackId', async (c) => {
  try {
    const feedbackId = parseInt(c.req.param('feedbackId'));
    
    if (isNaN(feedbackId)) {
      return c.json({ success: false, error: 'Invalid feedback ID' }, 400);
    }

    console.log(`Starting validation for feedback ${feedbackId}`);
    
    // Get feedback content
    const submission = await validationService.getSubmissionStatus(feedbackId);
    if (!submission) {
      return c.json({ success: false, error: 'Feedback not found' }, 404);
    }

    // Start validation process (this will be handled via WebSocket for real-time updates)
    // This endpoint is mainly for fallback/testing purposes
    const result = await validationService.validateFeedback(
      feedbackId,
      submission.content
    );

    console.log(`Validation completed for feedback ${feedbackId}:`, result.finalVerdict);

    return c.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Validation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    }, 500);
  }
});

// Get submission status
app.get('/status/:feedbackId', async (c) => {
  try {
    const feedbackId = parseInt(c.req.param('feedbackId'));
    
    if (isNaN(feedbackId)) {
      return c.json({ success: false, error: 'Invalid feedback ID' }, 400);
    }

    const submission = await validationService.getSubmissionStatus(feedbackId);
    
    if (!submission) {
      return c.json({ success: false, error: 'Feedback not found' }, 404);
    }

    return c.json({
      success: true,
      submission,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Status check error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
    }, 500);
  }
});

// Human review endpoint
app.put('/review/:feedbackId', async (c) => {
  try {
    const feedbackId = parseInt(c.req.param('feedbackId'));
    
    if (isNaN(feedbackId)) {
      return c.json({ success: false, error: 'Invalid feedback ID' }, 400);
    }

    const body = await c.req.json();
    const validated = humanReviewSchema.parse(body);

    console.log(`Human review for feedback ${feedbackId}:`, validated.action);

    await validationService.updateHumanReview(
      feedbackId,
      validated.action,
      validated.reviewerId,
      validated.notes
    );

    return c.json({
      success: true,
      message: `Feedback ${validated.action} successfully`,
      action: validated.action,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Human review error:', error);
    
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      }, 400);
    }
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Review update failed',
    }, 500);
  }
});

// Get pending human reviews
app.get('/pending-reviews', async (c) => {
  try {
    const pendingReviews = await validationService.getPendingReviews();

    return c.json({
      success: true,
      reviews: pendingReviews,
      count: pendingReviews.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Pending reviews error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch reviews',
    }, 500);
  }
});

// Get all submissions (for admin/debugging)
app.get('/all', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const submissions = await db.select()
      .from(feedbackSubmissions)
      .limit(Math.min(limit, 100)) // Cap at 100
      .offset(Math.max(offset, 0))
      .orderBy(feedbackSubmissions.createdAt);

    return c.json({
      success: true,
      submissions,
      count: submissions.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get all submissions error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch submissions',
    }, 500);
  }
});

// Health check endpoint
app.get('/health', async (c) => {
  try {
    // Test database connection
    await db.select().from(feedbackSubmissions).limit(1);
    
    return c.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        openai: env.OPENAI_API_KEY ? 'configured' : 'missing',
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// Error handling middleware
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  }, 500);
});

// Handle preflight requests
app.options('/*', (c) => {
  return c.text('', 200);
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);