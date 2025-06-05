"use client";

import { useState } from "react";
import ModerationProgress from "~/components/ModerationProgress";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Loader2, XCircle } from "lucide-react";

export default function ModerationFeedbackForm({ onSubmissionComplete }) {
  const [feedback, setFeedback] = useState("");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!feedback.trim() || feedback.length < 10) {
      setError("Feedback must be at least 10 characters.");
      return;
    }
    const newId = `feedback_${Date.now()}`;
    setFeedbackId(newId);
    setSubmitted(true);
    setIsSubmitting(true);
    // no backend call needed here, WS does everything
    setTimeout(() => setIsSubmitting(false), 500);
  }

  function handleReset() {
    setFeedback("");
    setFeedbackId(null);
    setSubmitted(false);
    setError(null);
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Share Your Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {!submitted && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="feedback">Your Feedback</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Please share your thoughts and experiences. At least 2 sentences..."
                className="min-h-[120px] resize-none"
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting || !feedback.trim()}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Feedback"}
            </Button>
          </form>
        )}
        {/* Show ModerationProgress after submit */}
        {submitted && feedbackId && (
          <div className="space-y-6">
            <ModerationProgress content={feedback} feedbackId={feedbackId} />
            <Button variant="outline" className="w-full" onClick={handleReset}>
              Submit Another Feedback
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
