/**
 * Filesystem API routes for directory browsing
 */
import { Router } from 'express';
import type { ApiResponse, BrowseResponse } from '@parawork/shared';
import { BrowseRequestSchema } from '@parawork/shared';
import { validateBrowsePath } from '../../utils/validation.js';
import { listDirectories, getParentPath } from '../../utils/filesystem.js';
import { homedir } from 'os';

const router = Router();

/**
 * GET /api/fs/browse
 * Browse directories with git detection
 * Query params: path (optional, defaults to home directory)
 */
router.get('/browse', async (req, res) => {
  try {
    // Validate query parameters
    const validation = BrowseRequestSchema.safeParse(req.query);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.message,
      };
      return res.status(400).json(response);
    }

    // Get path from query or default to home directory
    const requestedPath = validation.data.path || '~';

    // Validate path
    const pathValidation = validateBrowsePath(requestedPath);

    if (!pathValidation.valid) {
      const response: ApiResponse = {
        success: false,
        error: pathValidation.error,
      };
      return res.status(400).json(response);
    }

    const normalizedPath = pathValidation.normalized!;

    // List directories
    const entries = await listDirectories(normalizedPath);

    // Get parent path
    const parentPath = getParentPath(normalizedPath);

    // Build response
    const response: ApiResponse<BrowseResponse> = {
      success: true,
      data: {
        currentPath: normalizedPath,
        parentPath,
        entries,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error browsing directory:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        const response: ApiResponse = {
          success: false,
          error: 'Permission denied',
        };
        return res.status(403).json(response);
      }

      if (error.message.includes('ENOENT')) {
        const response: ApiResponse = {
          success: false,
          error: 'Directory not found',
        };
        return res.status(404).json(response);
      }
    }

    const response: ApiResponse = {
      success: false,
      error: 'Failed to browse directory',
    };
    res.status(500).json(response);
  }
});

export default router;
