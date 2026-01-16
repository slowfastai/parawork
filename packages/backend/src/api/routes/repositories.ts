/**
 * Repository API routes
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { repositoryQueries } from '../../db/queries.js';
import { CreateRepositoryRequestSchema, UpdateRepositoryRequestSchema } from '@parawork/shared';
import type { ApiResponse, Repository } from '@parawork/shared';
import { isGitRepository, getGitInfo } from '../../utils/git.js';
import { validateWorkspacePath } from '../../utils/validation.js';

const router = Router();

/**
 * GET /api/repositories
 * List all repositories
 */
router.get('/', (req, res) => {
  try {
    const repositories = repositoryQueries.getAll();
    const response: ApiResponse<Repository[]> = {
      success: true,
      data: repositories,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch repositories',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/repositories
 * Add a new repository
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body schema
    const validation = CreateRepositoryRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.message,
      };
      return res.status(400).json(response);
    }

    const { name, path } = validation.data;

    // Validate path (security check)
    const pathValidation = validateWorkspacePath(path);
    if (!pathValidation.valid) {
      const response: ApiResponse = {
        success: false,
        error: `Invalid path: ${pathValidation.error}`,
      };
      return res.status(400).json(response);
    }

    // Check if path is a git repository
    const isGitRepo = await isGitRepository(path);
    if (!isGitRepo) {
      const response: ApiResponse = {
        success: false,
        error: 'Selected directory is not a git repository',
      };
      return res.status(400).json(response);
    }

    // Check if repository already exists
    const existing = repositoryQueries.getByPath(path);
    if (existing) {
      const response: ApiResponse = {
        success: false,
        error: 'Repository already added',
      };
      return res.status(409).json(response);
    }

    // Get git info
    const gitInfo = await getGitInfo(path);
    const now = Date.now();

    const repository: Repository = {
      id: uuidv4(),
      name,
      path,
      defaultBranch: gitInfo.branch || 'main',
      remoteUrl: gitInfo.remote,
      createdAt: now,
      updatedAt: now,
    };

    const created = repositoryQueries.create(repository);
    const response: ApiResponse<Repository> = {
      success: true,
      data: created,
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating repository:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create repository',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/repositories/:id
 * Get repository details
 */
router.get('/:id', (req, res) => {
  try {
    const repository = repositoryQueries.getById(req.params.id);

    if (!repository) {
      const response: ApiResponse = {
        success: false,
        error: 'Repository not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Repository> = {
      success: true,
      data: repository,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching repository:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch repository',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/repositories/:id/workspaces
 * Get workspaces belonging to a repository
 */
router.get('/:id/workspaces', (req, res) => {
  try {
    const repository = repositoryQueries.getById(req.params.id);

    if (!repository) {
      const response: ApiResponse = {
        success: false,
        error: 'Repository not found',
      };
      return res.status(404).json(response);
    }

    const workspaces = repositoryQueries.getWorkspaces(req.params.id);
    const response: ApiResponse = {
      success: true,
      data: workspaces,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching repository workspaces:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch repository workspaces',
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /api/repositories/:id
 * Update repository
 */
router.patch('/:id', (req, res) => {
  try {
    const validation = UpdateRepositoryRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.message,
      };
      return res.status(400).json(response);
    }

    const updated = repositoryQueries.update(req.params.id, validation.data);

    if (!updated) {
      const response: ApiResponse = {
        success: false,
        error: 'Repository not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Repository> = {
      success: true,
      data: updated,
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating repository:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update repository',
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/repositories/:id
 * Remove repository (workspaces are set to null via ON DELETE SET NULL)
 */
router.delete('/:id', (req, res) => {
  try {
    const repository = repositoryQueries.getById(req.params.id);

    if (!repository) {
      const response: ApiResponse = {
        success: false,
        error: 'Repository not found',
      };
      return res.status(404).json(response);
    }

    const deleted = repositoryQueries.delete(req.params.id);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: 'Repository not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
    };
    res.json(response);
  } catch (error) {
    console.error('Error deleting repository:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete repository',
    };
    res.status(500).json(response);
  }
});

export default router;
