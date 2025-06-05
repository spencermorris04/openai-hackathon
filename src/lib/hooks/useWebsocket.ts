// lib/hooks/useWebSocket.ts - Client-side WebSocket hook (browser only)
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export const useWebSocket = (url: string) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      console.log('Connecting to WebSocket:', url);
      
      // Use the native browser WebSocket API
      const websocket = new WebSocket(url);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setWs(websocket);
        setConnectionError(null);
        reconnectAttempts.current = 0;
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
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const timeout = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          console.log(`Attempting to reconnect in ${timeout}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, timeout);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionError('Max reconnection attempts reached. Please refresh the page.');
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setConnectionError('Connection failed. Please check if the WebSocket server is running.');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create connection. Please refresh the page.');
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (ws) {
        console.log('Cleaning up WebSocket connection');
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (ws && isConnected && ws.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending WebSocket message:', message.type);
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        setConnectionError('Failed to send message');
      }
    } else {
      console.warn('Cannot send message: WebSocket not connected');
      setConnectionError('Connection lost. Attempting to reconnect...');
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

  const reconnect = useCallback(() => {
    if (ws) {
      ws.close();
    }
    reconnectAttempts.current = 0;
    setConnectionError(null);
    connect();
  }, [ws, connect]);

  return {
    isConnected,
    messages,
    sendMessage,
    clearMessages,
    getLatestMessage,
    connectionError,
    reconnect,
  };
};