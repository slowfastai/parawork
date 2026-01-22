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
  SessionHistoryItem,
  ConversationEvent,
} from '@parawork/shared';
import { stopAgent, startAgent, sendToAgent } from '../../agents/monitor.js';
import { getConfig } from '../../config/settings.js';

const router = Router();

/**
 * GET /api/workspaces/:id/sessions
 * Get all sessions for a workspace
 */
router.get('/workspaces/:id/sessions', (req, res) => {
  try {
    const sessions = sessionQueries.getByWorkspaceId(req.params.id);

    const response: ApiResponse<Session[]> = {
      success: true,
      data: sessions,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch sessions',
    };
    res.status(500).json(response);
  }
});

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

    // Start agent process
    const config = getConfig();
    const agentConfig = config.agents[agentType];

    if (!agentConfig || !agentConfig.enabled) {
      const response: ApiResponse = {
        success: false,
        error: `Agent type ${agentType} is not enabled`,
      };
      return res.status(400).json(response);
    }

    const started = startAgent(
      session.id,
      workspaceId,
      agentType,
      workspace.path,
      agentConfig.command,
      agentConfig.defaultArgs
    );

    if (!started) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to start agent process',
      };
      return res.status(500).json(response);
    }

    // Fetch the updated session (startAgent updates status to 'running')
    const updatedSession = sessionQueries.getById(session.id);

    const response: ApiResponse<Session> = {
      success: true,
      data: updatedSession || created,
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

    // Kill the agent process (graceful shutdown with SIGTERM, then SIGKILL if needed)
    const stopped = stopAgent(session.id);

    if (!stopped) {
      console.warn(`No active process found for session ${session.id}, updating database anyway`);
    }

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
 * POST /api/sessions/:id/input
 * Send input to running session
 */
router.post('/sessions/:id/input', (req, res) => {
  try {
    const session = sessionQueries.getById(req.params.id);

    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }

    if (session.status !== 'running') {
      const response: ApiResponse = {
        success: false,
        error: 'Session is not running',
      };
      return res.status(400).json(response);
    }

    const { input } = req.body;
    if (typeof input !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'Input must be a string',
      };
      return res.status(400).json(response);
    }

    const sent = sendToAgent(session.id, input);

    if (!sent) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to send input to agent',
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: null,
    };
    res.json(response);
  } catch (error) {
    console.error('Error sending input to session:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to send input',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/sessions/:id/open-terminal
 * Open session in native Terminal.app (macOS)
 */
router.post('/sessions/:id/open-terminal', (req, res) => {
  try {
    const session = sessionQueries.getById(req.params.id);

    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }

    const workspace = workspaceQueries.getById(session.workspaceId);
    if (!workspace) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace not found',
      };
      return res.status(404).json(response);
    }

    // Get agent config
    const config = getConfig();
    const agentConfig = config.agents[session.agentType];
    if (!agentConfig || !agentConfig.enabled) {
      const response: ApiResponse = {
        success: false,
        error: 'Agent not configured',
      };
      return res.status(400).json(response);
    }

    // Build command to run in Terminal
    const command = agentConfig.command;
    const args = agentConfig.defaultArgs || [];
    const fullCommand = [command, ...args].join(' ');

    // AppleScript to open Terminal and run command
    const script = `
      tell application "Terminal"
        activate
        do script "cd ${workspace.path.replace(/"/g, '\\"')} && ${fullCommand}"
      end tell
    `;

    // Execute AppleScript
    const { execSync } = require('child_process');
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

    const response: ApiResponse = {
      success: true,
      data: null,
    };
    res.json(response);
  } catch (error) {
    console.error('Error opening terminal:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to open terminal',
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

    // Send message to agent process
    const sent = sendToAgent(session.id, validation.data.content);
    if (!sent) {
      console.warn(`Failed to send message to agent for session ${session.id}`);
    }

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

/**
 * GET /api/workspaces/:id/sessions/history
 * Get completed sessions with metadata
 */
router.get('/workspaces/:id/sessions/history', (req, res) => {
  try {
    const sessions = sessionQueries.getCompletedByWorkspaceId(req.params.id);
    const response: ApiResponse<SessionHistoryItem[]> = {
      success: true,
      data: sessions,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching session history:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch session history',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/sessions/:id/full-conversation
 * Get complete conversation timeline
 */
router.get('/sessions/:id/full-conversation', (req, res) => {
  try {
    const conversation = sessionQueries.getFullConversation(req.params.id);
    const response: ApiResponse<ConversationEvent[]> = {
      success: true,
      data: conversation,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch conversation',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/sessions/:id/resume
 * Resume a session with historical context
 */
router.post('/sessions/:id/resume', async (req, res) => {
  try {
    const originalSession = sessionQueries.getById(req.params.id);
    if (!originalSession) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }

    // Check if workspace already has active session
    const activeSession = sessionQueries.getActiveByWorkspaceId(originalSession.workspaceId);
    if (activeSession) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace already has an active session',
      };
      return res.status(400).json(response);
    }

    // Create new session with context from original
    const newSessionId = uuidv4();
    const newSession: Session = {
      id: newSessionId,
      workspaceId: originalSession.workspaceId,
      agentType: originalSession.agentType,
      status: 'starting',
      processId: null,
      startedAt: null,
      completedAt: null,
    };

    const created = sessionQueries.create(newSession);
    
    // Copy messages to new session for context
    const originalMessages = messageQueries.getBySessionId(req.params.id);
    for (const message of originalMessages) {
      const contextMessage: Message = {
        ...message,
        id: uuidv4(),
        sessionId: newSessionId,
      };
      messageQueries.create(contextMessage);
    }

    // Get workspace and agent config for starting agent
    const workspace = workspaceQueries.getById(originalSession.workspaceId);
    if (!workspace) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace not found',
      };
      return res.status(404).json(response);
    }

    const config = getConfig();
    const agentConfig = config.agents[originalSession.agentType];
    if (!agentConfig || !agentConfig.enabled) {
      const response: ApiResponse = {
        success: false,
        error: 'Agent not enabled',
      };
      return res.status(400).json(response);
    }

    // Start the agent process
    const started = startAgent(
      newSessionId,
      originalSession.workspaceId,
      originalSession.agentType,
      workspace.path,
      agentConfig.command,
      agentConfig.defaultArgs
    );

    if (!started) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to start agent process',
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: created,
    };
    res.json(response);
  } catch (error) {
    console.error('Error resuming session:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to resume session',
    };
    res.status(500).json(response);
  }
});

export default router;
