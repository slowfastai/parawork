/**
 * Workspace View - The focused workspace view (ONE at a time)
 * Terminal-focused design: shows full terminal when session is active
 */
import { useState, useEffect } from 'react';
import { Square, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { api } from '../../lib/api';
import { FileChanges } from './FileChanges';
import { XTerminal } from './XTerminal';
import type { Session, FileChange, ServerToClientEvent } from '@parawork/shared';

export function WorkspaceView() {
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const workspaces = useAppStore((state) => state.workspaces);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);
  const sessions = useAppStore((state) => state.sessions);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const removeSession = useAppStore((state) => state.removeSession);

  const { subscribe } = useWebSocket();

  const [session, setSession] = useState<Session | null>(null);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);

  const workspace = workspaces.find((ws) => ws.id === focusedWorkspaceId);

  useEffect(() => {
    if (!workspace) {
      setSession(null);
      setFileChanges([]);
      return;
    }

    // Update last focused time
    api.workspaces.update(workspace.id, {
      lastFocusedAt: Date.now(),
    });
  }, [workspace]);

  // Listen for session_completed WebSocket events
  // Updates local session state and appStore accordingly
  // _Requirements: 3.3_
  useEffect(() => {
    const handleWebSocketEvent = (event: ServerToClientEvent) => {
      if (event.type === 'session_completed') {
        const { sessionId, workspaceId, success } = event.data;
        
        // Only handle events for the current workspace
        if (workspaceId !== workspace?.id) return;
        
        // Update local session state if it matches
        if (session?.id === sessionId) {
          const updatedSession: Session = {
            ...session,
            status: success ? 'completed' : 'failed',
            completedAt: event.data.timestamp,
          };
          setSession(updatedSession);
          
          // Update appStore with the completed session status
          setCurrentSession(workspaceId, updatedSession);
        }
      }
    };

    const unsubscribe = subscribe(handleWebSocketEvent);
    return unsubscribe;
  }, [workspace?.id, session, subscribe, setCurrentSession]);

  // Auto-load session for workspaces that are already running
  // Check appStore sessions first, then fall back to API
  // Also handle failed sessions to display error messages
  // _Requirements: 2.4, 4.2_
  useEffect(() => {
    if (!workspace) {
      setSession(null);
      return;
    }

    // Only load if workspace is running or has error
    if (workspace.status !== 'running' && workspace.status !== 'error') {
      setSession(null);
      return;
    }

    // Check appStore for session first (set by NewWorkspaceDialog)
    const storedSession = sessions[workspace.id];
    if (storedSession && (storedSession.status === 'running' || storedSession.status === 'starting' || storedSession.status === 'failed')) {
      setSession(storedSession);
      return;
    }

    // Fall back to API load for existing workspaces (e.g., after page refresh)
    const loadSessionFromAPI = async () => {
      try {
        const apiSessions = await api.sessions.list(workspace.id);
        // Look for running, starting, or failed sessions
        const activeSession = apiSessions.find((s) => 
          s.status === 'running' || s.status === 'starting' || s.status === 'failed'
        );
        if (activeSession) {
          setSession(activeSession);
          // Also store in appStore for consistency
          setCurrentSession(workspace.id, activeSession);
        } else {
          setSession(null);
        }
      } catch (error) {
        console.error('Error loading sessions:', error);
        setSession(null);
      }
    };

    loadSessionFromAPI();
  }, [workspace?.id, workspace?.status, sessions, setCurrentSession]);

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

  const handleStopSession = async () => {
    if (!session) return;

    try {
      await api.sessions.stop(session.id);
      setSession(null);
      // Clear from appStore when session is stopped
      // _Requirements: 3.1, 3.2_
      if (workspace) {
        removeSession(workspace.id);
      }
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

  const handleRestart = async () => {
    try {
      const newSession = await api.sessions.create(workspace.id, {
        agentType: workspace.agentType || 'claude-code',
      });
      setSession(newSession);
      // Store in appStore for consistency
      setCurrentSession(workspace.id, newSession);
    } catch (error) {
      console.error('Error restarting session:', error);
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
            {session ? (
              <>
                <button
                  onClick={handleStopSession}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </>
            ) : workspace.status === 'idle' ? (
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                ▶ Restart
              </button>
            ) : null}
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

      {/* Terminal-focused Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main Terminal Area - Full width when active */}
        <div className={`${session ? 'flex-1' : 'w-full'} flex flex-col relative`}>
          <XTerminal session={session} />
        </div>

        {/* File Changes Sidebar - Only show when session is active */}
        {session && (
          <div className="w-96 border-l border-border flex flex-col">
            <div className="flex-1 overflow-hidden">
              <FileChanges session={session} changes={fileChanges} onChangesUpdate={setFileChanges} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
