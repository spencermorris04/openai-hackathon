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

      // Fix: Extract suggestions from response object
      const responseData = (await response.json()) as SuggestionsResponse;
      const newSuggestions = responseData.suggestions || [];
      
      console.log("[coach] Received suggestions:", newSuggestions);

      // Filter out suggestions for text that no longer exists
      const validSuggestions = newSuggestions.filter(suggestion => {
        if (suggestion.target.type === "word") {
          return textData.words[suggestion.target.id] !== undefined;
        } else if (suggestion.target.type === "sentence") {
          return textData.sentences[suggestion.target.id] !== undefined;
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
    const lastWord = parsed.words[`word_${parsed.wordCount}`] || "";
    
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
    }, 500); // Slightly longer debounce for complete sentences

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