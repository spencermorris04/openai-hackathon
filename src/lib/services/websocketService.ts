// lib/services/websocketService.ts
import { WebSocketServer, WebSocket } from 'ws';
import { useState, useEffect, useCallback } from 'react';
import { FeedbackValidationService, ValidationProgress } from './feedbackValidationService';

export interface ClientConnection {
  ws: WebSocket;
  feedbackId?: number;
  userId?: string;
  clientId: string;
}

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export class FeedbackWebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private validationService: FeedbackValidationService;

  constructor(port: number, validationService: FeedbackValidationService) {
    this.validationService = validationService;
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: false,
    });
    this.setupWebSocketServer();
    
    console.log(`WebSocket server running on port ${port}`);
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      
      console.log(`Client connected: ${clientId}`);
      
      const client: ClientConnection = {
        ws,
        clientId,
      };
      
      this.clients.set(clientId, client);

      ws.on('message', async (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Send connection confirmation
      this.sendMessage(ws, {
        type: 'connected',
        clientId,
        message: 'Connected to feedback validation service',
        timestamp: new Date().toISOString(),
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  private async handleMessage(clientId: string, message: WSMessage) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.error(`Client not found: ${clientId}`);
      return;
    }

    console.log(`Handling message from ${clientId}:`, message.type);

    try {
      switch (message.type) {
        case 'subscribe_feedback':
          await this.subscribeFeedback(clientId, message.feedbackId);
          break;

        case 'start_validation':
          await this.startValidation(clientId, message.feedbackId);
          break;

        case 'human_review':
          await this.handleHumanReview(clientId, message);
          break;

        case 'ping':
          this.sendMessage(client.ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        default:
          this.sendError(client.ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message ${message.type}:`, error);
      this.sendError(client.ws, `Error processing ${message.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async subscribeFeedback(clientId: string, feedbackId: number) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Update client with feedback ID
    client.feedbackId = feedbackId;
    this.clients.set(clientId, client);

    console.log(`Client ${clientId} subscribed to feedback ${feedbackId}`);

    // Send current status
    try {
      const status = await this.validationService.getSubmissionStatus(feedbackId);
      this.sendMessage(client.ws, {
        type: 'feedback_status',
        feedbackId,
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting feedback status:', error);
      this.sendError(client.ws, 'Failed to get feedback status');
    }
  }

  private async startValidation(clientId: string, feedbackId: number) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`Starting validation for feedback ${feedbackId} from client ${clientId}`);

    try {
      // Get feedback content
      const submission = await this.validationService.getSubmissionStatus(feedbackId);
      if (!submission) {
        this.sendError(client.ws, 'Feedback not found');
        return;
      }

      // Send validation started message
      this.sendMessage(client.ws, {
        type: 'validation_started',
        feedbackId,
        timestamp: new Date().toISOString(),
      });

      // Start validation with progress callbacks
      const result = await this.validationService.validateFeedback(
        feedbackId,
        submission.content,
        (progress: ValidationProgress) => {
          this.broadcastProgress(feedbackId, progress);
        }
      );

      // Send final result
      this.broadcastMessage(feedbackId, {
        type: 'validation_complete',
        feedbackId,
        result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Validation error:', error);
      this.broadcastMessage(feedbackId, {
        type: 'validation_error',
        feedbackId,
        error: error instanceof Error ? error.message : 'Validation failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async handleHumanReview(clientId: string, message: WSMessage) {
    const { feedbackId, action, reviewerId, notes } = message;

    console.log(`Human review for feedback ${feedbackId}: ${action} by ${reviewerId}`);

    try {
      await this.validationService.updateHumanReview(
        feedbackId,
        action,
        reviewerId,
        notes
      );

      // Broadcast review update
      this.broadcastMessage(feedbackId, {
        type: 'human_review_complete',
        feedbackId,
        action,
        reviewerId,
        notes,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Human review error:', error);
      const client = this.clients.get(clientId);
      if (client) {
        this.sendError(client.ws, 'Review update failed');
      }
    }
  }

  private broadcastProgress(feedbackId: number, progress: ValidationProgress) {
    const message = {
      type: 'validation_progress',
      feedbackId,
      progress,
      timestamp: new Date().toISOString(),
    };

    this.broadcastMessage(feedbackId, message);
  }

  private broadcastMessage(feedbackId: number, message: WSMessage) {
    let sentCount = 0;
    for (const [clientId, client] of this.clients) {
      if (client.feedbackId === feedbackId && client.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(client.ws, message);
        sentCount++;
      }
    }
    
    if (sentCount > 0) {
      console.log(`Broadcasted ${message.type} to ${sentCount} clients for feedback ${feedbackId}`);
    }
  }

  private sendMessage(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: new Date().toISOString(),
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  close() {
    console.log('Closing WebSocket server...');
    this.wss.close();
  }
}

// Client-side WebSocket hook for React
export const useWebSocket = (url: string) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
useEffect(() => {
  if (typeof window === 'undefined') return;

  console.log('Connecting to WebSocket:', url);

  let websocket: WebSocket;

  try {
    websocket = new WebSocket(url);
  } catch (err) {
    console.error('Failed to instantiate WebSocket:', err);
    setConnectionError('Invalid WebSocket URL');
    return;
  }

  websocket.onopen = () => {
    console.log('WebSocket connected');
    setIsConnected(true);
    setWs(websocket);
    setConnectionError(null);
  };

  websocket.onmessage = (event) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      console.log('Received WebSocket message:', message.type);
      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  websocket.onclose = (event) => {
    console.log('WebSocket disconnected:', event.code, event.reason);
    setIsConnected(false);
    setWs(null);

    if (event.code !== 1000) {
      setConnectionError(`Connection lost: ${event.reason || 'Unknown reason'}`);
    }
  };

  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
    setIsConnected(false);
    setConnectionError('Connection failed');
  };

  return () => {
    console.log('Cleaning up WebSocket connection');
    websocket.close(1000, 'Component unmounting');
  };
}, [url]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (ws && isConnected) {
      try {
        console.log('Sending WebSocket message:', message.type);
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, [ws, isConnected]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const getLatestMessage = useCallback((type?: string) => {
    if (type) {
      const filtered = messages.filter(m => m.type === type);
      return filtered[filtered.length - 1] || null;
    }
    return messages[messages.length - 1] || null;
  }, [messages]);

  return {
    isConnected,
    messages,
    sendMessage,
    clearMessages,
    getLatestMessage,
    connectionError,
  };
};