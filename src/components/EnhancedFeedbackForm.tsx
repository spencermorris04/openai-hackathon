// components/EnhancedFeedbackForm.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle, 
  Brain, 
  Shield, 
  Target, 
  MessageCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Zap,
  Wifi,
  WifiOff
} from "lucide-react";
import { useWebSocket } from "~/lib/services/websocketService";
import type { ValidationProgress, CoordinatorResult } from "~/lib/services/feedbackValidationService";

interface FeedbackFormProps {
  onSubmissionComplete?: (success: boolean, flagged?: boolean) => void;
}

export default function EnhancedFeedbackForm({ onSubmissionComplete }: FeedbackFormProps) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<"idle" | "validating" | "success" | "flagged" | "denied" | "error">("idle");
  const [feedbackId, setFeedbackId] = useState<number | null>(null);
  const [validationProgress, setValidationProgress] = useState<ValidationProgress | null>(null);
  const [finalResult, setFinalResult] = useState<CoordinatorResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // WebSocket connection for real-time updates
  const { isConnected, messages, sendMessage, connectionError } = useWebSocket('ws://localhost:8080');

  // Listen for WebSocket messages
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || !feedbackId) return;

    console.log('Processing WebSocket message:', latestMessage.type);

    switch (latestMessage.type) {
      case 'validation_progress':
        if (latestMessage.feedbackId === feedbackId) {
          setValidationProgress(latestMessage.progress);
        }
        break;

      case 'validation_complete':
        if (latestMessage.feedbackId === feedbackId) {
          setFinalResult(latestMessage.result);
          const newState = 
            latestMessage.result.finalVerdict === 'accept' ? 'success' :
            latestMessage.result.finalVerdict === 'flag' ? 'flagged' : 'denied';
          setSubmissionState(newState);
          setIsSubmitting(false);
          onSubmissionComplete?.(
            latestMessage.result.finalVerdict === 'accept',
            latestMessage.result.finalVerdict === 'flag'
          );
        }
        break;

      case 'human_review_complete':
        if (latestMessage.feedbackId === feedbackId) {
          setSubmissionState(latestMessage.action === 'approved' ? 'success' : 'denied');
        }
        break;

      case 'validation_error':
        if (latestMessage.feedbackId === feedbackId) {
          setErrorMessage(latestMessage.error);
          setSubmissionState('error');
          setIsSubmitting(false);
        }
        break;

      case 'error':
        setErrorMessage(latestMessage.error);
        setSubmissionState('error');
        setIsSubmitting(false);
        break;
    }
  }, [messages, feedbackId, onSubmissionComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      setErrorMessage("Please enter some feedback.");
      setSubmissionState("error");
      return;
    }

    if (feedback.trim().length < 10) {
      setErrorMessage("Feedback must be at least 10 characters long.");
      setSubmissionState("error");
      return;
    }

    if (!isConnected) {
      setErrorMessage("Connection lost. Please refresh and try again.");
      setSubmissionState("error");
      return;
    }

    setIsSubmitting(true);
    setSubmissionState("validating");
    setErrorMessage("");
    setValidationProgress(null);
    setFinalResult(null);

    try {
      // Submit feedback
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: feedback,
          userId: `user_${Date.now()}` 
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Submission failed');
      }

      const newFeedbackId = result.feedbackId;
      setFeedbackId(newFeedbackId);

      // Subscribe to feedback updates
      sendMessage({
        type: 'subscribe_feedback',
        feedbackId: newFeedbackId,
      });

      // Start validation process
      sendMessage({
        type: 'start_validation',
        feedbackId: newFeedbackId,
      });

    } catch (error) {
      console.error('Submission error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Submission failed');
      setSubmissionState('error');
      setIsSubmitting(false);
    }
  };

  const handleHumanReview = (action: 'approved' | 'rejected') => {
    if (!feedbackId) return;

    sendMessage({
      type: 'human_review',
      feedbackId,
      action,
      reviewerId: `reviewer_${Date.now()}`,
      notes: action === 'approved' ? 'Approved by human reviewer' : 'Rejected by human reviewer',
    });
  };

  const resetForm = () => {
    setFeedback("");
    setSubmissionState("idle");
    setValidationProgress(null);
    setFinalResult(null);
    setFeedbackId(null);
    setErrorMessage("");
  };

  const getProgressPercentage = () => {
    if (!validationProgress) return 0;
    
    switch (validationProgress.stage) {
      case 'initializing': return 15;
      case 'agents_running': 
        const completedAgents = Object.values(validationProgress.agentProgress)
          .filter(status => status === 'complete').length;
        return 15 + (completedAgents * 20); // 15 + (0-60)
      case 'coordination': return 85;
      case 'complete': return 100;
      default: return 0;
    }
  };

  const AgentStatusIndicator = ({ 
    name, 
    status, 
    icon: Icon,
    result 
  }: { 
    name: string; 
    status: 'pending' | 'running' | 'complete' | 'error';
    icon: any;
    result?: any;
  }) => (
    <div className="relative p-4 rounded-lg bg-white border-2 border-slate-100 hover:border-slate-200 transition-all duration-200">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-full ${
          status === 'complete' ? 'bg-green-100' :
          status === 'running' ? 'bg-blue-100' :
          status === 'error' ? 'bg-red-100' :
          'bg-slate-100'
        }`}>
          <Icon className={`h-5 w-5 ${
            status === 'complete' ? 'text-green-600' :
            status === 'running' ? 'text-blue-600 animate-pulse' :
            status === 'error' ? 'text-red-600' :
            'text-slate-400'
          }`} />
        </div>
        
        <div className="flex-1">
          <span className="font-medium text-sm text-slate-900">{name}</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={
              status === 'complete' ? 'success' :
              status === 'running' ? 'secondary' :
              status === 'error' ? 'destructive' :
              'outline'
            } className="text-xs">
              {status === 'running' ? 'analyzing...' : status}
            </Badge>
            
            {result && status === 'complete' && (
              <Badge variant={result.verdict === 'pass' ? 'success' : result.verdict === 'flag' ? 'warning' : 'destructive'} className="text-xs">
                {result.score}/100
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {result && status === 'complete' && (
        <div className="text-xs text-slate-600 mt-2">
          {result.reasoning.substring(0, 80)}...
        </div>
      )}
    </div>
  );

  const getWordCount = () => feedback.trim().split(/\s+/).filter(word => word.length > 0).length;
  const getSentenceCount = () => feedback.trim().split(/[.!?]+/).filter(s => s.trim().length > 0).length;

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg">
        <CardTitle className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <Brain className="h-6 w-6 text-blue-600" />
          </div>
          AI Feedback Validation
          <div className="ml-auto flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <Wifi className="h-4 w-4" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600 text-sm">
                <WifiOff className="h-4 w-4" />
                <span>Disconnected</span>
              </div>
            )}
          </div>
        </CardTitle>
        <CardDescription className="text-slate-600">
          Your feedback will be analyzed by our AI agent quorum for quality, compliance, and actionability.
          Real-time validation with instant suggestions for improvement.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Feedback Input Form */}
        {submissionState === 'idle' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="feedback" className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Your Feedback
              </Label>
              <Textarea
                id="feedback"
                placeholder="Share your thoughts, experiences, or suggestions. Be specific and constructive for the best results..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[140px] resize-none text-base leading-relaxed border-2 focus:border-blue-300 transition-colors"
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>{feedback.length} characters</span>
                <span>{getWordCount()} words • {getSentenceCount()} sentences</span>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-3 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200" 
              disabled={isSubmitting || !feedback.trim() || !isConnected}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting AI Analysis...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Submit for AI Validation
                </>
              )}
            </Button>
          </form>
        )}

        {/* Validation Progress */}
        {submissionState === 'validating' && validationProgress && (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
                <h3 className="text-lg font-semibold text-slate-800">{validationProgress.message}</h3>
              </div>
              <Progress value={getProgressPercentage()} className="w-full h-3" />
              <p className="text-sm text-slate-600">{getProgressPercentage()}% complete</p>
            </div>

            {/* Agent Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AgentStatusIndicator 
                name="TOS Compliance"
                status={validationProgress.agentProgress.tos}
                icon={Shield}
                result={validationProgress.results?.tos}
              />
              <AgentStatusIndicator 
                name="Actionability"
                status={validationProgress.agentProgress.actionability}
                icon={Target}
                result={validationProgress.results?.actionability}
              />
              <AgentStatusIndicator 
                name="Tone Analysis"
                status={validationProgress.agentProgress.tone}
                icon={MessageCircle}
                result={validationProgress.results?.tone}
              />
            </div>

            {/* Coordinator Status */}
            {validationProgress.stage === 'coordination' && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border-2 border-purple-200">
                <div className="flex items-center gap-3">
                  <Brain className="h-6 w-6 text-purple-600 animate-pulse" />
                  <div>
                    <h4 className="font-semibold text-purple-800">Coordinator Agent Active</h4>
                    <p className="text-sm text-purple-600">Analyzing agent consensus and making final decision...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success State */}
        {submissionState === 'success' && finalResult && (
          <div className="space-y-6">
            <Alert variant="success" className="border-green-300 bg-green-50">
              <CheckCircle2 className="h-5 w-5" />
              <AlertDescription className="font-medium text-green-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Fantastic! Your feedback has been accepted and will help us improve.
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="bg-green-50 p-6 rounded-lg space-y-4">
              <h4 className="font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Why this feedback rocks:
              </h4>
              <p className="text-sm text-green-700 leading-relaxed">{finalResult.reasoning}</p>
              
              {finalResult.suggestions.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-3 text-green-800">Suggestions for even better feedback:</h5>
                  <ul className="space-y-2">
                    {finalResult.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-green-700 flex items-start gap-3">
                        <span className="text-green-500 font-bold">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button onClick={resetForm} variant="outline" className="w-full py-3">
              <MessageCircle className="mr-2 h-4 w-4" />
              Submit Another Feedback
            </Button>
          </div>
        )}

        {/* Flagged State - Human Review */}
        {submissionState === 'flagged' && finalResult && (
          <div className="space-y-6">
            <Alert variant="warning" className="border-yellow-300 bg-yellow-50">
              <AlertTriangle className="h-5 w-5" />
              <AlertDescription className="font-medium text-yellow-800">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Your feedback has been flagged for human review. This helps us maintain quality standards.
                </div>
              </AlertDescription>
            </Alert>

            <div className="bg-yellow-50 p-6 rounded-lg space-y-4">
              <h4 className="font-semibold text-yellow-800">Coordinator's Assessment:</h4>
              <p className="text-sm text-yellow-700 leading-relaxed">{finalResult.reasoning}</p>
              
              {finalResult.suggestions.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-3 text-yellow-800">Suggestions to improve your feedback:</h5>
                  <ul className="space-y-2">
                    {finalResult.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-yellow-700 flex items-start gap-3">
                        <span className="text-yellow-500 font-bold">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Human Review Simulation */}
            <div className="border-2 border-yellow-200 rounded-lg p-6 bg-white">
              <h5 className="font-medium mb-4 flex items-center gap-2 text-slate-800">
                <Clock className="h-5 w-5 text-yellow-500" />
                Human Review (Demo Mode)
              </h5>
              <div className="flex gap-3">
                <Button 
                  size="sm" 
                  onClick={() => handleHumanReview('approved')}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Approve Feedback
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleHumanReview('rejected')}
                  className="flex items-center gap-2"
                >
                  <ThumbsDown className="h-4 w-4" />
                  Reject Feedback
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Denied State */}
        {submissionState === 'denied' && finalResult && (
          <div className="space-y-6">
            <Alert variant="destructive">
              <XCircle className="h-5 w-5" />
              <AlertDescription className="font-medium">
                Your feedback didn't meet our quality standards. But don't worry - you can improve it!
              </AlertDescription>
            </Alert>

            <div className="bg-red-50 p-6 rounded-lg space-y-4">
              <h4 className="font-semibold text-red-800">Here's how to make it better:</h4>
              <p className="text-sm text-red-700 leading-relaxed">{finalResult.reasoning}</p>
              
              {finalResult.suggestions.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-3 text-red-800">Specific improvements:</h5>
                  <ul className="space-y-2">
                    {finalResult.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-start gap-3">
                        <span className="text-red-500 font-bold">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button onClick={resetForm} className="w-full py-3 bg-red-600 hover:bg-red-700">
              <Target className="mr-2 h-4 w-4" />
              Try Again with Improvements
            </Button>
          </div>
        )}

        {/* Error State */}
        {submissionState === 'error' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {errorMessage || connectionError || 'An unexpected error occurred. Please try again.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}