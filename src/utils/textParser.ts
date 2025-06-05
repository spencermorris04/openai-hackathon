// utils/textParser.ts
import { z } from 'zod';

export interface ParsedText {
  wordCount: number;
  sentenceCount: number;
  characterCount: number;
  paragraphCount: number;
  readingTime: number; // in minutes
  complexity: 'simple' | 'moderate' | 'complex';
  sentiment: 'positive' | 'neutral' | 'negative';
  hasQuestions: boolean;
  hasSpecificExamples: boolean;
  hasSuggestions: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings: string[];
  score: number; // 0-100
}

// Text analysis function
export function parseTextToJson(text: string): ParsedText {
  const trimmedText = text.trim();
  
  // Basic counts
  const characterCount = trimmedText.length;
  const wordCount = trimmedText === '' ? 0 : trimmedText.split(/\s+/).filter(word => word.length > 0).length;
  const sentenceCount = trimmedText === '' ? 0 : trimmedText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphCount = trimmedText === '' ? 0 : trimmedText.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  
  // Reading time calculation (average 200 words per minute)
  const readingTime = Math.ceil(wordCount / 200);
  
  // Complexity analysis
  const averageWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const complexity: ParsedText['complexity'] = 
    averageWordsPerSentence > 20 ? 'complex' :
    averageWordsPerSentence > 12 ? 'moderate' : 'simple';
  
  // Content analysis
  const lowerText = trimmedText.toLowerCase();
  
  // Sentiment analysis (basic)
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'like', 'appreciate', 'helpful', 'useful', 'fantastic', 'wonderful', 'impressive', 'satisfied', 'happy'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'frustrating', 'annoying', 'useless', 'horrible', 'disappointed', 'angry', 'sucks', 'worst'];
  
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  const sentiment: ParsedText['sentiment'] = 
    positiveCount > negativeCount ? 'positive' :
    negativeCount > positiveCount ? 'negative' : 'neutral';
  
  // Feature detection
  const hasQuestions = /\?/.test(trimmedText);
  const hasSpecificExamples = /for example|such as|like|including|specifically|in particular/i.test(trimmedText);
  const hasSuggestions = /suggest|recommend|should|could|would be better|improvement|consider|try|maybe/i.test(trimmedText);
  
  return {
    wordCount,
    sentenceCount,
    characterCount,
    paragraphCount,
    readingTime,
    complexity,
    sentiment,
    hasQuestions,
    hasSpecificExamples,
    hasSuggestions
  };
}

// Validation function
export function validateFeedback(parsed: ParsedText): ValidationResult {
  const warnings: string[] = [];
  let score = 100;
  
  // Minimum length checks
  if (parsed.characterCount < 10) {
    return {
      isValid: false,
      error: "Feedback must be at least 10 characters long",
      warnings,
      score: 0
    };
  }
  
  if (parsed.wordCount < 3) {
    return {
      isValid: false,
      error: "Feedback must contain at least 3 words",
      warnings,
      score: 0
    };
  }
  
  // Quality scoring
  if (parsed.wordCount < 10) {
    warnings.push("Consider providing more detailed feedback");
    score -= 20;
  }
  
  if (parsed.sentenceCount < 2) {
    warnings.push("Try to express your thoughts in complete sentences");
    score -= 15;
  }
  
  if (!parsed.hasSpecificExamples && parsed.wordCount > 20) {
    warnings.push("Adding specific examples would make your feedback more helpful");
    score -= 10;
  }
  
  if (!parsed.hasSuggestions && parsed.sentiment === 'negative') {
    warnings.push("Consider adding constructive suggestions for improvement");
    score -= 15;
  }
  
  // Character limit check
  if (parsed.characterCount > 5000) {
    return {
      isValid: false,
      error: "Feedback is too long. Please keep it under 5000 characters",
      warnings,
      score: 0
    };
  }
  
  // Spam detection (very basic)
  const repeatPattern = /(.{3,})\1{3,}/; // Repeated patterns
  if (repeatPattern.test(parsed.characterCount.toString())) {
    warnings.push("Avoid repeating the same content multiple times");
    score -= 25;
  }
  
  // All caps detection
  const capsRatio = (parsed.characterCount - parsed.characterCount.replace(/[A-Z]/g, '').length) / parsed.characterCount;
  if (capsRatio > 0.5) {
    warnings.push("Using too many capital letters can appear as shouting");
    score -= 15;
  }
  
  return {
    isValid: true,
    warnings,
    score: Math.max(0, score)
  };
}

// Text quality analyzer
export function analyzeFeedbackQuality(text: string): {
  parsed: ParsedText;
  validation: ValidationResult;
  recommendations: string[];
} {
  const parsed = parseTextToJson(text);
  const validation = validateFeedback(parsed);
  const recommendations: string[] = [];
  
  // Generate recommendations based on analysis
  if (parsed.wordCount < 15) {
    recommendations.push("Try to provide more detail about your experience");
  }
  
  if (parsed.sentiment === 'negative' && !parsed.hasSuggestions) {
    recommendations.push("Consider adding suggestions for how things could be improved");
  }
  
  if (!parsed.hasSpecificExamples && parsed.wordCount > 20) {
    recommendations.push("Include specific examples to make your feedback more actionable");
  }
  
  if (parsed.complexity === 'simple' && parsed.wordCount > 30) {
    recommendations.push("Consider varying your sentence structure for better readability");
  }
  
  if (!parsed.hasQuestions && parsed.sentiment === 'negative') {
    recommendations.push("Consider asking questions to seek clarification or solutions");
  }
  
  return {
    parsed,
    validation,
    recommendations
  };
}

// Schema for API validation
export const feedbackSchema = z.object({
  content: z.string()
    .min(10, "Feedback must be at least 10 characters")
    .max(5000, "Feedback must be less than 5000 characters")
    .refine((text) => {
      const parsed = parseTextToJson(text);
      return parsed.wordCount >= 3;
    }, "Feedback must contain at least 3 words"),
  userId: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;