/**
 * Workspace View - The focused workspace view (ONE at a time)
 */
import { useState, useEffect } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import { ChatInterface } from './ChatInterface';
import { FileChanges } from './FileChanges';
import { LogStream } from './LogStream';
import type { Session, Message, FileChange, AgentLog } from '@parawork/shared';

export function WorkspaceView() {
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const workspaces = useAppStore((state) => state.workspaces);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);

  const workspace = workspaces.find((ws) => ws.id === focusedWorkspaceId);

  useEffect(() => {
    if (!workspace) {
      setSession(null);
      setMessages([]);
      setFileChanges([]);
      setLogs([]);
      return;
    }

    // Update last focused time
    api.workspaces.update(workspace.id, {
      lastFocusedAt: Date.now(),
    });
  }, [workspace]);

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">No workspace selected</p>
          <p className="text-sm">Select a workspace from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  const handleStartSession = async () => {
    try {
      const newSession = await api.sessions.create(workspace.id, {
        agentType: workspace.agentType || 'claude-code',
      });
      setSession(newSession);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handleStopSession = async () => {
    if (!session) return;

    try {
      await api.sessions.stop(session.id);
      setSession(null);
    } catch (error) {
      console.error('Error stopping session:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete workspace "${workspace.name}"?`)) return;

    try {
      await api.workspaces.delete(workspace.id);
      removeWorkspace(workspace.id);
    } catch (error) {
      console.error('Error deleting workspace:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-semibold">{workspace.name}</h2>
            <p className="text-sm text-muted-foreground">{workspace.path}</p>
          </div>
          <div className="flex gap-2">
            {workspace.status === 'running' ? (
              <button
                onClick={handleStopSession}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleStartSession}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
              title="Delete workspace"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col">
          <ChatInterface
            session={session}
            messages={messages}
            onMessagesUpdate={setMessages}
          />
        </div>
        <div className="w-96 border-l border-border flex flex-col">
          <div className="flex-1 overflow-hidden">
            <LogStream session={session} logs={logs} onLogsUpdate={setLogs} />
          </div>
          <div className="h-64 border-t border-border">
            <FileChanges session={session} changes={fileChanges} onChangesUpdate={setFileChanges} />
          </div>
        </div>
      </div>
    </div>
  );
}
