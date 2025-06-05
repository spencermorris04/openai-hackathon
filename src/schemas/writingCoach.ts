// ~/schemas/writingCoach.ts
import { z } from "zod";

export const SuggestionCategorySchema = z.enum([
  "go_deeper",        // Feedback is too surface-level, needs more detail
  "be_specific",      // Vague feedback, needs concrete examples
  "technical_terms",  // Could use better musical terminology
  "constructive_tone", // Tone could be more encouraging/helpful
  "actionable",       // Needs specific suggestions for improvement
  "clarity",          // Sentence structure/grammar needs work
  "balance",          // Feedback is too harsh or too soft
  "focus"            // Feedback is scattered, needs to focus on key points
]);

export type SuggestionCategory = z.infer<typeof SuggestionCategorySchema>;

export const SuggestionTargetSchema = z.object({
  type: z.enum(["word", "sentence"]),
  id: z.string(), // e.g., "word_5" or "sentence_2"
});

export const SuggestionSchema = z.object({
  target: SuggestionTargetSchema,
  replacement: z.string(),
  explanation: z.string(),
  category: SuggestionCategorySchema,
});

export const SuggestionsResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;

// Category metadata for UI styling and descriptions
export const CATEGORY_CONFIG: Record<SuggestionCategory, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  go_deeper: {
    label: "Go Deeper",
    description: "This feedback could benefit from more specific details",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    icon: "🔍"
  },
  be_specific: {
    label: "Be Specific", 
    description: "Try to give more concrete, actionable examples",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    icon: "🎯"
  },
  technical_terms: {
    label: "Technical Precision",
    description: "Consider using more precise musical terminology",
    color: "text-green-700", 
    bgColor: "bg-green-50 border-green-200 hover:bg-green-100",
    icon: "🎛️"
  },
  constructive_tone: {
    label: "Constructive Tone",
    description: "This could be phrased more encouragingly",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100", 
    icon: "💫"
  },
  actionable: {
    label: "Make Actionable",
    description: "Try adding specific steps the artist can take",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    icon: "🛠️"
  },
  clarity: {
    label: "Improve Clarity",
    description: "This sentence could be clearer or better structured", 
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200 hover:bg-gray-100",
    icon: "✨"
  },
  balance: {
    label: "Balance Tone",
    description: "Consider balancing criticism with encouragement",
    color: "text-pink-700",
    bgColor: "bg-pink-50 border-pink-200 hover:bg-pink-100",
    icon: "⚖️"
  },
  focus: {
    label: "Stay Focused", 
    description: "Try focusing on the most important points",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
    icon: "🎯"
  }
};