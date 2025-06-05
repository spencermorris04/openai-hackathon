"use client";

import { useState, useMemo } from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Sparkles, Brain } from "lucide-react";

import {
  parseTextToJson,
  validateFeedback,
  type ParsedText,
} from "~/utils/textParser";
import { useWritingCoach } from "~/hooks/useWritingCoach";
import { Underline } from "~/components/ui/underline";
import type { Suggestion } from "~/schemas/writingCoach";
import { CATEGORY_CONFIG } from "~/schemas/writingCoach";

/* --------------------------------------------------------------- */

interface FeedbackFormProps {
  onSubmissionComplete?: (ok: boolean) => void;
}

export default function FeedbackForm({ onSubmissionComplete }: FeedbackFormProps) {
  const [feedback, setFeedback] = useState("");
  const [parsedData, setParsedData] = useState<ParsedText | null>(null);

  /* call coach with PARSED data again */
  const [suggestions, coachStatus] = useWritingCoach(parsedData);

  /* ui state */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  /* ------------------------------------------------------------- */
  /* text change → re-parse */
  const handleTextChange = (txt: string) => {
    setFeedback(txt);
    setSubmitState("idle");
    setError("");
    setParsedData(txt.trim() ? parseTextToJson(txt) : null);
  };

  /* ------------------------------------------------------------- */
  /* apply single suggestion */
  const apply = (s: Suggestion) => {
    if (!parsedData) return;
    setFeedback(curr => {
      if (s.target.type === "word") {
        const w = parsedData.words[s.target.id];
        return typeof w === "string" ? curr.replace(w, s.replacement) : curr;
      }
      const sent = parsedData.sentences[s.target.id];
      return typeof sent === "string" ? curr.replace(sent, s.replacement) : curr;
    });
  };

  /* ------------------------------------------------------------- */
  /* overlay renderer (no duplicate text) */
  const overlay = useMemo(() => {
    if (!parsedData) return null;

    const wordMap = new Map<string, Suggestion>();
    suggestions.forEach(s => {
      if (s.target.type === "word") wordMap.set(s.target.id, s);
    });

    const nodes: React.ReactNode[] = [];
    for (let i = 1; i <= parsedData.wordCount; i++) {
      const id = `word_${i}`;
      const txt = parsedData.words[id] as string | undefined;
      if (!txt) continue;

      const sug = wordMap.get(id);

      nodes.push(
        sug ? (
          <Underline key={id} suggestion={sug} onApply={() => apply(sug)}>
            {txt}
          </Underline>
        ) : (
          /* transparent placeholder prevents “double rendering” */
          <span key={id} className="text-transparent select-none">
            {txt}
          </span>
        ),
      );

      if (!/[.,!?;:]$/.test(txt)) nodes.push(" ");
    }
    return nodes;
  }, [parsedData, suggestions]);

  /* ------------------------------------------------------------- */
  /* submit */
  const handleSubmit = async () => {
    if (!parsedData) {
      setError("Please enter some feedback.");
      setSubmitState("error");
      return;
    }

    if (!validateFeedback(parsedData).isValid) {
      setError("Feedback must contain at least two sentences.");
      setSubmitState("error");
      return;
    }

    setIsSubmitting(true);
    setSubmitState("idle");
    try {
      /* your real POST will go here */
      await new Promise(r => setTimeout(r, 800));
      setSubmitState("success");
      setFeedback("");
      setParsedData(null);
      onSubmissionComplete?.(true);
    } catch {
      setSubmitState("error");
      setError("Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------------------------------------- */
  /* render */
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
          Share Your Feedback
          {coachStatus === "loading" && (
            <Brain className="h-5 w-5 animate-pulse text-blue-500" />
          )}
        </CardTitle>
        <CardDescription>
          Hover underlined words for AI suggestions. Improvements apply in-place.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* textarea + suggestion overlay */}
        <div className="space-y-2">
          <Label htmlFor="feedback">Your Feedback</Label>

          <div className="relative">
            <Textarea
              id="feedback"
              placeholder="Write constructive feedback here…"
              value={feedback}
              onChange={e => handleTextChange(e.target.value)}
              disabled={isSubmitting}
              className="relative z-10 min-h-[120px] resize-none font-mono bg-transparent"
            />
            {parsedData && suggestions.length > 0 && (
              <div
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words rounded-md px-3 py-2 font-mono"
                style={{ color: "transparent", lineHeight: "1.5", fontSize: 14 }}
              >
                <span className="pointer-events-auto text-gray-900">{overlay}</span>
              </div>
            )}
          </div>

          {/* live status */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {parsedData && (
              <span>
                {parsedData.wordCount} words • {parsedData.sentenceCount} sentences
              </span>
            )}

            {coachStatus === "loading" && (
              <span className="flex items-center gap-1 text-blue-600">
                <Sparkles className="h-3 w-3 animate-spin" /> analysing…
              </span>
            )}
            {coachStatus === "error" && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" /> coach offline
              </span>
            )}
            {coachStatus === "idle" && suggestions.length > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* sentence-level cards */}
        {parsedData &&
          suggestions
            .filter(s => s.target.type === "sentence")
            .map((s, i) => {
              const cfg = CATEGORY_CONFIG[s.category];
              return (
                <div
                  key={`sen-${i}`}
                  className={`border-2 p-3 rounded-lg ${cfg.bgColor}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  <p className="mb-2 text-sm text-gray-700">{s.explanation}</p>

                  <p className="mb-1 text-xs text-gray-600">Current:</p>
                  <p className="rounded border bg-white p-2 italic">
                    &#8220;{parsedData.sentences[s.target.id]}&#8221;
                  </p>

                  <p className="mt-2 mb-1 text-xs text-gray-600">Suggested:</p>
                  <p className="rounded border bg-white p-2 font-medium">
                    &#8220;{s.replacement}&#8221;
                  </p>

                  <Button
                    onClick={() => apply(s)}
                    size="sm"
                    variant="outline"
                    className="mt-3 h-auto py-1 px-3 text-xs"
                  >
                    Apply
                  </Button>
                </div>
              );
            })}

        {/* alerts */}
        {submitState === "error" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {submitState === "success" && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Submitted — thank you!</AlertDescription>
          </Alert>
        )}

        {/* submit button */}
        <Button
          disabled={isSubmitting || !feedback.trim()}
          onClick={handleSubmit}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
