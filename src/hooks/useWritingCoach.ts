import { useEffect, useRef, useState, useCallback } from "react";
import type { ParsedText } from "~/utils/textParser";
import type { Suggestion, SuggestionsResponse } from "~/schemas/writingCoach";
import { sliceLastSentences } from "~/utils/textSlice";

type Status = "idle" | "loading" | "error";

export function useWritingCoach(
  parsed: ParsedText | null,
): [Suggestion[], Status] {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  // Refs for cleanup and debouncing
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const lastProcessedSentenceKey = useRef("");
  const lastProcessedWordCount = useRef(0);

  // Clear suggestions when text is cleared
  useEffect(() => {
    if (!parsed || parsed.wordCount === 0) {
      setSuggestions([]);
      setStatus("idle");
      lastProcessedSentenceKey.current = "";
      lastProcessedWordCount.current = 0;
      return;
    }
  }, [parsed]);

  const processText = useCallback(async (textData: ParsedText) => {
    // Cancel any previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    
    abortController.current = new AbortController();
    setStatus("loading");

    try {
      // Prepare payload with recent sentences for context
      const payload = sliceLastSentences(textData, 5);
      
      console.log("[coach] Analyzing text:", payload);

      const response = await fetch("/api/writing-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortController.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const responseData = (await response.json()) as SuggestionsResponse;
      const newSuggestions = responseData.suggestions || [];
      
      console.log("[coach] Received suggestions:", newSuggestions);

      // Enhanced validation for word, phrase, and sentence suggestions
      const validSuggestions = newSuggestions.filter(suggestion => {
        if (suggestion.target.type === "word") {
          const exists = textData.words[suggestion.target.id] !== undefined;
          console.log(`[coach] Validating word ${suggestion.target.id}:`, { exists });
          return exists;
        } else if (suggestion.target.type === "phrase") {
          // Parse phrase range like "word_3:word_7"
          try {
            if (!suggestion.target.id) {
              console.warn(`[coach] Missing phrase id`);
              return false;
            }
            const ids = suggestion.target.id.split(':');
            if (ids.length !== 2) {
              console.warn(`[coach] Invalid phrase id format: ${suggestion.target.id}`);
              return false;
            }
            const [startId, endId] = ids;
            if (!startId || !endId) {
              console.warn(`[coach] Undefined start or end id in phrase: ${suggestion.target.id}`);
              return false;
            }
            const startNum = parseInt(startId.replace('word_', ''));
            const endNum = parseInt(endId.replace('word_', ''));
            if (isNaN(startNum) || isNaN(endNum)) {
              console.warn(`[coach] Invalid start or end number in phrase: ${suggestion.target.id}`);
              return false;
            }
            
            // Validate range makes sense
            if (startNum > endNum || startNum < 1) {
              console.warn(`[coach] Invalid phrase range: ${suggestion.target.id}`);
              return false;
            }
            
            // Check all words in range exist
            const allWordsExist = Array.from({length: endNum - startNum + 1}, (_, i) => startNum + i)
              .every(wordNum => textData.words[`word_${wordNum}`] !== undefined);
            
            console.log(`[coach] Validating phrase ${suggestion.target.id}:`, { 
              startNum, endNum, allWordsExist 
            });
            return allWordsExist;
          } catch (error) {
            console.error(`[coach] Error parsing phrase range ${suggestion.target.id}:`, error);
            return false;
          }
        } else if (suggestion.target.type === "sentence") {
          const exists = textData.sentences[suggestion.target.id] !== undefined;
          console.log(`[coach] Validating sentence ${suggestion.target.id}:`, { exists });
          return exists;
        }
        return false;
      });

      setSuggestions(validSuggestions);
      setStatus("idle");
      
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("[coach] Request aborted");
        return;
      }
      
      console.error("[coach] Error:", error);
      setStatus("error");
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (!parsed) return;

    const currentSentenceKey = `sentence_${parsed.sentenceCount}`;
    
    // Helper function to check if last sentence is complete
    const isLastSentenceComplete = () => {
      const lastSentence = parsed.sentences[currentSentenceKey] || "";
      return /[.!?]$/.test(lastSentence.trim());
    };
    
    // Check if we should trigger analysis - ONLY on complete sentences
    const shouldAnalyze = (
      // Sentence completed (ends with punctuation)
      isLastSentenceComplete() &&
      // Haven't processed this sentence yet
      currentSentenceKey !== lastProcessedSentenceKey.current &&
      // Has meaningful content
      parsed.wordCount >= 3
    );

    if (!shouldAnalyze) {
      return;
    }

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the analysis
    debounceTimer.current = setTimeout(() => {
      lastProcessedSentenceKey.current = currentSentenceKey;
      lastProcessedWordCount.current = parsed.wordCount;
      processText(parsed);
    }, 800); // Optimized debounce timing

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [parsed, processText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return [suggestions, status];
}