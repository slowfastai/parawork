/**
 * Validation utilities
 */
import { existsSync, statSync, accessSync, constants } from 'fs';
import { resolve, normalize, isAbsolute } from 'path';
import { homedir } from 'os';

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
 * Validate a path for directory browsing
 * More permissive than validateWorkspacePath:
 * - Allows tilde (~) expansion
 * - Allows user directories
 * - Blocks only critical system directories
 */
export function validateBrowsePath(path: string): {
  valid: boolean;
  error?: string;
  normalized?: string;
} {
  // Must be a non-empty string
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Path is required' };
  }

  // Trim whitespace
  let trimmedPath = path.trim();

  // Expand tilde to home directory
  if (trimmedPath === '~' || trimmedPath.startsWith('~/')) {
    trimmedPath = trimmedPath.replace(/^~/, homedir());
  }

  // Check for path traversal attempts
  if (trimmedPath.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' };
  }

  // Must be an absolute path after tilde expansion
  if (!isAbsolute(trimmedPath)) {
    return { valid: false, error: 'Path must be absolute' };
  }

  // Normalize the path
  const normalizedPath = normalize(trimmedPath);

  // Block only critical system directories
  const criticalSystemPaths = [
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
    '/System/Library',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ];

  const lowerPath = normalizedPath.toLowerCase();
  for (const blocked of criticalSystemPaths) {
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

  // Check read permissions
  try {
    accessSync(normalizedPath, constants.R_OK);
  } catch (error) {
    return { valid: false, error: 'No read permission for this directory' };
  }

  return { valid: true, normalized: normalizedPath };
}

/**
 * Sanitize a string for safe display
 * Removes control characters and limits length
 */
export function sanitizeForDisplay(str: string, maxLength: number = 10000): string {
  if (!str) return '';

  // Strip ANSI escape sequences (including common cases missing ESC due to prior sanitization)
  let sanitized = str
    // OSC (Operating System Command) sequences
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    // CSI (Control Sequence Introducer) sequences
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    // 2-character escape sequences
    .replace(/\x1B[@-Z\\-_]/g, '')
    // CSI artifacts without ESC (e.g. "[31m")
    .replace(/\[(?:[0-9;?=>]{1,}[ -/]*[@-~])/g, '');

  // Remove control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

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
    'opencode',
  ];

  // Get the base command name (handle paths like /usr/local/bin/claude)
  const baseName = command.split('/').pop()?.split('\\').pop() || '';

  return allowedCommands.includes(baseName.toLowerCase());
}
