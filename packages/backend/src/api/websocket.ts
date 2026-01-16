/**
 * WebSocket server for real-time updates
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { z } from 'zod';
import type { ClientToServerEvent, ServerToClientEvent } from '@parawork/shared';
import { validateWebSocketAuth } from '../middleware/auth.js';
import { sendToAgent, resizeTerminal } from '../agents/monitor.js';
import { sendToUserTerminal, resizeUserTerminal } from '../agents/userTerminal.js';

// Validation schemas for incoming WebSocket messages
const FocusWorkspaceSchema = z.object({
  type: z.literal('focus_workspace'),
  data: z.object({
    workspaceId: z.string().uuid(),
  }),
});

const SubscribeWorkspaceSchema = z.object({
  type: z.literal('subscribe_workspace'),
  data: z.object({
    workspaceId: z.string().uuid(),
  }),
});

const UnsubscribeWorkspaceSchema = z.object({
  type: z.literal('unsubscribe_workspace'),
  data: z.object({
    workspaceId: z.string().uuid(),
  }),
});

const TerminalInputSchema = z.object({
  type: z.literal('terminal_input'),
  data: z.object({
    sessionId: z.string().uuid(),
    data: z.string(),
  }),
});

const TerminalResizeSchema = z.object({
  type: z.literal('terminal_resize'),
  data: z.object({
    sessionId: z.string().uuid(),
    cols: z.number().int().min(1).max(500),
    rows: z.number().int().min(1).max(200),
  }),
});

const UserTerminalInputSchema = z.object({
  type: z.literal('user_terminal_input'),
  data: z.object({
    terminalId: z.string().uuid(),
    data: z.string(),
  }),
});

const UserTerminalResizeSchema = z.object({
  type: z.literal('user_terminal_resize'),
  data: z.object({
    terminalId: z.string().uuid(),
    cols: z.number().int().min(1).max(500),
    rows: z.number().int().min(1).max(200),
  }),
});

const ClientEventSchema = z.discriminatedUnion('type', [
  FocusWorkspaceSchema,
  SubscribeWorkspaceSchema,
  UnsubscribeWorkspaceSchema,
  TerminalInputSchema,
  TerminalResizeSchema,
  UserTerminalInputSchema,
  UserTerminalResizeSchema,
]);

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  subscribedWorkspaces: Set<string>;
  authenticated: boolean;
}

let wss: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({
    server,
    verifyClient: (info, callback) => {
      // Verify API key from query parameter
      const isValid = validateWebSocketAuth(info.req.url);
      if (!isValid) {
        callback(false, 401, 'Unauthorized: Invalid or missing API key');
        return;
      }
      callback(true);
    },
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const extWs = ws as ExtendedWebSocket;
    console.log('New WebSocket connection');

    extWs.isAlive = true;
    extWs.subscribedWorkspaces = new Set();
    extWs.authenticated = true;

    // Handle pong messages
    extWs.on('pong', () => {
      extWs.isAlive = true;
    });

    // Handle incoming messages
    extWs.on('message', (data: Buffer) => {
      handleMessage(extWs, data);
    });

    // Handle disconnection
    extWs.on('close', (code, reason) => {
      console.log(`WebSocket connection closed: ${code} ${reason.toString()}`);
      extWs.subscribedWorkspaces.clear();
    });

    // Handle errors
    extWs.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Heartbeat to detect broken connections
  heartbeatInterval = setInterval(() => {
    if (!wss) return;

    wss.clients.forEach((ws: WebSocket) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        extWs.subscribedWorkspaces.clear();
        return ws.terminate();
      }

      extWs.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  console.log('WebSocket server initialized');
  return wss;
}

/**
 * Handle incoming WebSocket message with validation
 */
function handleMessage(ws: ExtendedWebSocket, data: Buffer): void {
  try {
    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      sendError(ws, 'Invalid JSON');
      return;
    }

    // Validate against schema
    const result = ClientEventSchema.safeParse(parsed);
    if (!result.success) {
      sendError(ws, `Invalid message format: ${result.error.message}`);
      return;
    }

    const event = result.data;
    handleClientEvent(ws, event);
  } catch (error) {
    console.error('Error handling WebSocket message:', error);
    sendError(ws, 'Internal error');
  }
}

/**
 * Send error message to client
 */
function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message },
    }));
  }
}

/**
 * Handle validated client events
 */
function handleClientEvent(ws: ExtendedWebSocket, event: ClientToServerEvent): void {
  switch (event.type) {
    case 'focus_workspace':
      console.log(`Client focused on workspace: ${event.data.workspaceId}`);
      break;

    case 'subscribe_workspace':
      // Limit subscriptions per client
      if (ws.subscribedWorkspaces.size >= 50) {
        sendError(ws, 'Too many workspace subscriptions');
        return;
      }
      ws.subscribedWorkspaces.add(event.data.workspaceId);
      console.log(`Client subscribed to workspace: ${event.data.workspaceId}`);
      break;

    case 'unsubscribe_workspace':
      ws.subscribedWorkspaces.delete(event.data.workspaceId);
      console.log(`Client unsubscribed from workspace: ${event.data.workspaceId}`);
      break;

    case 'terminal_input':
      // Send input to the PTY process
      const inputSent = sendToAgent(event.data.sessionId, event.data.data);
      if (!inputSent) {
        sendError(ws, 'Failed to send input to terminal');
      }
      break;

    case 'terminal_resize':
      // Resize the PTY
      const resized = resizeTerminal(event.data.sessionId, event.data.cols, event.data.rows);
      if (!resized) {
        console.warn(`Failed to resize terminal for session ${event.data.sessionId}`);
      }
      break;

    case 'user_terminal_input':
      // Send input to the user terminal PTY process
      const userInputSent = sendToUserTerminal(event.data.terminalId, event.data.data);
      if (!userInputSent) {
        sendError(ws, 'Failed to send input to user terminal');
      }
      break;

    case 'user_terminal_resize':
      // Resize the user terminal PTY
      const userResized = resizeUserTerminal(event.data.terminalId, event.data.cols, event.data.rows);
      if (!userResized) {
        console.warn(`Failed to resize user terminal ${event.data.terminalId}`);
      }
      break;

    default:
      // This should never happen due to validation, but TypeScript needs it
      const _exhaustive: never = event;
      console.warn('Unknown event type:', _exhaustive);
  }
}

/**
 * Broadcast event to all connected clients
 */
export function broadcastEvent(event: ServerToClientEvent): void {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify(event);

  wss.clients.forEach((ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    if (ws.readyState === WebSocket.OPEN && extWs.authenticated) {
      ws.send(message);
    }
  });
}

/**
 * Send event to clients subscribed to a specific workspace
 */
export function broadcastToWorkspace(workspaceId: string, event: ServerToClientEvent): void {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify(event);
  let sentCount = 0;

  wss.clients.forEach((ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    if (
      ws.readyState === WebSocket.OPEN &&
      extWs.authenticated &&
      extWs.subscribedWorkspaces.has(workspaceId)
    ) {
      ws.send(message);
      sentCount++;
    }
  });

  console.log(`[WS] Broadcast ${event.type} to workspace ${workspaceId}: ${sentCount} clients`);
}

/**
 * Close WebSocket server and all connections
 */
export function closeWebSocketServer(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (wss) {
    // Close all client connections
    wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });

    wss.close();
    wss = null;
  }
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}
