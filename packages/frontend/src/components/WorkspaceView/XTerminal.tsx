/**
 * XTerminal - Real terminal emulator using xterm.js
 * Displays PTY output with full ANSI support (colors, cursor, etc.)
 */
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as TerminalIcon, AlertCircle } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { Session, ServerToClientEvent } from '@parawork/shared';
import 'xterm/css/xterm.css';

interface XTerminalProps {
  session: Session | null;
}

export function XTerminal({ session }: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { subscribe, send } = useWebSocket();

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!terminalRef.current) return;

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
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle terminal resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        // Notify backend of resize
        if (session?.id) {
          send({
            type: 'terminal_resize',
            data: {
              sessionId: session.id,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            },
          });
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Handle user input - send to backend
  useEffect(() => {
    if (!xtermRef.current || !session?.id) return;

    const terminal = xtermRef.current;
    const sessionId = session.id;

    const disposable = terminal.onData((data) => {
      send({
        type: 'terminal_input',
        data: {
          sessionId,
          data,
        },
      });
    });

    return () => {
      disposable.dispose();
    };
  }, [session?.id, send]);

  // Subscribe to terminal data from backend
  useEffect(() => {
    if (!session?.id) return;

    const sessionId = session.id;

    return subscribe((event: ServerToClientEvent) => {
      if (event.type === 'terminal_data' && event.data.sessionId === sessionId) {
        if (xtermRef.current) {
          xtermRef.current.write(event.data.data);
        }
      }
    });
  }, [session?.id, subscribe]);

  // Send initial resize when session starts
  useEffect(() => {
    if (!session?.id || !xtermRef.current) return;

    // Small delay to ensure terminal is properly sized
    const timer = setTimeout(() => {
      if (xtermRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
        send({
          type: 'terminal_resize',
          data: {
            sessionId: session.id,
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          },
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [session?.id, send]);

  // Focus terminal when session becomes active
  useEffect(() => {
    if (session?.status === 'running' && xtermRef.current) {
      xtermRef.current.focus();
    }
  }, [session?.status]);

  // Clear terminal when session changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  }, [session?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Terminal</h3>
          {session?.status === 'running' && (
            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
              Running
            </span>
          )}
        </div>
      </div>

      {session?.status === 'failed' && (
        <div className="m-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="font-semibold">CLI Failed to Start</span>
          </div>
          <p className="mt-1 text-red-600 dark:text-red-300 text-sm">
            The {session.agentType} CLI process failed to start. Please ensure the{' '}
            <code className="bg-red-200 dark:bg-red-800 px-1 rounded">
              {session.agentType === 'claude-code' ? 'claude' : 'codex'}
            </code>{' '}
            command is installed and accessible.
          </p>
        </div>
      )}

      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden"
        style={{ padding: '8px', backgroundColor: '#1a1a2e' }}
      />

      {!session && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <p className="text-muted-foreground">No active session</p>
        </div>
      )}
    </div>
  );
}
