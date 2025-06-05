// components/FeedbackForm.tsx
"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { parseTextToJson, validateFeedback, type ParsedText } from "~/utils/textParser";

interface FeedbackFormProps {
  onSubmissionComplete?: (success: boolean) => void;
}

export default function FeedbackForm({ onSubmissionComplete }: FeedbackFormProps) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [parsedData, setParsedData] = useState<ParsedText | null>(null);

  const handleTextChange = (value: string) => {
    setFeedback(value);
    setSubmissionState("idle");
    setErrorMessage("");
    
    if (value.trim()) {
      const parsed = parseTextToJson(value);
      setParsedData(parsed);
      console.log("Parsed Text JSON:", parsed);
    } else {
      setParsedData(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      setErrorMessage("Please enter some feedback.");
      setSubmissionState("error");
      return;
    }

    const parsed = parseTextToJson(feedback);
    const validation = validateFeedback(parsed);
    
    if (!validation.isValid) {
      setErrorMessage(validation.error || "Invalid feedback");
      setSubmissionState("error");
      return;
    }

    setIsSubmitting(true);
    setSubmissionState("idle");

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate random success/failure (80% success rate)
      const isSuccess = Math.random() > 0.2;
      
      console.log("=== FEEDBACK SUBMISSION ===");
      console.log("Raw Text:", feedback);
      console.log("Parsed Data:", parsed);
      console.log("Submission Result:", isSuccess ? "SUCCESS" : "FAILURE");
      console.log("=========================");
      
      if (isSuccess) {
        setSubmissionState("success");
        setFeedback("");
        setParsedData(null);
      } else {
        setSubmissionState("error");
        setErrorMessage("Submission failed. Please try again.");
      }
      
      onSubmissionComplete?.(isSuccess);
    } catch (error) {
      setSubmissionState("error");
      setErrorMessage("An unexpected error occurred.");
      console.error("Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Share Your Feedback</CardTitle>
        <CardDescription>
          Tell us what you think. Your feedback helps us improve our services.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="feedback" className="text-sm font-medium">
              Your Feedback
            </Label>
            <Textarea
              id="feedback"
              placeholder="Please share your thoughts and experiences. Make sure to include at least 2 sentences..."
              value={feedback}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isSubmitting}
            />
            
            {parsedData && (
              <div className="text-xs text-muted-foreground">
                {parsedData.wordCount} words, {parsedData.sentenceCount} sentences
              </div>
            )}
          </div>

          {submissionState === "error" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {submissionState === "success" && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Thank you! Your feedback has been submitted successfully.
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || !feedback.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}