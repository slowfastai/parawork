/**
 * Filesystem API routes for directory browsing and file listing
 */
import { Router } from 'express';
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import type { ApiResponse, BrowseResponse, FileListResponse, FileEntry } from '@parawork/shared';
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

    // Log the actual error details
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
    }

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

/**
 * GET /api/fs/list
 * List files and directories in a path (for file explorer)
 * Query params: path (required)
 */
router.get('/list', async (req, res) => {
  try {
    const requestedPath = req.query.path as string;

    if (!requestedPath) {
      const response: ApiResponse = {
        success: false,
        error: 'Path is required',
      };
      return res.status(400).json(response);
    }

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

    // List directory contents
    const dirEntries = await readdir(normalizedPath, { withFileTypes: true });

    // Filter hidden files and common non-essential directories
    const hiddenPatterns = ['.git', 'node_modules', '.DS_Store', '__pycache__', '.venv', '.cache'];
    const filteredEntries = dirEntries.filter(entry => {
      // Allow showing hidden files except specific ones
      if (entry.name.startsWith('.')) {
        // Show dotfiles like .env, .gitignore but hide .git folder
        return !hiddenPatterns.includes(entry.name);
      }
      return !hiddenPatterns.includes(entry.name);
    });

    // Sort: directories first, then files, both alphabetically
    filteredEntries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    // Get stats for each entry
    const entries: FileEntry[] = [];

    for (const entry of filteredEntries.slice(0, 500)) {
      const fullPath = join(normalizedPath, entry.name);
      try {
        const stats = await stat(fullPath);
        entries.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: entry.isFile() ? stats.size : undefined,
          lastModified: stats.mtimeMs,
        });
      } catch {
        // Skip entries we can't stat
      }
    }

    const response: ApiResponse<FileListResponse> = {
      success: true,
      data: {
        currentPath: normalizedPath,
        entries,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error listing files:', error);

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
      error: 'Failed to list files',
    };
    res.status(500).json(response);
  }
});

export default router;
