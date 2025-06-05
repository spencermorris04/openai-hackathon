// page.tsx (Main HomePage Component)
"use client";

import { useState } from "react";
import FeedbackForm from "~/components/FeedbackForm";
import FeedbackStats from "~/components/FeedbackStats";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    successfulSubmissions: 0
  });

  const handleSubmissionComplete = (success: boolean) => {
    setStats(prev => ({
      totalSubmissions: prev.totalSubmissions + 1,
      successfulSubmissions: success 
        ? prev.successfulSubmissions + 1 
        : prev.successfulSubmissions
    }));
  };

  const successRate = stats.totalSubmissions > 0 
    ? Math.round((stats.successfulSubmissions / stats.totalSubmissions) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl mb-4">
            Feedback <span className="text-primary">Demo</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A modern feedback collection system with real-time text parsing, 
            validation, and JSON representation.
          </p>
        </div>

        <div className="space-y-8">
          <FeedbackForm onSubmissionComplete={handleSubmissionComplete} />
          
          {stats.totalSubmissions > 0 && (
            <FeedbackStats 
              totalSubmissions={stats.totalSubmissions}
              successRate={successRate}
            />
          )}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500">
            Open browser console to see detailed JSON parsing and submission logs
          </p>
        </div>
      </div>
    </main>
  );
}