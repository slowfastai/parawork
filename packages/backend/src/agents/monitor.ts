/**
 * Agent process monitoring with proper cleanup and output limits
 */
import { spawn, ChildProcess } from 'child_process';
import { broadcastToWorkspace } from '../api/websocket.js';
import { sessionQueries, workspaceQueries, agentLogQueries } from '../db/queries.js';
import { validateAgentCommand, sanitizeForDisplay } from '../utils/validation.js';
import type { AgentType } from '@parawork/shared';

// Configuration
const MAX_OUTPUT_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer per stream
const MAX_LOG_MESSAGE_LENGTH = 10000; // 10KB max per log message
const GRACEFUL_SHUTDOWN_TIMEOUT = 5000; // 5 seconds

interface MonitoredProcess {
  sessionId: string;
  workspaceId: string;
  process: ChildProcess;
  agentType: AgentType;
  shutdownTimeout?: NodeJS.Timeout;
  outputBuffer: {
    stdout: string;
    stderr: string;
  };
}

const activeProcesses = new Map<string, MonitoredProcess>();

/**
 * Start an agent process
 */
export function startAgent(
  sessionId: string,
  workspaceId: string,
  agentType: AgentType,
  workspacePath: string,
  command: string,
  args: string[]
): boolean {
  console.log(`Starting ${agentType} agent for session ${sessionId}`);

  // Validate command (whitelist check)
  if (!validateAgentCommand(command)) {
    console.error(`Invalid agent command: ${command}`);
    sessionQueries.update(sessionId, {
      status: 'failed',
      completedAt: Date.now(),
    });
    return false;
  }

  let proc: ChildProcess;
  try {
    proc = spawn(command, args, {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  } catch (error) {
    console.error(`Failed to spawn agent process:`, error);
    sessionQueries.update(sessionId, {
      status: 'failed',
      completedAt: Date.now(),
    });
    return false;
  }

  const monitored: MonitoredProcess = {
    sessionId,
    workspaceId,
    process: proc,
    agentType,
    outputBuffer: {
      stdout: '',
      stderr: '',
    },
  };

  activeProcesses.set(sessionId, monitored);

  // Update session with process ID
  sessionQueries.update(sessionId, {
    processId: proc.pid,
    status: 'running',
  });

  // Handle stdout with buffer limits
  proc.stdout?.on('data', (data: Buffer) => {
    handleOutput(monitored, 'info', data);
  });

  // Handle stderr with buffer limits
  proc.stderr?.on('data', (data: Buffer) => {
    handleOutput(monitored, 'error', data);
  });

  // Handle process exit
  proc.on('exit', (code: number | null, signal: string | null) => {
    console.log(`Agent process exited with code ${code} signal ${signal}`);
    cleanupProcess(sessionId, code === 0);
  });

  // Handle errors
  proc.on('error', (error: Error) => {
    console.error(`Agent process error:`, error);
    handleAgentLog(sessionId, workspaceId, 'error', `Process error: ${error.message}`);
    cleanupProcess(sessionId, false);
  });

  return true;
}

/**
 * Handle output from agent with buffer limits
 */
function handleOutput(monitored: MonitoredProcess, level: 'info' | 'error', data: Buffer): void {
  const streamName = level === 'info' ? 'stdout' : 'stderr';
  const currentSize = monitored.outputBuffer[streamName].length;

  // Check buffer size limit
  if (currentSize >= MAX_OUTPUT_BUFFER_SIZE) {
    // Buffer full, drop data but log a warning
    if (currentSize === MAX_OUTPUT_BUFFER_SIZE) {
      handleAgentLog(
        monitored.sessionId,
        monitored.workspaceId,
        'warning',
        `[Output buffer full, some output will be dropped]`
      );
      monitored.outputBuffer[streamName] += '_OVERFLOW_';
    }
    return;
  }

  // Add data to buffer
  const chunk = data.toString();
  monitored.outputBuffer[streamName] += chunk;

  // Process complete lines
  const lines = monitored.outputBuffer[streamName].split('\n');

  // Keep the last incomplete line in the buffer
  monitored.outputBuffer[streamName] = lines.pop() || '';

  // Process complete lines
  for (const line of lines) {
    if (line.trim()) {
      handleAgentLog(monitored.sessionId, monitored.workspaceId, level, line);
    }
  }
}

/**
 * Cleanup process resources
 */
function cleanupProcess(sessionId: string, success: boolean): void {
  const monitored = activeProcesses.get(sessionId);
  if (!monitored) return;

  // Clear any pending shutdown timeout
  if (monitored.shutdownTimeout) {
    clearTimeout(monitored.shutdownTimeout);
  }

  // Flush any remaining output
  if (monitored.outputBuffer.stdout.trim()) {
    handleAgentLog(monitored.sessionId, monitored.workspaceId, 'info', monitored.outputBuffer.stdout);
  }
  if (monitored.outputBuffer.stderr.trim()) {
    handleAgentLog(monitored.sessionId, monitored.workspaceId, 'error', monitored.outputBuffer.stderr);
  }

  const status = success ? 'completed' : 'failed';

  // Update session
  sessionQueries.update(sessionId, {
    status,
    completedAt: Date.now(),
  });

  // Update workspace
  workspaceQueries.update(monitored.workspaceId, {
    status: success ? 'completed' : 'error',
  });

  // Broadcast completion event
  broadcastToWorkspace(monitored.workspaceId, {
    type: 'session_completed',
    data: {
      sessionId,
      workspaceId: monitored.workspaceId,
      success,
      timestamp: Date.now(),
    },
  });

  // Remove from active processes
  activeProcesses.delete(sessionId);
}

/**
 * Stop an agent process
 */
export function stopAgent(sessionId: string): boolean {
  const monitored = activeProcesses.get(sessionId);

  if (!monitored) {
    console.warn(`No active process found for session ${sessionId}`);
    return false;
  }

  console.log(`Stopping agent process for session ${sessionId}`);

  // Try graceful shutdown first
  monitored.process.kill('SIGTERM');

  // Set up force kill timeout
  monitored.shutdownTimeout = setTimeout(() => {
    if (activeProcesses.has(sessionId)) {
      console.log(`Force killing agent process for session ${sessionId}`);
      monitored.process.kill('SIGKILL');
    }
  }, GRACEFUL_SHUTDOWN_TIMEOUT);

  return true;
}

/**
 * Stop all agent processes (for graceful shutdown)
 */
export function stopAllAgents(): void {
  console.log(`Stopping all ${activeProcesses.size} agent processes...`);

  for (const [sessionId, monitored] of activeProcesses.entries()) {
    console.log(`Stopping agent for session ${sessionId}`);
    monitored.process.kill('SIGTERM');
  }

  // Give processes time to exit gracefully
  setTimeout(() => {
    for (const [sessionId, monitored] of activeProcesses.entries()) {
      if (monitored.process.exitCode === null) {
        console.log(`Force killing agent for session ${sessionId}`);
        monitored.process.kill('SIGKILL');
      }
    }
  }, GRACEFUL_SHUTDOWN_TIMEOUT);
}

/**
 * Handle agent log entry
 */
function handleAgentLog(
  sessionId: string,
  workspaceId: string,
  level: 'info' | 'warning' | 'error',
  message: string
): void {
  // Sanitize and limit message length
  const sanitized = sanitizeForDisplay(message, MAX_LOG_MESSAGE_LENGTH);

  // Store in database
  agentLogQueries.create({
    sessionId,
    timestamp: Date.now(),
    level,
    message: sanitized,
  });

  // Broadcast to WebSocket clients
  broadcastToWorkspace(workspaceId, {
    type: 'agent_log',
    data: {
      sessionId,
      workspaceId,
      level,
      message: sanitized,
      timestamp: Date.now(),
    },
  });
}

/**
 * Send input to agent process with error handling
 */
export function sendToAgent(sessionId: string, input: string): boolean {
  const monitored = activeProcesses.get(sessionId);

  if (!monitored) {
    console.warn(`No active process found for session ${sessionId}`);
    return false;
  }

  if (!monitored.process.stdin || monitored.process.stdin.destroyed) {
    console.warn(`stdin not available for session ${sessionId}`);
    return false;
  }

  try {
    const written = monitored.process.stdin.write(input + '\n');
    if (!written) {
      // Handle backpressure
      monitored.process.stdin.once('drain', () => {
        console.log(`stdin drained for session ${sessionId}`);
      });
    }
    return true;
  } catch (error) {
    console.error(`Error writing to stdin for session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): string[] {
  return Array.from(activeProcesses.keys());
}

/**
 * Check if a session is active
 */
export function isSessionActive(sessionId: string): boolean {
  return activeProcesses.has(sessionId);
}
