// utils/textParser.ts
export interface ParsedText {
    words: Record<string, string>;
    sentences: Record<string, string>;
    wordCount: number;
    sentenceCount: number;
  }
  
  export function parseTextToJson(text: string): ParsedText {
    // Clean and split text into words
    const words = text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    // Create words object
    const wordsObj: Record<string, string> = {};
    words.forEach((word, index) => {
      wordsObj[`word_${index + 1}`] = word;
    });
  
    // Split text into sentences based on punctuation
    const sentences = text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
    
    // Create sentences object
    const sentencesObj: Record<string, string> = {};
    sentences.forEach((sentence, index) => {
      sentencesObj[`sentence_${index + 1}`] = sentence;
    });
  
    return {
      words: wordsObj,
      sentences: sentencesObj,
      wordCount: words.length,
      sentenceCount: sentences.length
    };
  }
  
  export function validateFeedback(parsedText: ParsedText): { isValid: boolean; error?: string } {
    if (parsedText.sentenceCount < 2) {
      return {
        isValid: false,
        error: "Feedback must contain at least 2 sentences."
      };
    }
    
    return { isValid: true };
  }