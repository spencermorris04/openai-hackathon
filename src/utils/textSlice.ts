import type { ParsedText } from "~/utils/textParser";

/**
 * Slices the last N sentences from parsed text data for context-aware analysis
 */
export function sliceLastSentences(parsed: ParsedText, maxSentences: number): Partial<ParsedText> {
  if (!parsed || parsed.sentenceCount === 0) {
    return {
      words: {},
      sentences: {},
      wordCount: 0,
      sentenceCount: 0,
      wordToSentence: {}
    };
  }

  const startSentence = Math.max(1, parsed.sentenceCount - maxSentences + 1);
  const endSentence = parsed.sentenceCount;
  
  // Extract relevant sentences
  const slicedSentences: Record<string, string> = {};
  for (let i = startSentence; i <= endSentence; i++) {
    const sentenceKey = `sentence_${i}`;
    if (parsed.sentences[sentenceKey]) {
      slicedSentences[sentenceKey] = parsed.sentences[sentenceKey];
    }
  }
  
  // Find words that belong to these sentences
  const slicedWords: Record<string, string> = {};
  const slicedWordToSentence: Record<string, string> = {};
  
  // Go through all words and include those that map to our target sentences
  Object.entries(parsed.wordToSentence || {}).forEach(([wordKey, sentenceKey]) => {
    const sentenceNum = parseInt(sentenceKey.replace('sentence_', ''));
    if (sentenceNum >= startSentence && sentenceNum <= endSentence) {
      if (parsed.words[wordKey]) {
        slicedWords[wordKey] = parsed.words[wordKey];
        slicedWordToSentence[wordKey] = sentenceKey;
      }
    }
  });
  
  return {
    words: slicedWords,
    sentences: slicedSentences,
    wordCount: Object.keys(slicedWords).length,
    sentenceCount: Object.keys(slicedSentences).length,
    wordToSentence: slicedWordToSentence
  };
}

/**
 * Helper to check if a sentence appears to be complete
 */
export function isSentenceComplete(text: string): boolean {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) && trimmed.length > 2;
}

/**
 * Extract the most recent incomplete sentence for real-time analysis
 */
export function getCurrentIncompleteSentence(parsed: ParsedText): string {
  if (!parsed || parsed.sentenceCount === 0) return "";
  
  const lastSentenceKey = `sentence_${parsed.sentenceCount}`;
  const lastSentence = parsed.sentences[lastSentenceKey] || "";
  
  // If the last sentence doesn't end with punctuation, it's incomplete
  if (!isSentenceComplete(lastSentence)) {
    return lastSentence;
  }
  
  return "";
}