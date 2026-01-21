/**
 * XTerminal - Real terminal emulator using xterm.js
 * Displays PTY output with full ANSI support (colors, cursor, etc.)
 */
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as TerminalIcon, AlertCircle } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';
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

    // Debug: log when terminal receives/loses focus
    if (terminal.textarea) {
      console.log('[XTerminal] Textarea element found:', terminal.textarea);
      terminal.textarea.addEventListener('focus', () => {
        console.log('[XTerminal] Terminal textarea focused');
      });
      terminal.textarea.addEventListener('blur', () => {
        console.log('[XTerminal] Terminal textarea blurred');
      });
    } else {
      console.log('[XTerminal] WARNING: No textarea element found after open()');
    }

    // Auto-focus the terminal after a short delay
    setTimeout(() => {
      console.log('[XTerminal] Auto-focusing terminal on mount');
      terminal.focus();
    }, 200);

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

  // Handle user input - send to backend (or local echo if no session)
  useEffect(() => {
    if (!xtermRef.current) {
      console.log('[XTerminal] Input handler not set up: no terminal');
      return;
    }

    const terminal = xtermRef.current;
    const sessionId = session?.id;

    console.log('[XTerminal] Setting up input handler:', { sessionId: sessionId || 'LOCAL_ECHO' });

    const disposable = terminal.onData((data) => {
      if (sessionId) {
        // Send to backend when session exists
        console.log('[XTerminal] Sending input:', { sessionId, data: data.substring(0, 20) });
        const sent = send({
          type: 'terminal_input',
          data: {
            sessionId,
            data,
          },
        });
        console.log('[XTerminal] Input sent result:', sent);
      } else {
        // Local echo mode when no session - just to test input capture
        console.log('[XTerminal] Local echo (no session):', data.substring(0, 20));
        // Echo the input locally so user can see typing works
        if (data === '\r') {
          terminal.writeln('');
        } else if (data === '\x7f') {
          // Backspace
          terminal.write('\b \b');
        } else {
          terminal.write(data);
        }
      }
    });

    return () => {
      console.log('[XTerminal] Disposing input handler');
      disposable.dispose();
    };
  }, [session?.id, send]);

  // Subscribe to terminal data from backend
  useEffect(() => {
    if (!session?.id) return;

    const sessionId = session.id;
    console.log('[XTerminal] Subscribing to terminal data for session:', sessionId);

    return subscribe((event: ServerToClientEvent) => {
      if (event.type === 'terminal_data' && event.data.sessionId === sessionId) {
        console.log('[XTerminal] Received terminal data:', event.data.data.substring(0, 50));
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

  // Focus terminal when session becomes active or when session exists
  useEffect(() => {
    console.log('[XTerminal] Focus effect triggered:', { sessionId: session?.id, sessionStatus: session?.status, hasTerminal: !!xtermRef.current });
    if (session?.id && xtermRef.current) {
      // Focus with a small delay to ensure DOM is ready
      setTimeout(() => {
        console.log('[XTerminal] Focusing terminal');
        xtermRef.current?.focus();
      }, 50);
    }
  }, [session?.id, session?.status]);

  // Handle click to focus terminal
  const handleTerminalClick = () => {
    console.log('[XTerminal] Click detected, attempting to focus');
    if (xtermRef.current) {
      xtermRef.current.focus();
      // Also try focusing the textarea directly
      const textarea = xtermRef.current.textarea;
      if (textarea) {
        console.log('[XTerminal] Focusing textarea directly');
        textarea.focus();
      } else {
        console.log('[XTerminal] No textarea found!');
      }
    }
  };

  // Clear terminal only when switching to a different session (not on first load)
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (session?.id && prevSessionIdRef.current && prevSessionIdRef.current !== session.id) {
      if (xtermRef.current) {
        xtermRef.current.clear();
      }
    }
    prevSessionIdRef.current = session?.id || null;
  }, [session?.id]);

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Terminal</h3>
          {session ? (
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              session.status === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {session.status} (id: {session.id.slice(0, 8)})
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
              No Session
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
        className="flex-1 overflow-hidden"
        style={{
          padding: '8px',
          backgroundColor: '#1a1a2e',
          minHeight: '300px',
          position: 'relative',
        }}
        onClick={handleTerminalClick}
      >
        <div ref={terminalRef} className="h-full w-full" />
      </div>

      {/* Removed overlay - it was blocking terminal input */}
    </div>
  );
}
