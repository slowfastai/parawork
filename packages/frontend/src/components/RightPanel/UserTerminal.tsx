/**
 * User Terminal - Interactive shell in workspace directory
 * Separate from agent terminal - allows user to run commands
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as TerminalIcon, RefreshCw, XCircle } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { api } from '../../lib/api';
import type { ServerToClientEvent } from '@parawork/shared';
import 'xterm/css/xterm.css';

interface UserTerminalProps {
  workspacePath?: string;
  workspaceId?: string;
}

type StatusTone = 'info' | 'success' | 'warning' | 'error';

interface StatusMessage {
  tone: StatusTone;
  text: string;
  detail?: string;
}

const statusToneStyles: Record<StatusTone, string> = {
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
};

export function UserTerminal({ workspacePath, workspaceId }: UserTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const { subscribe, send } = useWebSocket();

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!terminalRef.current || !workspaceId) return;

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#00ff00',
        cursorAccent: '#1a1a2e',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#555555',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);

    // Initial fit
    setTimeout(() => fitAddon.fit(), 0);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle terminal resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current && terminalIdRef.current) {
        fitAddonRef.current.fit();
        send({
          type: 'user_terminal_resize',
          data: {
            terminalId: terminalIdRef.current,
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          },
        });
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [workspaceId, send]);

  // Start terminal when component mounts with workspace
  const startTerminal = useCallback(async () => {
    if (!workspaceId || isStarting) return;

    setIsStarting(true);
    try {
      const result = await api.userTerminal.start(workspaceId);
      terminalIdRef.current = result.terminalId;
      setTerminalId(result.terminalId);
      setIsConnected(true);

      if (result.existing) {
        setStatusMessage({
          tone: 'info',
          text: 'Reconnected to existing terminal.',
          detail: `ID: ${result.terminalId.slice(0, 8)}`,
        });
      } else {
        setStatusMessage({
          tone: 'success',
          text: 'Terminal connected.',
        });
      }

      // Send initial resize
      if (xtermRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
        send({
          type: 'user_terminal_resize',
          data: {
            terminalId: result.terminalId,
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          },
        });
      }

      // Focus the terminal
      setTimeout(() => {
        xtermRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Failed to start terminal:', error);
      setStatusMessage({
        tone: 'error',
        text: 'Failed to start terminal.',
      });
    } finally {
      setIsStarting(false);
    }
  }, [workspaceId, isStarting, send]);

  // Auto-start terminal when workspace is available
  useEffect(() => {
    if (workspaceId && xtermRef.current && !terminalIdRef.current && !isStarting) {
      startTerminal();
    }
  }, [workspaceId, startTerminal, isStarting]);

  // Handle user input
  useEffect(() => {
    if (!xtermRef.current) return;

    const terminal = xtermRef.current;
    const disposable = terminal.onData((data) => {
      if (terminalIdRef.current) {
        send({
          type: 'user_terminal_input',
          data: {
            terminalId: terminalIdRef.current,
            data,
          },
        });
      } else {
        console.warn('[UserTerminal] No terminalId, cannot send input');
      }
    });

    return () => disposable.dispose();
  }, [send]);

  // Subscribe to terminal output AND workspace
  useEffect(() => {
    if (!workspaceId) return;

    console.log('[UserTerminal] Setting up subscription for workspace:', workspaceId);

    // Subscribe to workspace events
    const subscribed = send({
      type: 'subscribe_workspace',
      data: { workspaceId },
    });
    console.log('[UserTerminal] Workspace subscription sent:', subscribed);

    // Also subscribe to events
    const unsubscribe = subscribe((event: ServerToClientEvent) => {
      // Handle terminal data - match by workspaceId OR terminalId (to handle race condition)
      if (event.type === 'user_terminal_data') {
        const isOurTerminal = event.data.workspaceId === workspaceId ||
                              event.data.terminalId === terminalIdRef.current;
        if (isOurTerminal) {
          // Update terminalIdRef if we didn't have it
          if (!terminalIdRef.current) {
            terminalIdRef.current = event.data.terminalId;
          }
          xtermRef.current?.write(event.data.data);
        }
      }

      if (event.type === 'user_terminal_exited' &&
          (event.data.terminalId === terminalIdRef.current || event.data.workspaceId === workspaceId)) {
        setIsConnected(false);
        terminalIdRef.current = null;
        setTerminalId(null);
        setStatusMessage({
          tone: 'warning',
          text: 'Terminal exited.',
        });
      }

      if (event.type === 'user_terminal_started' &&
          event.data.workspaceId === workspaceId) {
        console.log('[UserTerminal] Terminal started:', event.data.terminalId);
        terminalIdRef.current = event.data.terminalId;
        setTerminalId(event.data.terminalId);
        setIsConnected(true);
        setStatusMessage((current) => current ?? {
          tone: 'success',
          text: 'Terminal started.',
        });
      }
    });

    // Cleanup: unsubscribe from workspace
    return () => {
      console.log('[UserTerminal] Unsubscribing from workspace:', workspaceId);
      send({
        type: 'unsubscribe_workspace',
        data: { workspaceId },
      });
      unsubscribe();
    };
  }, [workspaceId, subscribe, send]);

  // Cleanup when workspace changes
  useEffect(() => {
    return () => {
      terminalIdRef.current = null;
      setTerminalId(null);
      setIsConnected(false);
      setStatusMessage(null);
    };
  }, [workspaceId]);

  // Auto-focus terminal when it becomes connected
  useEffect(() => {
    if (isConnected && xtermRef.current) {
      console.log('[UserTerminal] Terminal connected, auto-focusing...');
      setTimeout(() => {
        if (xtermRef.current) {
          xtermRef.current.focus();
          const textarea = xtermRef.current.textarea;
          if (textarea) {
            textarea.focus();
          }
        }
      }, 200);
    }
  }, [isConnected]);

  // Stop terminal
  const stopTerminal = async () => {
    if (!workspaceId) return;
    try {
      await api.userTerminal.stop(workspaceId);
      setIsConnected(false);
      terminalIdRef.current = null;
      setTerminalId(null);
      setStatusMessage({
        tone: 'warning',
        text: 'Terminal stopped.',
      });
    } catch (error) {
      console.error('Failed to stop terminal:', error);
      setStatusMessage({
        tone: 'error',
        text: 'Failed to stop terminal.',
      });
    }
  };

  // Handle click to focus
  const handleClick = () => {
    console.log('[UserTerminal] Terminal clicked, focusing...');
    if (xtermRef.current) {
      xtermRef.current.focus();
      // Also try focusing the textarea directly
      const textarea = xtermRef.current.textarea;
      if (textarea) {
        console.log('[UserTerminal] Focusing textarea directly');
        textarea.focus();
      } else {
        console.warn('[UserTerminal] No textarea found!');
      }
    }
  };

  if (!workspacePath || !workspaceId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <p>Select a workspace to open terminal</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Terminal Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TerminalIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{workspacePath}</span>
          <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
            isConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {isConnected ? 'Connected' : isStarting ? 'Starting...' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isConnected && (
            <button
              onClick={startTerminal}
              disabled={isStarting}
              className="p-1 hover:bg-accent rounded"
              title="Start terminal"
            >
              <RefreshCw className={`w-4 h-4 ${isStarting ? 'animate-spin' : ''}`} />
            </button>
          )}
          {isConnected && (
            <button
              onClick={stopTerminal}
              className="p-1 hover:bg-accent rounded"
              title="Stop terminal"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className={`mx-3 my-2 flex items-start gap-2 rounded border px-2 py-1 text-xs ${statusToneStyles[statusMessage.tone]}`}>
          <span className="font-medium">{statusMessage.text}</span>
          {statusMessage.detail && (
            <span className="opacity-80" title={terminalId || undefined}>
              {statusMessage.detail}
            </span>
          )}
        </div>
      )}

      {/* Terminal */}
      <div
        className="flex-1 cursor-text overflow-hidden"
        style={{
          padding: '8px',
          backgroundColor: '#1a1a2e',
          minHeight: '200px',
        }}
        onClick={handleClick}
        onMouseDown={handleClick}
        title="Click to focus terminal"
      >
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
}
