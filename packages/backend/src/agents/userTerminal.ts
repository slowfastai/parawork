/**
 * User Terminal PTY management
 * Manages interactive shell terminals for workspaces (separate from agent sessions)
 */
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { broadcastToWorkspace } from '../api/websocket.js';

const GRACEFUL_SHUTDOWN_TIMEOUT = 5000;

interface UserTerminalProcess {
  id: string;
  workspaceId: string;
  ptyProcess: IPty;
  createdAt: number;
  shutdownTimeout?: NodeJS.Timeout;
}

const activeUserTerminals = new Map<string, UserTerminalProcess>();
// Workspace -> Terminal ID mapping for quick lookup
const workspaceTerminalMap = new Map<string, string>();

export function startUserTerminal(
  terminalId: string,
  workspaceId: string,
  workspacePath: string,
  shell?: string
): boolean {
  // Check if workspace already has a terminal
  const existingTerminalId = workspaceTerminalMap.get(workspaceId);
  if (existingTerminalId && activeUserTerminals.has(existingTerminalId)) {
    console.log(`Workspace ${workspaceId} already has an active terminal`);
    return false;
  }

  // Determine shell to use
  const shellToUse = shell || process.env.SHELL || '/bin/bash';

  console.log(`Starting user terminal ${terminalId} for workspace ${workspaceId}`);
  console.log(`  Shell: ${shellToUse}`);
  console.log(`  Working directory: ${workspacePath}`);

  let ptyProcess: IPty;
  try {
    ptyProcess = pty.spawn(shellToUse, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: workspacePath,
      env: { ...process.env, TERM: 'xterm-256color' } as { [key: string]: string },
    });
    console.log(`User terminal PTY spawned with PID: ${ptyProcess.pid}`);
  } catch (error) {
    console.error('Failed to spawn user terminal:', error);
    return false;
  }

  const terminal: UserTerminalProcess = {
    id: terminalId,
    workspaceId,
    ptyProcess,
    createdAt: Date.now(),
  };

  activeUserTerminals.set(terminalId, terminal);
  workspaceTerminalMap.set(workspaceId, terminalId);

  // Handle PTY output
  ptyProcess.onData((data: string) => {
    broadcastToWorkspace(workspaceId, {
      type: 'user_terminal_data',
      data: {
        terminalId,
        workspaceId,
        data,
      },
    });
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    console.log(`User terminal ${terminalId} exited with code ${exitCode}`);
    broadcastToWorkspace(workspaceId, {
      type: 'user_terminal_exited',
      data: {
        terminalId,
        workspaceId,
        exitCode,
      },
    });
    cleanupTerminal(terminalId);
  });

  // Notify clients that terminal started
  broadcastToWorkspace(workspaceId, {
    type: 'user_terminal_started',
    data: {
      terminalId,
      workspaceId,
      pid: ptyProcess.pid,
    },
  });

  return true;
}

function cleanupTerminal(terminalId: string): void {
  const terminal = activeUserTerminals.get(terminalId);
  if (!terminal) return;

  if (terminal.shutdownTimeout) {
    clearTimeout(terminal.shutdownTimeout);
  }

  activeUserTerminals.delete(terminalId);
  workspaceTerminalMap.delete(terminal.workspaceId);
}

export function sendToUserTerminal(terminalId: string, input: string): boolean {
  const terminal = activeUserTerminals.get(terminalId);
  if (!terminal) {
    console.warn(`No active user terminal: ${terminalId}`);
    return false;
  }

  try {
    terminal.ptyProcess.write(input);
    return true;
  } catch (error) {
    console.error('Error writing to user terminal:', error);
    return false;
  }
}

export function resizeUserTerminal(terminalId: string, cols: number, rows: number): boolean {
  const terminal = activeUserTerminals.get(terminalId);
  if (!terminal) return false;

  try {
    terminal.ptyProcess.resize(cols, rows);
    return true;
  } catch {
    return false;
  }
}

export function stopUserTerminal(terminalId: string): boolean {
  const terminal = activeUserTerminals.get(terminalId);
  if (!terminal) {
    console.warn(`No active user terminal: ${terminalId}`);
    return false;
  }

  console.log(`Stopping user terminal ${terminalId}`);
  terminal.ptyProcess.kill();

  terminal.shutdownTimeout = setTimeout(() => {
    if (activeUserTerminals.has(terminalId)) {
      console.log(`Force killing user terminal ${terminalId}`);
      try {
        process.kill(terminal.ptyProcess.pid, 'SIGKILL');
      } catch {
        // Process may already be dead
      }
      cleanupTerminal(terminalId);
    }
  }, GRACEFUL_SHUTDOWN_TIMEOUT);

  return true;
}

export function stopWorkspaceTerminal(workspaceId: string): boolean {
  const terminalId = workspaceTerminalMap.get(workspaceId);
  if (!terminalId) return false;
  return stopUserTerminal(terminalId);
}

export function getWorkspaceTerminalId(workspaceId: string): string | null {
  return workspaceTerminalMap.get(workspaceId) || null;
}

export function stopAllUserTerminals(): void {
  console.log(`Stopping all ${activeUserTerminals.size} user terminals...`);
  for (const [terminalId, terminal] of activeUserTerminals.entries()) {
    console.log(`Stopping user terminal ${terminalId}`);
    terminal.ptyProcess.kill();
  }

  setTimeout(() => {
    for (const [, terminal] of activeUserTerminals.entries()) {
      try {
        process.kill(terminal.ptyProcess.pid, 'SIGKILL');
      } catch {
        // Process may already be dead
      }
    }
    activeUserTerminals.clear();
    workspaceTerminalMap.clear();
  }, GRACEFUL_SHUTDOWN_TIMEOUT);
}

export function isUserTerminalActive(terminalId: string): boolean {
  return activeUserTerminals.has(terminalId);
}

export function getActiveUserTerminals(): string[] {
  return Array.from(activeUserTerminals.keys());
}
