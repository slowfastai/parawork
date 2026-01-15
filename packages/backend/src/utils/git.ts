/**
 * Git worktree utilities for Parawork
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import { getConfig } from '../config/settings.js';

const execFileAsync = promisify(execFile);

export interface GitWorktreeInfo {
  worktreePath: string;
  branchName: string;
  baseRepoPath: string;
  baseBranch: string;
}

export interface GitWorktreeResult {
  success: boolean;
  info?: GitWorktreeInfo;
  error?: string;
  fallbackToRegular?: boolean; // If true, create regular workspace instead
}

/**
 * Check if directory is a git repository
 */
export async function isGitRepository(path: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['-C', path, 'rev-parse', '--git-dir'], { timeout: 1000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate base repository (check if on main branch, clean working tree)
 * NOTE: Based on user requirements, we DO NOT block if repo is dirty or not on main
 */
export async function validateBaseRepository(path: string): Promise<{ valid: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  try {
    // Check current branch
    const { stdout: branch } = await execFileAsync('git', ['-C', path, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      timeout: 1000,
    });
    const currentBranch = branch.trim();

    if (currentBranch !== 'main' && currentBranch !== 'master') {
      warnings.push(`Base repository is on branch '${currentBranch}', not main/master`);
    }

    // Check for uncommitted changes
    const { stdout: status } = await execFileAsync('git', ['-C', path, 'status', '--porcelain'], {
      timeout: 1000,
    });
    if (status.trim()) {
      warnings.push('Base repository has uncommitted changes');
    }

    return { valid: true, warnings };
  } catch (error) {
    return { valid: false, warnings: ['Failed to validate git repository'] };
  }
}

/**
 * Sanitize workspace name for git branch naming
 * - Replace spaces and special chars with hyphens
 * - Lowercase
 * - Remove consecutive hyphens
 */
export function sanitizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Generate unique branch name if conflict exists
 */
async function generateUniqueBranchName(
  baseRepo: string,
  baseName: string,
  prefix: string
): Promise<string> {
  const sanitized = sanitizeBranchName(baseName);
  const branchName = `${prefix}${sanitized}`;

  // Check if branch exists
  try {
    await execFileAsync('git', ['-C', baseRepo, 'rev-parse', '--verify', branchName], {
      timeout: 1000,
    });
    // Branch exists, append timestamp
    const timestamp = Date.now();
    return `${branchName}-${timestamp}`;
  } catch (error) {
    // Branch doesn't exist, use it
    return branchName;
  }
}

/**
 * Generate unique worktree path if directory exists
 */
function generateUniqueWorktreePath(basePath: string, workspaceName: string): string {
  const sanitized = sanitizeBranchName(workspaceName);
  let worktreePath = join(basePath, sanitized);

  if (!existsSync(worktreePath)) {
    return worktreePath;
  }

  // Path exists, append timestamp
  const timestamp = Date.now();
  return join(basePath, `${sanitized}-${timestamp}`);
}

/**
 * Create git worktree for workspace
 */
export async function createGitWorktree(
  baseRepoPath: string,
  workspaceName: string
): Promise<GitWorktreeResult> {
  const config = getConfig();

  // Check if git integration is enabled
  if (!config.features.gitIntegration) {
    return {
      success: false,
      error: 'Git integration is disabled in config',
      fallbackToRegular: true,
    };
  }

  // Check if base path is a git repo
  const isGitRepo = await isGitRepository(baseRepoPath);
  if (!isGitRepo) {
    return {
      success: false,
      error: 'Selected directory is not a git repository',
      fallbackToRegular: true,
    };
  }

  // Validate base repository (get warnings but don't block)
  const validation = await validateBaseRepository(baseRepoPath);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Failed to validate git repository',
      fallbackToRegular: true,
    };
  }

  // Log warnings but continue
  validation.warnings.forEach(warning => console.warn(`Git worktree warning: ${warning}`));

  try {
    // Get git config (with defaults)
    const worktreeBaseDir = config.git?.worktreeBaseDir || '~/.parawork/workspaces';
    const branchPrefix = config.git?.branchPrefix || 'parawork/';
    const baseBranch = config.git?.baseBranch || 'origin/main';

    // Expand tilde in worktreeBaseDir
    const expandedBaseDir = worktreeBaseDir.replace(/^~/, homedir());

    // Ensure base directory exists
    if (!existsSync(expandedBaseDir)) {
      mkdirSync(expandedBaseDir, { recursive: true });
    }

    // Generate unique branch name
    const branchName = await generateUniqueBranchName(baseRepoPath, workspaceName, branchPrefix);

    // Generate unique worktree path
    const worktreePath = generateUniqueWorktreePath(expandedBaseDir, workspaceName);

    // Create worktree
    // git worktree add -b <branch> <path> <base-branch>
    await execFileAsync(
      'git',
      ['-C', baseRepoPath, 'worktree', 'add', '-b', branchName, worktreePath, baseBranch],
      { timeout: 10000 }
    );

    console.log(`Created git worktree: ${worktreePath} (branch: ${branchName})`);

    return {
      success: true,
      info: {
        worktreePath,
        branchName,
        baseRepoPath: resolve(baseRepoPath),
        baseBranch,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to create git worktree:', errorMessage);

    return {
      success: false,
      error: `Failed to create git worktree: ${errorMessage}`,
      fallbackToRegular: true,
    };
  }
}

/**
 * Remove git worktree and delete branch
 */
export async function cleanupGitWorktree(
  worktreePath: string,
  branchName: string,
  baseRepoPath: string
): Promise<boolean> {
  try {
    // Remove worktree
    await execFileAsync('git', ['-C', baseRepoPath, 'worktree', 'remove', worktreePath, '--force'], {
      timeout: 5000,
    });

    // Delete branch
    await execFileAsync('git', ['-C', baseRepoPath, 'branch', '-D', branchName], {
      timeout: 5000,
    });

    console.log(`Cleaned up git worktree: ${worktreePath} (branch: ${branchName})`);
    return true;
  } catch (error) {
    console.error('Failed to cleanup git worktree:', error);
    return false;
  }
}

/**
 * Get worktree info for existing worktree path
 */
export async function getWorktreeInfo(path: string): Promise<GitWorktreeInfo | null> {
  try {
    // Get current branch
    const { stdout: branchOutput } = await execFileAsync(
      'git',
      ['-C', path, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { timeout: 1000 }
    );
    const branchName = branchOutput.trim();

    // Get worktree root (commondir points to main repo)
    const { stdout: commonDir } = await execFileAsync(
      'git',
      ['-C', path, 'rev-parse', '--git-common-dir'],
      { timeout: 1000 }
    );

    // commondir is .git in main repo, so get parent
    const baseRepoPath = resolve(dirname(commonDir.trim()));

    return {
      worktreePath: path,
      branchName,
      baseRepoPath,
      baseBranch: 'origin/main', // Cannot reliably determine this
    };
  } catch (error) {
    return null;
  }
}
