// apps/web/src/utils/textParser.ts
export interface ParsedText {
    words: Record<string, string>;
    sentences: Record<string, string>;
    /** maps word_n ➜ sentence_m (so UI can highlight by sentence) */
    wordToSentence: Record<string, string>;
    wordCount: number;
    sentenceCount: number;
  }
  
  const SENTENCE_REGEX = /[^.!?]+[.!?]|[^.!?]+$/g; // keeps delimiter
  
  export function parseTextToJson(text: string): ParsedText {
    const sentencesArr =
      text.match(SENTENCE_REGEX)?.map(s => s.trim()).filter(Boolean) ?? [];
  
    const sentences: Record<string, string> = {};
    const words: Record<string, string> = {};
    const wordToSentence: Record<string, string> = {};
  
    let globalWord = 1;
  
    sentencesArr.forEach((sentence, sIdx) => {
      const sKey = `sentence_${sIdx + 1}`;
      sentences[sKey] = sentence;
  
      const localWords = sentence.split(/\s+/).filter(Boolean);
      localWords.forEach(w => {
        const wKey = `word_${globalWord++}`;
        words[wKey] = w;
        wordToSentence[wKey] = sKey;
      });
    });
  
    return {
      words,
      sentences,
      wordToSentence,
      wordCount: globalWord - 1,
      sentenceCount: sentencesArr.length,
    };
  }
  
  export function validateFeedback(parsed: ParsedText) {
    if (parsed.sentenceCount < 2) {
      return {
        isValid: false,
        error: "Feedback must contain at least 2 sentences.",
      };
    }
    return { isValid: true };
  }
  