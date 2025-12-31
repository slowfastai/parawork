/**
 * Log Stream - Real-time agent logs
 */
import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { api } from '../../lib/api';
import type { Session, AgentLog } from '@parawork/shared';

interface LogStreamProps {
  session: Session | null;
  logs: AgentLog[];
  onLogsUpdate: (logs: AgentLog[]) => void;
}

export function LogStream({ session, logs, onLogsUpdate }: LogStreamProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Store callback in ref to avoid dependency issues
  const onLogsUpdateRef = useRef(onLogsUpdate);
  onLogsUpdateRef.current = onLogsUpdate;

  useEffect(() => {
    if (!session?.id) {
      onLogsUpdateRef.current([]);
      return;
    }

    // Load logs for this session
    const sessionId = session.id;
    api.sessions.getLogs(sessionId, 100)
      .then((loadedLogs) => onLogsUpdateRef.current(loadedLogs))
      .catch(console.error);
  }, [session?.id]);

  useEffect(() => {
    // Auto-scroll to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Terminal className="w-4 h-4" />
        <h3 className="text-sm font-semibold">Agent Logs</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 bg-black/5 dark:bg-black/20 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-center mt-4">No logs yet</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className={`${getLogColor(log.level)}`}>
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
