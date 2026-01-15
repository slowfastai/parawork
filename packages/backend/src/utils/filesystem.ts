/**
 * Filesystem utilities for directory browsing and git detection
 */
import { readdir, stat } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { DirectoryEntry, GitInfo } from '@parawork/shared';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

/**
 * Get git branch for a directory
 */
async function getGitBranch(dirPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', dirPath, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { timeout: 1000 }
    );
    return stdout.trim() || null;
  } catch (error) {
    // Git command failed - not a git repo or no permission
    return null;
  }
}

/**
 * Get git remote URL for a directory
 */
async function getGitRemote(dirPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', dirPath, 'config', '--get', 'remote.origin.url'],
      { timeout: 1000 }
    );
    return stdout.trim() || null;
  } catch (error) {
    // Git command failed - not a git repo or no permission
    return null;
  }
}

/**
 * Get git information for a directory
 */
export async function getGitInfo(dirPath: string): Promise<GitInfo | null> {
  // Quick check: does .git directory exist?
  const gitDir = join(dirPath, '.git');
  if (!existsSync(gitDir)) {
    return null;
  }

  // Get branch and remote in parallel with individual error handling
  try {
    const branchPromise = getGitBranch(dirPath);
    const remotePromise = getGitRemote(dirPath);

    const [branch, remote] = await Promise.all([
      branchPromise.catch(() => null),
      remotePromise.catch(() => null),
    ]);

    // Only return git info if we found at least some info
    return { branch, remote };
  } catch (error) {
    return null;
  }
}

/**
 * List directories in a path with git detection
 */
export async function listDirectories(dirPath: string): Promise<DirectoryEntry[]> {
  try {
    // Read directory contents
    const entries = await readdir(dirPath, { withFileTypes: true });

    // Filter to only directories (exclude hidden directories starting with .)
    const directories = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));

    // Sort alphabetically (case-insensitive)
    directories.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    // Limit to 500 directories
    const limitedDirs = directories.slice(0, 500);

    // Get stats and git info for each directory in parallel
    const directoryPromises = limitedDirs.map(async (dir) => {
      const fullPath = join(dirPath, dir.name);

      try {
        const stats = await stat(fullPath);
        const gitInfo = await getGitInfo(fullPath);

        // Count items in directory
        let itemCount: number | undefined;
        try {
          const items = await readdir(fullPath);
          itemCount = items.length;
        } catch (error) {
          // If we can't read the directory, skip item count
          itemCount = undefined;
        }

        const entry: DirectoryEntry = {
          name: dir.name,
          path: fullPath,
          isDirectory: true,
          isGitRepository: gitInfo !== null,
          lastModified: stats.mtimeMs,
          itemCount,
        };

        if (gitInfo) {
          entry.gitInfo = gitInfo;
        }

        return entry;
      } catch (error) {
        // Skip directories we can't access
        return null;
      }
    });

    const results: (DirectoryEntry | null)[] = await Promise.all(directoryPromises).catch((error) => {
      console.error('Error processing directories:', error);
      return [];
    });

    // Filter out null entries (directories we couldn't access)
    return results.filter((entry): entry is DirectoryEntry => entry !== null);
  } catch (error) {
    throw new Error(`Failed to list directories: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get parent path of a directory
 */
export function getParentPath(dirPath: string): string | null {
  const parent = dirname(dirPath);

  // If parent is the same as current (we're at root), return null
  if (parent === dirPath) {
    return null;
  }

  return parent;
}
