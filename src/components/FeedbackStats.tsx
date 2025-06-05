// components/FeedbackStats.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

interface FeedbackStatsProps {
  totalSubmissions: number;
  successRate: number;
}

export default function FeedbackStats({ totalSubmissions, successRate }: FeedbackStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mx-auto">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSubmissions}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Success Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{successRate}%</div>
            <Badge variant={successRate >= 80 ? "default" : "secondary"}>
              {successRate >= 80 ? "Excellent" : "Good"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}