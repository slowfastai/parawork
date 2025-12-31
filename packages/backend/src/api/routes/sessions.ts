/**
 * Session API routes
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  sessionQueries,
  workspaceQueries,
  messageQueries,
  fileChangeQueries,
  agentLogQueries,
} from '../../db/queries.js';
import { CreateSessionRequestSchema, SendMessageRequestSchema } from '@parawork/shared';
import type {
  ApiResponse,
  Session,
  Message,
  FileChange,
  AgentLog,
} from '@parawork/shared';

const router = Router();

/**
 * POST /api/workspaces/:id/sessions
 * Start new session in workspace
 */
router.post('/workspaces/:id/sessions', async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const workspace = workspaceQueries.getById(workspaceId);

    if (!workspace) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace not found',
      };
      return res.status(404).json(response);
    }

    // Check if there's already an active session
    const activeSession = sessionQueries.getActiveByWorkspaceId(workspaceId);
    if (activeSession) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace already has an active session',
      };
      return res.status(400).json(response);
    }

    const validation = CreateSessionRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.message,
      };
      return res.status(400).json(response);
    }

    const { agentType, initialPrompt } = validation.data;

    const session: Session = {
      id: uuidv4(),
      workspaceId,
      agentType,
      status: 'starting',
      processId: null,
      startedAt: Date.now(),
      completedAt: null,
    };

    const created = sessionQueries.create(session);

    // Update workspace status
    workspaceQueries.update(workspaceId, {
      status: 'running',
      agentType,
    });

    // If there's an initial prompt, create a user message
    if (initialPrompt) {
      const message: Message = {
        id: uuidv4(),
        sessionId: session.id,
        role: 'user',
        content: initialPrompt,
        timestamp: Date.now(),
      };
      messageQueries.create(message);
    }

    // TODO: Start agent process here
    // For now, just return the session

    const response: ApiResponse<Session> = {
      success: true,
      data: created,
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating session:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create session',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/sessions/:id
 * Get session details
 */
router.get('/sessions/:id', (req, res) => {
  try {
    const session = sessionQueries.getById(req.params.id);

    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching session:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch session',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/sessions/:id/stop
 * Stop running session
 */
router.post('/sessions/:id/stop', (req, res) => {
  try {
    const session = sessionQueries.getById(req.params.id);

    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }

    // TODO: Kill the agent process

    // Update session status
    const updated = sessionQueries.update(session.id, {
      status: 'failed',
      completedAt: Date.now(),
    });

    // Update workspace status
    workspaceQueries.update(session.workspaceId, {
      status: 'idle',
    });

    const response: ApiResponse<Session> = {
      success: true,
      data: updated!,
    };
    res.json(response);
  } catch (error) {
    console.error('Error stopping session:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to stop session',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/sessions/:id/logs
 * Get session logs
 */
router.get('/sessions/:id/logs', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const logs = agentLogQueries.getBySessionId(req.params.id, limit);

    const response: ApiResponse<AgentLog[]> = {
      success: true,
      data: logs,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching logs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch logs',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/sessions/:id/messages
 * Get conversation history
 */
router.get('/sessions/:id/messages', (req, res) => {
  try {
    const messages = messageQueries.getBySessionId(req.params.id);

    const response: ApiResponse<Message[]> = {
      success: true,
      data: messages,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching messages:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch messages',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/sessions/:id/messages
 * Send message to agent
 */
router.post('/sessions/:id/messages', (req, res) => {
  try {
    const session = sessionQueries.getById(req.params.id);

    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }

    const validation = SendMessageRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.message,
      };
      return res.status(400).json(response);
    }

    const message: Message = {
      id: uuidv4(),
      sessionId: session.id,
      role: 'user',
      content: validation.data.content,
      timestamp: Date.now(),
    };

    const created = messageQueries.create(message);

    // TODO: Send message to agent process

    const response: ApiResponse<Message> = {
      success: true,
      data: created,
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error sending message:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to send message',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/sessions/:id/changes
 * Get files changed by agent
 */
router.get('/sessions/:id/changes', (req, res) => {
  try {
    const changes = fileChangeQueries.getBySessionId(req.params.id);

    const response: ApiResponse<FileChange[]> = {
      success: true,
      data: changes,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching changes:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch changes',
    };
    res.status(500).json(response);
  }
});

export default router;
