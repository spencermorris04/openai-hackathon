// server/websocket.ts
import { FeedbackValidationService } from '../../lib/services/feedbackValidationService';
import { FeedbackWebSocketService } from '../../lib/services/websocketService';
import { config } from "dotenv";
config(); // loads .env into process.env

console.log('🚀 Starting WebSocket server...');

// Initialize services
const apiKey = process.env.OPEN_AI_KEY;
const port = parseInt(process.env.WEBSOCKET_PORT || '3001');

if (!apiKey) throw new Error("Missing OPEN_AI_KEY in environment");
if (Number.isNaN(port)) throw new Error("Missing or invalid WEBSOCKET_PORT in environment");

const validationService = new FeedbackValidationService(apiKey);
const websocketService = new FeedbackWebSocketService(port, validationService);



console.log(`✅ WebSocket server running on port ${process.env.WEBSOCKET_PORT}`);
console.log('📡 Ready to handle real-time feedback validation');

// Health check interval
const healthCheck = setInterval(() => {
  const clientCount = websocketService.getConnectedClients();
  console.log(`💓 Health check - Connected clients: ${clientCount}`);
}, 30000); // Every 30 seconds

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  
  clearInterval(healthCheck);
  
  websocketService.close();
  
  console.log('✅ WebSocket server shut down complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export { websocketService, validationService };