/**
 * Validation utilities
 */
import { existsSync, statSync } from 'fs';
import { resolve, normalize, isAbsolute } from 'path';

/**
 * Validate a workspace path
 * - Must be an absolute path
 * - Must exist
 * - Must be a directory
 * - Cannot contain path traversal attempts
 * - Cannot be a system directory
 */
export function validateWorkspacePath(path: string): { valid: boolean; error?: string } {
  // Must be a non-empty string
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Path is required' };
  }

  // Trim whitespace
  const trimmedPath = path.trim();

  // Check for path traversal attempts
  if (trimmedPath.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' };
  }

  // Must be an absolute path
  if (!isAbsolute(trimmedPath)) {
    return { valid: false, error: 'Path must be absolute (start with /)' };
  }

  // Normalize the path
  const normalizedPath = normalize(trimmedPath);

  // Block system directories
  const blockedPaths = [
    '/etc',
    '/var',
    '/usr',
    '/bin',
    '/sbin',
    '/lib',
    '/boot',
    '/dev',
    '/proc',
    '/sys',
    '/root',
    '/System',
    '/Library',
    '/Applications',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ];

  const lowerPath = normalizedPath.toLowerCase();
  for (const blocked of blockedPaths) {
    if (lowerPath === blocked.toLowerCase() || lowerPath.startsWith(blocked.toLowerCase() + '/')) {
      return { valid: false, error: 'System directories are not allowed' };
    }
  }

  // Check if path exists
  if (!existsSync(normalizedPath)) {
    return { valid: false, error: 'Path does not exist' };
  }

  // Check if path is a directory
  try {
    const stats = statSync(normalizedPath);
    if (!stats.isDirectory()) {
      return { valid: false, error: 'Path must be a directory' };
    }
  } catch (error) {
    return { valid: false, error: 'Cannot access path' };
  }

  return { valid: true };
}

/**
 * Sanitize a string for safe display
 * Removes control characters and limits length
 */
export function sanitizeForDisplay(str: string, maxLength: number = 10000): string {
  if (!str) return '';

  // Remove control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  const sanitized = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength) + '... [truncated]';
  }

  return sanitized;
}

/**
 * Validate agent command (whitelist approach)
 */
export function validateAgentCommand(command: string): boolean {
  const allowedCommands = [
    'claude',
    'codex',
    'aider',
    'continue',
  ];

  // Get the base command name (handle paths like /usr/local/bin/claude)
  const baseName = command.split('/').pop()?.split('\\').pop() || '';

  return allowedCommands.includes(baseName.toLowerCase());
}
