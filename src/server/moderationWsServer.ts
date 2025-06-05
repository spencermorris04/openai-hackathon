// server/moderationWsServer.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { evaluateFeedback } from "../server/evaluateFeedback";

const http = createServer();
const wss = new WebSocketServer({ server: http });
const PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 3001;

type WS = import("ws").WebSocket;
function send(ws: WS, payload: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.type === "start_validation") {
      const { feedbackId, content } = msg as { feedbackId: string; content: string };

      send(ws, {
        type: "validation_progress",
        feedbackId,
        stage: "initializing",
        message: "Spinning up agents…",
      });

      try {
        const stream = await evaluateFeedback(content, {
          onAgentStart(agent) {
            send(ws, {
              type: "validation_progress",
              feedbackId,
              stage: "agents_running",
              message: `Running ${agent.name}`,
              agent: agent.name,
              status: "running",
            });
          },
          onAgentComplete(agent, result) {
            send(ws, {
              type: "validation_progress",
              feedbackId,
              stage: "agents_running",
              message: `${agent.name} finished`,
              agent: agent.name,
              status: "complete",
              result,
            });
          },
        });

        send(ws, {
          type: "validation_complete",
          feedbackId,
          result: stream,
        });
      } catch (err: any) {
        send(ws, {
          type: "validation_error",
          feedbackId,
          error: err?.message ?? "unknown error",
        });
      }
    }
  });
});

http.listen(PORT, "0.0.0.0", () => {
  console.log(`🛰️  WebSocket moderation listening on ws://localhost:${PORT}`);
});
