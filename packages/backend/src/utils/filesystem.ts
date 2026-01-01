/**
 * Filesystem utilities for directory browsing and git detection
 */
import { readdir, stat } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DirectoryEntry, GitInfo } from '@parawork/shared';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Get git branch for a directory
 */
async function getGitBranch(dirPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', dirPath, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { timeout: 500 }
    );
    return stdout.trim() || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get git remote URL for a directory
 */
async function getGitRemote(dirPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git -C "${dirPath}" config --get remote.origin.url`,
      { timeout: 500 }
    );
    return stdout.trim() || null;
  } catch (error) {
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

  // Get branch and remote in parallel
  try {
    const [branch, remote] = await Promise.all([
      getGitBranch(dirPath),
      getGitRemote(dirPath),
    ]);

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

    // Filter to only directories
    const directories = entries.filter(entry => entry.isDirectory());

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

        const entry: DirectoryEntry = {
          name: dir.name,
          path: fullPath,
          isDirectory: true,
          isGitRepository: gitInfo !== null,
          lastModified: stats.mtimeMs,
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

    const results = await Promise.all(directoryPromises);

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
