/**
 * Agent process monitoring with proper cleanup and output limits
 * Uses node-pty for proper PTY support (interactive terminals like Claude Code)
 */
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { broadcastToWorkspace } from '../api/websocket.js';
import { sessionQueries, workspaceQueries, agentLogQueries } from '../db/queries.js';
import { validateAgentCommand, sanitizeForDisplay } from '../utils/validation.js';
import type { AgentType } from '@parawork/shared';

const MAX_OUTPUT_BUFFER_SIZE = 1024 * 1024;
const MAX_LOG_MESSAGE_LENGTH = 10000;
const GRACEFUL_SHUTDOWN_TIMEOUT = 5000;

interface MonitoredProcess {
  sessionId: string;
  workspaceId: string;
  ptyProcess: IPty;
  agentType: AgentType;
  shutdownTimeout?: NodeJS.Timeout;
  outputBuffer: string;
  outputSize: number;
}

const activeProcesses = new Map<string, MonitoredProcess>();

export function startAgent(
  sessionId: string,
  workspaceId: string,
  agentType: AgentType,
  workspacePath: string,
  command: string,
  args: string[]
): boolean {
  console.log(`Starting ${agentType} agent for session ${sessionId}`);

  if (!validateAgentCommand(command)) {
    console.error(`Invalid agent command: ${command}`);
    sessionQueries.update(sessionId, { status: 'failed', completedAt: Date.now() });
    return false;
  }

  console.log(`[DEBUG] Spawning agent with node-pty:`);
  console.log(`  Command: ${command}`);
  console.log(`  Args: ${JSON.stringify(args)}`);
  console.log(`  Working directory: ${workspacePath}`);

  let ptyProcess: IPty;
  try {
    ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: workspacePath,
      env: { ...process.env, TERM: 'xterm-256color' } as { [key: string]: string },
    });
    console.log(`[DEBUG] PTY spawned with PID: ${ptyProcess.pid}`);
  } catch (error) {
    console.error(`Failed to spawn agent process:`, error);
    sessionQueries.update(sessionId, { status: 'failed', completedAt: Date.now() });
    return false;
  }


  const monitored: MonitoredProcess = {
    sessionId,
    workspaceId,
    ptyProcess,
    agentType,
    outputBuffer: '',
    outputSize: 0,
  };
  activeProcesses.set(sessionId, monitored);
  sessionQueries.update(sessionId, { processId: ptyProcess.pid, status: 'running' });

  ptyProcess.onData((data: string) => handleOutput(monitored, data));
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Agent process exited with code ${exitCode} signal ${signal}`);
    cleanupProcess(sessionId, exitCode === 0);
  });

  return true;
}

function handleOutput(monitored: MonitoredProcess, data: string): void {
  // Stream raw PTY data directly to terminal (with ANSI codes preserved)
  broadcastToWorkspace(monitored.workspaceId, {
    type: 'terminal_data',
    data: {
      sessionId: monitored.sessionId,
      workspaceId: monitored.workspaceId,
      data: data,
    },
  });

  // Also maintain the log buffer for the logs view (sanitized)
  if (monitored.outputSize >= MAX_OUTPUT_BUFFER_SIZE) {
    if (monitored.outputSize === MAX_OUTPUT_BUFFER_SIZE) {
      handleAgentLog(monitored.sessionId, monitored.workspaceId, 'warning', '[Output buffer full]');
      monitored.outputSize += 1;
    }
    return;
  }
  monitored.outputSize += data.length;
  monitored.outputBuffer += data;
  const lines = monitored.outputBuffer.split('\n');
  monitored.outputBuffer = lines.pop() || '';
  for (const line of lines) {
    if (line.trim()) handleAgentLog(monitored.sessionId, monitored.workspaceId, 'info', line);
  }
}

function cleanupProcess(sessionId: string, success: boolean): void {
  const monitored = activeProcesses.get(sessionId);
  if (!monitored) return;
  if (monitored.shutdownTimeout) clearTimeout(monitored.shutdownTimeout);
  if (monitored.outputBuffer.trim()) {
    handleAgentLog(monitored.sessionId, monitored.workspaceId, 'info', monitored.outputBuffer);
  }
  const status = success ? 'completed' : 'failed';
  sessionQueries.update(sessionId, { status, completedAt: Date.now() });
  workspaceQueries.update(monitored.workspaceId, { status: success ? 'completed' : 'error' });
  broadcastToWorkspace(monitored.workspaceId, {
    type: 'session_completed',
    data: { sessionId, workspaceId: monitored.workspaceId, success, timestamp: Date.now() },
  });
  activeProcesses.delete(sessionId);
}


export function stopAgent(sessionId: string): boolean {
  const monitored = activeProcesses.get(sessionId);
  if (!monitored) {
    console.warn(`No active process for session ${sessionId}`);
    return false;
  }
  console.log(`Stopping agent process for session ${sessionId}`);
  monitored.ptyProcess.kill();
  monitored.shutdownTimeout = setTimeout(() => {
    if (activeProcesses.has(sessionId)) {
      console.log(`Force killing agent for session ${sessionId}`);
      try { process.kill(monitored.ptyProcess.pid, 'SIGKILL'); } catch {}
    }
  }, GRACEFUL_SHUTDOWN_TIMEOUT);
  return true;
}

export function stopAllAgents(): void {
  console.log(`Stopping all ${activeProcesses.size} agent processes...`);
  for (const [sessionId, monitored] of activeProcesses.entries()) {
    console.log(`Stopping agent for session ${sessionId}`);
    monitored.ptyProcess.kill();
  }
  setTimeout(() => {
    for (const [, monitored] of activeProcesses.entries()) {
      try { process.kill(monitored.ptyProcess.pid, 'SIGKILL'); } catch {}
    }
  }, GRACEFUL_SHUTDOWN_TIMEOUT);
}

function handleAgentLog(
  sessionId: string,
  workspaceId: string,
  level: 'info' | 'warning' | 'error',
  message: string
): void {
  const sanitized = sanitizeForDisplay(message, MAX_LOG_MESSAGE_LENGTH);
  agentLogQueries.create({ sessionId, timestamp: Date.now(), level, message: sanitized });
  broadcastToWorkspace(workspaceId, {
    type: 'agent_log',
    data: { sessionId, workspaceId, level, message: sanitized, timestamp: Date.now() },
  });
}

export function sendToAgent(sessionId: string, input: string): boolean {
  const monitored = activeProcesses.get(sessionId);
  if (!monitored) {
    console.warn(`No active process for session ${sessionId}`);
    return false;
  }
  try {
    monitored.ptyProcess.write(input);
    return true;
  } catch (error) {
    console.error(`Error writing to PTY:`, error);
    return false;
  }
}

export function resizeTerminal(sessionId: string, cols: number, rows: number): boolean {
  const monitored = activeProcesses.get(sessionId);
  if (!monitored) return false;
  try {
    monitored.ptyProcess.resize(cols, rows);
    return true;
  } catch { return false; }
}

export function getActiveSessions(): string[] {
  return Array.from(activeProcesses.keys());
}

export function isSessionActive(sessionId: string): boolean {
  return activeProcesses.has(sessionId);
}
