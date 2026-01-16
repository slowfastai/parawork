/**
 * User Terminal API routes
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { workspaceQueries } from '../../db/queries.js';
import {
  startUserTerminal,
  stopUserTerminal,
  getWorkspaceTerminalId,
} from '../../agents/userTerminal.js';
import type { ApiResponse } from '@parawork/shared';

const router = Router();

/**
 * POST /api/workspaces/:id/terminal
 * Start user terminal for workspace
 */
router.post('/workspaces/:id/terminal', (req, res) => {
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

    // Check if terminal already exists
    const existingId = getWorkspaceTerminalId(workspaceId);

    if (existingId) {
      console.log(`[Terminal] Returning existing terminal for workspace ${workspaceId}`);
      const response: ApiResponse<{ terminalId: string; existing: boolean }> = {
        success: true,
        data: { terminalId: existingId, existing: true },
      };
      return res.json(response);
    }

    const terminalId = uuidv4();
    const shell = req.body.shell; // Optional: allow specifying shell

    console.log(`[Terminal] Starting new terminal for workspace ${workspaceId}`);
    const started = startUserTerminal(terminalId, workspaceId, workspace.path, shell);

    if (!started) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to start terminal',
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse<{ terminalId: string; existing: boolean }> = {
      success: true,
      data: { terminalId, existing: false },
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error starting terminal:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to start terminal',
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/workspaces/:id/terminal
 * Stop user terminal for workspace
 */
router.delete('/workspaces/:id/terminal', (req, res) => {
  try {
    const workspaceId = req.params.id;
    const terminalId = getWorkspaceTerminalId(workspaceId);

    if (!terminalId) {
      const response: ApiResponse = {
        success: false,
        error: 'No terminal found for workspace',
      };
      return res.status(404).json(response);
    }

    stopUserTerminal(terminalId);

    const response: ApiResponse = {
      success: true,
      data: null,
    };
    res.json(response);
  } catch (error) {
    console.error('Error stopping terminal:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to stop terminal',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/workspaces/:id/terminal
 * Get terminal status for workspace
 */
router.get('/workspaces/:id/terminal', (req, res) => {
  try {
    const workspaceId = req.params.id;
    const terminalId = getWorkspaceTerminalId(workspaceId);

    const response: ApiResponse<{ terminalId?: string; active: boolean }> = {
      success: true,
      data: terminalId ? { terminalId, active: true } : { active: false },
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting terminal status:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to get terminal status',
    };
    res.status(500).json(response);
  }
});

export default router;
