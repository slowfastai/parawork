/**
 * File Changes - Display file modifications by agent
 */
import { useEffect, useRef } from 'react';
import { FileText, FilePlus, FileX } from 'lucide-react';
import { api } from '../../lib/api';
import type { Session, FileChange } from '@parawork/shared';

interface FileChangesProps {
  session: Session | null;
  changes: FileChange[];
  onChangesUpdate: (changes: FileChange[]) => void;
}

export function FileChanges({ session, changes, onChangesUpdate }: FileChangesProps) {
  // Store callback in ref to avoid dependency issues
  const onChangesUpdateRef = useRef(onChangesUpdate);
  onChangesUpdateRef.current = onChangesUpdate;

  useEffect(() => {
    if (!session?.id) {
      onChangesUpdateRef.current([]);
      return;
    }

    // Load file changes for this session
    const sessionId = session.id;
    api.sessions.getChanges(sessionId)
      .then((loadedChanges) => onChangesUpdateRef.current(loadedChanges))
      .catch(console.error);
  }, [session?.id]);

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
