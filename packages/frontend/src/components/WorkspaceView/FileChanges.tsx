/**
 * File Changes - Display file modifications by agent
 */
import { useEffect, Dispatch, SetStateAction } from 'react';
import { FileText, FilePlus, FileX } from 'lucide-react';
import { api } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { Session, FileChange } from '@parawork/shared';

interface FileChangesProps {
  session: Session | null;
  changes: FileChange[];
  onChangesUpdate: Dispatch<SetStateAction<FileChange[]>>;
}

export function FileChanges({ session, changes, onChangesUpdate }: FileChangesProps) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!session?.id) {
      onChangesUpdate([]);
      return;
    }

    // Load file changes for this session
    const sessionId = session.id;
    api.sessions.getChanges(sessionId)
      .then((loadedChanges) => onChangesUpdate(loadedChanges))
      .catch(console.error);
  }, [session?.id, onChangesUpdate]);

  // Subscribe to real-time file change events via WebSocket
  useEffect(() => {
    if (!session?.id) return;

    const sessionId = session.id;
    return subscribe((event) => {
      if (event.type === 'file_changed' && event.data.sessionId === sessionId) {
        const newChange: FileChange = {
          id: Date.now(), // Temporary ID
          sessionId: event.data.sessionId,
          filePath: event.data.filePath,
          changeType: event.data.changeType,
          diff: null,
          timestamp: event.data.timestamp,
        };
        onChangesUpdate((prevChanges) => [newChange, ...prevChanges]);
      }
    });
  }, [session?.id, subscribe, onChangesUpdate]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold">File Changes</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {changes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-4">
            No file changes yet
          </p>
        ) : (
          <div className="space-y-1">
            {changes.map((change) => (
              <div
                key={change.id}
                className="flex items-start gap-2 p-2 rounded hover:bg-accent text-sm"
              >
                <ChangeIcon changeType={change.changeType} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" title={change.filePath}>
                    {change.filePath}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(change.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeIcon({ changeType }: { changeType: 'created' | 'modified' | 'deleted' }) {
  switch (changeType) {
    case 'created':
      return <FilePlus className="w-4 h-4 text-green-500 flex-shrink-0" />;
    case 'modified':
      return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    case 'deleted':
      return <FileX className="w-4 h-4 text-red-500 flex-shrink-0" />;
  }
}
