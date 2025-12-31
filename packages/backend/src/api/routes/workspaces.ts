/**
 * Workspace API routes
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { workspaceQueries } from '../../db/queries.js';
import { CreateWorkspaceRequestSchema, UpdateWorkspaceRequestSchema } from '@parawork/shared';
import type { ApiResponse, Workspace } from '@parawork/shared';
import { validateWorkspacePath } from '../../utils/validation.js';

const router = Router();

/**
 * GET /api/workspaces
 * List all workspaces
 */
router.get('/', (req, res) => {
  try {
    const workspaces = workspaceQueries.getAll();
    const response: ApiResponse<Workspace[]> = {
      success: true,
      data: workspaces,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch workspaces',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/workspaces
 * Create a new workspace
 */
router.post('/', (req, res) => {
  try {
    // Validate request body schema
    const validation = CreateWorkspaceRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.message,
      };
      return res.status(400).json(response);
    }

    const { name, path, agentType } = validation.data;

    // Validate workspace path (security check)
    const pathValidation = validateWorkspacePath(path);
    if (!pathValidation.valid) {
      const response: ApiResponse = {
        success: false,
        error: `Invalid path: ${pathValidation.error}`,
      };
      return res.status(400).json(response);
    }

    const now = Date.now();

    const workspace: Workspace = {
      id: uuidv4(),
      name,
      path,
      status: 'idle',
      agentType: agentType || null,
      createdAt: now,
      updatedAt: now,
      lastFocusedAt: now, // Set as focused when created
    };

    const created = workspaceQueries.create(workspace);
    const response: ApiResponse<Workspace> = {
      success: true,
      data: created,
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating workspace:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create workspace',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/workspaces/:id
 * Get workspace details
 */
router.get('/:id', (req, res) => {
  try {
    const workspace = workspaceQueries.getById(req.params.id);

    if (!workspace) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Workspace> = {
      success: true,
      data: workspace,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch workspace',
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /api/workspaces/:id
 * Update workspace (e.g., set as focused)
 */
router.patch('/:id', (req, res) => {
  try {
    const validation = UpdateWorkspaceRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.message,
      };
      return res.status(400).json(response);
    }

    const updated = workspaceQueries.update(req.params.id, validation.data);

    if (!updated) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Workspace> = {
      success: true,
      data: updated,
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating workspace:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update workspace',
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/workspaces/:id
 * Delete workspace
 */
router.delete('/:id', (req, res) => {
  try {
    const deleted = workspaceQueries.delete(req.params.id);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
    };
    res.json(response);
  } catch (error) {
    console.error('Error deleting workspace:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete workspace',
    };
    res.status(500).json(response);
  }
});

export default router;
