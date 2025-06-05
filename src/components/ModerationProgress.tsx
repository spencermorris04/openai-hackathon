/* ------------------------------------------------------------------
   ModerationProgress ⚡ live WebSocket UI
------------------------------------------------------------------ */
"use client";

import { useEffect, useState, useRef } from "react";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import {
  Shield,
  MessageCircle,
  Target,
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

/* —— types for incoming WS events —— */
type AgentName = "TOS-Agent" | "Tone-Agent" | "Helpfulness-Agent";

interface ProgressEvent {
  type: "validation_progress";
  feedbackId: string;
  stage: "initializing" | "agents_running";
  message: string;
  agent?: AgentName;
  status?: "running" | "complete";
  result?: any;
}
interface CompleteEvent {
  type: "validation_complete";
  feedbackId: string;
  result: any;
}
interface ErrorEvent {
  type: "validation_error";
  feedbackId: string;
  error: string;
}
type ServerEvent = ProgressEvent | CompleteEvent | ErrorEvent;

/* —— simple hook around WebSocket —— */
function useModerationWS(
  content: string | null,
  feedbackId: string | null,
) {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!content || wsRef.current) return;

    const ws = new WebSocket("ws://localhost:3001");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "start_validation",
          feedbackId,
          content,
        }),
      );
    };
    ws.onmessage = (e) => {
      const evt = JSON.parse(e.data) as ServerEvent;
      setEvents((prev) => [...prev, evt]);
    };
    ws.onerror = (e) => console.error("WS error:", e);
    ws.onclose = () => console.log("WS closed");
  }, [content, feedbackId]);

  return events;
}

/* —— UI component —— */
export default function ModerationProgress({
  content,
  feedbackId,
}: {
  content: string;
  feedbackId: string;
}) {
  const events = useModerationWS(content, feedbackId);
  const latest = events[events.length - 1];

  const agentStatus: Record<AgentName, "pending" | "running" | "complete"> = {
    "TOS-Agent": "pending",
    "Tone-Agent": "pending",
    "Helpfulness-Agent": "pending",
  };

  events.forEach((e) => {
    if (e.type === "validation_progress" && e.agent) {
      agentStatus[e.agent] =
        e.status === "complete" ? "complete" : "running";
    }
  });

  const overall =
    latest?.type === "validation_complete"
      ? latest.result.finalVerdict
      : "running";

  const progress =
    latest?.type === "validation_complete"
      ? 100
      : Object.values(agentStatus).filter((s) => s === "complete").length *
          30 +
        10; // ≈ 0 → 100

  const AgentCard = ({
    name,
    icon: Icon,
    status,
  }: {
    name: string;
    icon: any;
    status: "pending" | "running" | "complete";
  }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <Icon
        className={`h-5 w-5 ${
          status === "complete"
            ? "text-green-600"
            : status === "running"
            ? "text-blue-600 animate-spin"
            : "text-slate-400"
        }`}
      />
      <span className="flex-1 text-sm">{name}</span>
      <Badge
        variant={
          status === "complete"
            ? "success"
            : status === "running"
            ? "secondary"
            : "outline"
        }
      >
        {status}
      </Badge>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* overall bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {overall === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
          {overall === "accept" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {overall === "flag" && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
          {overall === "deny" && <XCircle className="h-4 w-4 text-red-600" />}
          <span className="font-medium text-sm capitalize">
            {overall === "running"
              ? "Analyzing…"
              : overall === "accept"
              ? "Accepted"
              : overall === "flag"
              ? "Flagged – needs review"
              : "Denied"}
          </span>
        </div>
        <Progress value={progress} />
      </div>

      {/* per-agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AgentCard
          name="TOS Compliance"
          icon={Shield}
          status={agentStatus["TOS-Agent"]}
        />
        <AgentCard
          name="Tone Analysis"
          icon={MessageCircle}
          status={agentStatus["Tone-Agent"]}
        />
        <AgentCard
          name="Helpfulness"
          icon={Target}
          status={agentStatus["Helpfulness-Agent"]}
        />
      </div>

      {/* reasoning / suggestions once done */}
      {latest?.type === "validation_complete" && (
        <div className="p-4 rounded-lg border bg-slate-50 space-y-2">
          <h4 className="flex items-center gap-2 font-semibold">
            <Brain className="h-4 w-4" />
            Coordinator reasoning
          </h4>
          <p className="text-sm">{latest.result.reasoning}</p>
        </div>
      )}
    </div>
  );
}
