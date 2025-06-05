import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { CheckCircle2, XCircle, Loader2, Brain } from "lucide-react";

import {
  parseTextToJson,
  validateFeedback,
  type ParsedText,
} from "~/utils/textParser";
import { useWritingCoach } from "~/hooks/useWritingCoach";
import type { Suggestion } from "~/schemas/writingCoach";
import { CATEGORY_CONFIG } from "~/schemas/writingCoach";

// Suggestion tooltip component
function SuggestionTooltip({ 
  suggestion, 
  onApply,
  children
}: { 
  suggestion: Suggestion; 
  onApply: () => void;
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const categoryConfig = CATEGORY_CONFIG[suggestion.category];

  return (
    <span className="relative inline-block">
      <span
        className={`
          cursor-pointer transition-all duration-300 px-1 py-0.5 rounded
          hover:scale-[1.02] hover:shadow-sm relative
          ${categoryConfig.bgColor} hover:${categoryConfig.bgColor.replace('-50', '-100')}
          border-b-2 ${categoryConfig.bgColor.replace('bg-', 'border-').replace('-50', '-400')}
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onApply();
        }}
      >
        {children}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded opacity-0 hover:opacity-10 transition-opacity duration-300 -z-10"></div>
      </span>
      
      {showTooltip && (
        <div className="fixed z-[100] pointer-events-none" style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -120%)'
        }}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-5 w-96 backdrop-blur-sm bg-white/95 animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium">
                {categoryConfig.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 text-sm">{categoryConfig.label}</div>
                <div className="text-xs text-gray-500 capitalize">{suggestion.target.type} suggestion</div>
              </div>
            </div>
            
            {/* Content */}
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Current Text</div>
                <div className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-200 font-mono leading-relaxed">
                  {typeof children === 'string' ? children : 'Selected text'}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">Suggested Improvement</div>
                <div className="text-sm bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-200 font-medium leading-relaxed">
                  {suggestion.replacement}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Why This Helps</div>
                <div className="text-sm text-gray-700 leading-relaxed italic bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  {suggestion.explanation}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-gray-600 font-medium">Click to apply this suggestion</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

export default function IntegratedFeedbackForm() {
  const [rawText, setRawText] = useState("The track sounds terrible and the vocals suck. You need to bring the volume up and make it louder.");
  const [parsedData, setParsedData] = useState<ParsedText | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [suggestions, coachStatus] = useWritingCoach(parsedData);

  // Parse text whenever raw text changes
  useEffect(() => {
    if (rawText.trim()) {
      const parsed = parseTextToJson(rawText);
      setParsedData(parsed);
    } else {
      setParsedData(null);
    }
  }, [rawText]);

  // Sync scroll between textarea and overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Helper function to safely parse phrase ranges
  const parsePhraseRange = (phraseId: string): { startWord: number; endWord: number } | null => {
    const parts = phraseId.split(':');
    if (parts.length !== 2) return null;
    
    const [startId, endId] = parts;
    if (!startId || !endId) return null;
    
    const startWord = parseInt(startId.replace('word_', ''));
    const endWord = parseInt(endId.replace('word_', ''));
    
    if (isNaN(startWord) || isNaN(endWord)) return null;
    
    return { startWord, endWord };
  };

  // Apply suggestion by updating text
  const applySuggestion = useCallback((suggestion: Suggestion) => {
    if (!parsedData) return;

    if (suggestion.target.type === "word") {
      const newWords = { ...parsedData.words };
      newWords[suggestion.target.id] = suggestion.replacement;
      
      const newText = reconstructTextFromParsed({
        ...parsedData,
        words: newWords
      });
      setRawText(newText);
      
    } else if (suggestion.target.type === "phrase") {
      const phraseRange = parsePhraseRange(suggestion.target.id);
      if (!phraseRange) return;
      
      const { startWord, endWord } = phraseRange;
      const newWords = { ...parsedData.words };
      
      newWords[`word_${startWord}`] = suggestion.replacement;
      
      for (let i = startWord + 1; i <= endWord; i++) {
        delete newWords[`word_${i}`];
      }
      
      const newText = reconstructTextFromParsed({
        ...parsedData,
        words: newWords
      });
      setRawText(newText);
      
    } else if (suggestion.target.type === "sentence") {
      const newSentences = { ...parsedData.sentences };
      newSentences[suggestion.target.id] = suggestion.replacement;
      
      const newText = Object.values(newSentences).join(' ');
      setRawText(newText);
    }

    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  }, [parsedData]);

  // Helper function to reconstruct text from parsed data
  const reconstructTextFromParsed = (parsed: ParsedText): string => {
    const words = [];
    for (let i = 1; i <= parsed.wordCount; i++) {
      const word = parsed.words[`word_${i}`];
      if (word) {
        words.push(word);
      }
    }
    return words.join(' ');
  };

  // Organize suggestions by type and target
  const suggestionMap = useMemo(() => {
    const wordSuggestions = new Map<string, Suggestion>();
    const phraseSuggestions = new Map<string, { suggestion: Suggestion; startWord: number; endWord: number }>();
    const sentenceSuggestions = new Map<string, Suggestion>();
    
    suggestions.forEach(s => {
      if (s.target.type === "word") {
        wordSuggestions.set(s.target.id, s);
      } else if (s.target.type === "phrase") {
        const phraseRange = parsePhraseRange(s.target.id);
        if (phraseRange) {
          phraseSuggestions.set(s.target.id, { suggestion: s, ...phraseRange });
        }
      } else if (s.target.type === "sentence") {
        sentenceSuggestions.set(s.target.id, s);
      }
    });
    
    return { wordSuggestions, phraseSuggestions, sentenceSuggestions };
  }, [suggestions]);

  // Render text with suggestions in overlay
  const renderTextWithSuggestions = useMemo(() => {
    if (!rawText) {
      return <span className="text-gray-400 italic">Start writing your feedback...</span>;
    }

    if (!parsedData || suggestions.length === 0) {
      return <span className="text-gray-900 whitespace-pre-wrap">{rawText}</span>;
    }

    const { wordSuggestions } = suggestionMap;
    const elements: React.ReactNode[] = [];
    const processedWords = new Set<number>();
    
    // Split text into words while preserving spaces
    const parts = rawText.split(/(\s+)/);
    let wordIndex = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      if (/\s/.test(part)) {
        // It's whitespace - render as-is
        elements.push(<span key={`space-${i}`} className="text-gray-900">{part}</span>);
      } else {
        // It's a word
        wordIndex++;
        const wordId = `word_${wordIndex}`;
        const suggestion = wordSuggestions.get(wordId);
        
        if (suggestion) {
          elements.push(
            <SuggestionTooltip
              key={`word-${wordIndex}`}
              suggestion={suggestion}
              onApply={() => applySuggestion(suggestion)}
            >
              {part}
            </SuggestionTooltip>
          );
        } else {
          elements.push(
            <span key={`word-${wordIndex}`} className="text-gray-900">
              {part}
            </span>
          );
        }
      }
    }
    
    return elements;
  }, [rawText, parsedData, suggestions, suggestionMap, applySuggestion]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!parsedData || !validateFeedback(parsedData).isValid) {
      setSubmitMessage("Please enter at least two complete sentences.");
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      setSubmitMessage("Feedback submitted successfully!");
      setRawText("");
      setParsedData(null);
    } catch {
      setSubmitMessage("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-4xl shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
        <CardTitle className="flex items-center gap-3 text-gray-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
          Integrated Writing Assistant
          {coachStatus === "loading" && (
            <Brain className="h-5 w-5 animate-pulse text-blue-500" />
          )}
        </CardTitle>
        <CardDescription className="text-gray-600">
          Write feedback below. Highlighted text shows AI suggestions - hover for details, click to apply.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="space-y-4">
          <Label htmlFor="feedback" className="text-sm font-semibold text-gray-700">Your Feedback</Label>

          {/* Layered editor: transparent textarea + text overlay */}
          <div className="relative">
            {/* Invisible textarea for input handling */}
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onScroll={handleScroll}
              className="w-full min-h-[140px] p-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed resize-none bg-white shadow-sm hover:border-gray-300 transition-all duration-200 relative z-10"
              placeholder="Start writing your feedback..."
              style={{ 
                color: 'transparent',
                caretColor: '#374151',
                background: 'transparent'
              }}
            />
            
            {/* Visible text overlay with suggestions */}
            <div 
              ref={overlayRef}
              className="absolute inset-0 p-4 pointer-events-none overflow-hidden rounded-xl z-0"
              style={{
                fontSize: '14px',
                lineHeight: '1.5',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
            >
              <div className="pointer-events-auto">
                {renderTextWithSuggestions}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4 text-gray-500">
              {parsedData && (
                <span className="bg-gray-100 px-2 py-1 rounded-full">
                  {parsedData.wordCount} words • {parsedData.sentenceCount} sentences
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {coachStatus === "loading" && (
                <span className="text-blue-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  Analyzing...
                </span>
              )}
              {coachStatus === "error" && (
                <span className="text-red-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Assistant offline
                </span>
              )}
              {coachStatus === "idle" && suggestions.length > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""} available
                </span>
              )}
              
              <span className="text-blue-600 text-xs">
                Hover highlighted text for suggestions
              </span>
            </div>
          </div>
        </div>

        {/* Suggestions summary */}
        {suggestions.length > 0 && (
          <div className="rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 p-5 border border-blue-100">
            <div className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              Active Suggestions
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => {
                const config = CATEGORY_CONFIG[s.category];
                return (
                  <span 
                    key={i} 
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs ${config.bgColor} ${config.color} border border-current/20 shadow-sm`}
                  >
                    <span>{config.icon}</span>
                    <span className="font-medium">{config.label}</span>
                    <span className="opacity-70 text-xs">({s.target.type})</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {submitMessage && (
          <div className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
            submitMessage.includes("success") 
              ? "bg-green-50 text-green-800 border border-green-200" 
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {submitMessage.includes("success") && <CheckCircle2 className="h-5 w-5" />}
            {submitMessage.includes("failed") && <XCircle className="h-5 w-5" />}
            {submitMessage}
          </div>
        )}

        <Button
          disabled={isSubmitting || !rawText.trim()}
          onClick={handleSubmit}
          className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}