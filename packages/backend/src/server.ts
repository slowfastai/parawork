/**
 * Express server setup
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initWebSocketServer, closeWebSocketServer } from './api/websocket.js';
import workspacesRouter from './api/routes/workspaces.js';
import sessionsRouter from './api/routes/sessions.js';
import systemRouter from './api/routes/system.js';
import filesystemRouter from './api/routes/filesystem.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { getConfig } from './config/settings.js';
import { closeDatabase } from './db/index.js';
import { stopAllAgents } from './agents/monitor.js';

export function createApp() {
  const app = express();
  const config = getConfig();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // CORS middleware
  if (config.server.cors.enabled) {
    app.use(
      cors({
        origin: config.server.cors.origins,
        credentials: true,
      })
    );
  }

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Rate limiting (before auth to prevent brute force)
  app.use('/api', rateLimitMiddleware);

  // Authentication middleware
  app.use('/api', authMiddleware);

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  // API routes
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api', sessionsRouter);
  app.use('/api', systemRouter);
  app.use('/api/fs', filesystemRouter);

  // 404 handler
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
    });
  });

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });

  return app;
}

export function startServer() {
  const app = createApp();
  const server = createServer(app);
  const config = getConfig();

  // Initialize WebSocket server
  initWebSocketServer(server);

  // Start listening
  server.listen(config.server.port, config.server.host, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Parawork Backend Server                                 ║
║   Parallel workspaces. Focused execution.                 ║
║                                                           ║
║   HTTP: http://${config.server.host}:${config.server.port}                          ║
║   WebSocket: ws://${config.server.host}:${config.server.port}                      ║
║                                                           ║
║   API Key: ${config.security.apiKey.substring(0, 8)}...                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown handler
  const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    // Stop accepting new connections
    server.close(() => {
      console.log('HTTP server closed');
    });

    // Stop all agent processes
    console.log('Stopping agent processes...');
    stopAllAgents();

    // Close WebSocket connections
    console.log('Closing WebSocket connections...');
    closeWebSocketServer();

    // Close database connection
    console.log('Closing database connection...');
    closeDatabase();

    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });

  return server;
}
