// ws-server.ts (or moderationWsServer.ts)
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { evaluateFeedback } from "./src/server/evaluateFeedback"; // Correct import

const http = createServer();
const wss = new WebSocketServer({ server: http });
const PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 3001;

type WS = import("ws").WebSocket;
function send(ws: WS, payload: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

http.listen(PORT, "0.0.0.0", () => {
  console.log(`🛰️  WebSocket moderation listening on ws://localhost:${PORT}`);
});


wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
      console.log("WS: Received", msg); // << ADD THIS
    } catch {
      send(ws, { type: "error", error: "invalid-json" });
      return;
    }

    if (msg.type === "start_validation") {
      const { feedbackId, content } = msg;
      console.log("WS: Starting validation", feedbackId);

      send(ws, {
        type: "validation_progress",
        feedbackId,
        stage: "initializing",
        message: "Spinning up agents…",
      });

      try {
        console.log("WS: Calling evaluateFeedback");
        const result = await evaluateFeedback(content, {
          onAgentStart(agent) {
            console.log("WS: Agent started", agent.name);
            send(ws, {
              type: "validation_progress",
              feedbackId,
              stage: "agents_running",
              message: `Running ${agent.name}`,
              agent: agent.name,
              status: "running",
            });
          },
          onAgentComplete(agent, agentResult) {
            console.log("WS: Agent complete", agent.name, agentResult);
            send(ws, {
              type: "validation_progress",
              feedbackId,
              stage: "agents_running",
              message: `${agent.name} finished`,
              agent: agent.name,
              status: "complete",
              result: agentResult,
            });
          },
        });
        console.log("WS: Moderation complete", result);

        send(ws, {
          type: "validation_complete",
          feedbackId,
          result,
        });
      } catch (err: any) {
        console.error("WS: Moderation error", err);
        send(ws, {
          type: "validation_error",
          feedbackId,
          error: err?.message ?? "unknown error",
        });
      }
    } else {
      send(ws, {
        type: "error",
        error: `unknown-type:${msg.type}`,
      });
    }
  });
});
