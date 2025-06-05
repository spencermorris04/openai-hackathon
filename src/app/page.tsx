// app/page.tsx
"use client";

import { useState } from "react";
import EnhancedFeedbackForm from "~/components/EnhancedFeedbackForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Brain, Shield, Target, MessageCircle, Users, Zap, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    successfulSubmissions: 0,
    flaggedSubmissions: 0,
    rejectedSubmissions: 0,
  });

  const handleSubmissionComplete = (success: boolean, flagged: boolean = false) => {
    setStats(prev => ({
      totalSubmissions: prev.totalSubmissions + 1,
      successfulSubmissions: success 
        ? prev.successfulSubmissions + 1 
        : prev.successfulSubmissions,
      flaggedSubmissions: flagged
        ? prev.flaggedSubmissions + 1
        : prev.flaggedSubmissions,
      rejectedSubmissions: (!success && !flagged)
        ? prev.rejectedSubmissions + 1
        : prev.rejectedSubmissions,
    }));
  };

  const successRate = stats.totalSubmissions > 0 
    ? Math.round((stats.successfulSubmissions / stats.totalSubmissions) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
              AI Feedback <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Quorum</span>
            </h1>
          </div>
          
          <p className="text-xl text-slate-600 max-w-4xl mx-auto mb-8 leading-relaxed">
            Experience the future of feedback validation with our AI agent quorum system. 
            Three specialized agents analyze your feedback in parallel for quality, compliance, and actionability,
            then a coordinator makes the final decision with real-time progress tracking.
          </p>
          
          {/* Feature Highlights */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Badge variant="secondary" className="px-3 py-1">
              <Zap className="h-3 w-3 mr-1" />
              Real-time Analysis
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <Brain className="h-3 w-3 mr-1" />
              AI Agent Quorum
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <Target className="h-3 w-3 mr-1" />
              Instant Suggestions
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <Users className="h-3 w-3 mr-1" />
              Human Review
            </Badge>
          </div>
          
          {/* Agent Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-lg">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">TOS Compliance Agent</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Scans for policy violations, inappropriate content, spam, and safety issues.
                  Ensures all feedback meets community standards and guidelines.
                </p>
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  Compliance & Safety
                </Badge>
              </div>
            </Card>
            
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-2 border-green-200 hover:border-green-300 transition-all duration-200 hover:shadow-lg">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <Target className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Actionability Agent</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Evaluates specificity, constructiveness, and usefulness for improvement.
                  Identifies clear, actionable insights that drive positive change.
                </p>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  Quality & Utility
                </Badge>
              </div>
            </Card>
            
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-2 border-purple-200 hover:border-purple-300 transition-all duration-200 hover:shadow-lg">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-purple-100 rounded-full">
                  <MessageCircle className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Tone Analysis Agent</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Analyzes communication tone, professionalism, and emotional impact.
                  Promotes constructive dialogue and respectful communication.
                </p>
                <Badge variant="outline" className="text-purple-600 border-purple-300">
                  Tone & Respect
                </Badge>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          <EnhancedFeedbackForm 
            onSubmissionComplete={(success, flagged) => 
              handleSubmissionComplete(success, flagged)
            } 
          />
          
          {/* Statistics Dashboard */}
          {stats.totalSubmissions > 0 && (
            <div className="max-w-4xl mx-auto">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <Brain className="h-6 w-6 text-blue-600" />
                    Validation Analytics
                  </CardTitle>
                  <CardDescription>
                    Real-time metrics from your feedback validation sessions
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-slate-900">
                        {stats.totalSubmissions}
                      </div>
                      <div className="text-sm text-slate-600 font-medium">Total Submissions</div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-green-600 flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-6 w-6" />
                        {stats.successfulSubmissions}
                      </div>
                      <div className="text-sm text-slate-600 font-medium">Accepted</div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                        <AlertTriangle className="h-6 w-6" />
                        {stats.flaggedSubmissions}
                      </div>
                      <div className="text-sm text-slate-600 font-medium">Flagged</div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-red-600 flex items-center justify-center gap-1">
                        <XCircle className="h-6 w-6" />
                        {stats.rejectedSubmissions}
                      </div>
                      <div className="text-sm text-slate-600 font-medium">Rejected</div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-blue-600">
                        {successRate}%
                      </div>
                      <div className="text-sm text-slate-600 font-medium">Success Rate</div>
                    </div>
                  </div>
                  
                  {/* Success Rate Badge */}
                  <div className="flex justify-center mt-6">
                    <Badge 
                      variant={successRate >= 80 ? 'success' : successRate >= 60 ? 'warning' : 'destructive'}
                      className="px-4 py-2 text-sm font-medium"
                    >
                      {successRate >= 80 ? '🏆 Excellent Performance' : 
                       successRate >= 60 ? '👍 Good Performance' : 
                       '📈 Room for Improvement'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        
        {/* How It Works Section */}
        <div className="mt-20 max-w-6xl mx-auto">
          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl flex items-center justify-center gap-3">
                <Users className="h-7 w-7 text-blue-600" />
                How the AI Quorum Works
              </CardTitle>
              <CardDescription className="text-base">
                A sophisticated multi-agent system that ensures high-quality feedback validation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-white font-bold text-xl">1</span>
                  </div>
                  <h4 className="font-bold text-lg text-slate-800">Submit Feedback</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Your feedback is received, validated, and queued for comprehensive AI analysis
                  </p>
                </div>
                
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-white font-bold text-xl">2</span>
                  </div>
                  <h4 className="font-bold text-lg text-slate-800">Parallel Analysis</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Three specialized agents simultaneously analyze different aspects with real-time progress tracking
                  </p>
                </div>
                
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-white font-bold text-xl">3</span>
                  </div>
                  <h4 className="font-bold text-lg text-slate-800">Smart Coordination</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Coordinator agent analyzes all results and makes intelligent decisions based on consensus
                  </p>
                </div>
                
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-white font-bold text-xl">4</span>
                  </div>
                  <h4 className="font-bold text-lg text-slate-800">Instant Results</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Get immediate verdict with personalized, actionable improvement suggestions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="flex flex-wrap justify-center items-center gap-4 text-sm text-slate-500">
            <span>🚀 Powered by OpenAI Agents SDK</span>
            <span>•</span>
            <span>⚡ Built with Next.js & TypeScript</span>
            <span>•</span>
            <span>🔄 Real-time WebSocket Updates</span>
            <span>•</span>
            <span>💾 Drizzle ORM Database</span>
          </div>
          
          <div className="mt-4">
            <Badge variant="outline" className="px-4 py-2">
              <Zap className="h-3 w-3 mr-1" />
              Demo Mode - Try different feedback styles to see the AI agents in action!
            </Badge>
          </div>
        </div>
      </div>
    </main>
  );
}