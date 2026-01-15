/**
 * Log Stream - Real-time agent terminal
 * Displays terminal output and provides option to open in native Terminal.app
 * _Requirements: 2.2, 2.3, 2.4_
 */
import { useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Terminal as TerminalIcon, AlertCircle, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import type { Session, AgentLog } from '@parawork/shared';

interface LogStreamProps {
  session: Session | null;
  logs: AgentLog[];
  onLogsUpdate: Dispatch<SetStateAction<AgentLog[]>>;
}

export function LogStream({ session, logs, onLogsUpdate }: LogStreamProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  const handleOpenInTerminal = async () => {
    if (!session?.id) return;
    try {
      await api.sessions.openInTerminal(session.id);
    } catch (error) {
      console.error('Failed to open in terminal:', error);
    }
  };

  // Load initial logs
  useEffect(() => {
    if (!session?.id) {
      onLogsUpdate([]);
      return;
    }

    api.sessions.getLogs(session.id, 100)
      .then((loadedLogs) => onLogsUpdate(loadedLogs))
      .catch(console.error);
  }, [session?.id, onLogsUpdate]);

  // Subscribe to real-time log events
  useEffect(() => {
    if (!session?.id) return;

    const sessionId = session.id;
    return subscribe((event) => {
      if (event.type === 'agent_log' && event.data.sessionId === sessionId) {
        const newLog: AgentLog = {
          id: Date.now(),
          sessionId: event.data.sessionId,
          timestamp: event.data.timestamp,
          level: event.data.level,
          message: event.data.message,
        };
        onLogsUpdate((prevLogs) => [...prevLogs, newLog]);
      }
    });
  }, [session?.id, subscribe, onLogsUpdate]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Agent Logs</h3>
        </div>
        {session?.status === 'running' && (
          <button
            onClick={handleOpenInTerminal}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Terminal
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 bg-black/5 dark:bg-black/20 font-mono text-xs">
        {session?.status === 'failed' && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
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
        {logs.length === 0 && session?.status !== 'failed' ? (
          <p className="text-muted-foreground text-center mt-4">No logs yet</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className={getLogColor(log.level)}>
                <span className="text-muted-foreground">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{' '}
                <span className="uppercase font-semibold">[{log.level}]</span>{' '}
                {log.message}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function getLogColor(level: 'info' | 'warning' | 'error'): string {
  switch (level) {
    case 'info':
      return 'text-foreground';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
  }
}
