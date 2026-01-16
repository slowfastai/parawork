/**
 * Agent Terminal Panel - Middle panel showing the focused workspace's agent terminal
 * Terminal-focused design: shows full terminal when session is active
 */
import { useState, useEffect } from 'react';
import { Play, Square, Terminal } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { api } from '../../lib/api';
import { XTerminal } from '../WorkspaceView/XTerminal';
import type { Session, ServerToClientEvent, AgentType } from '@parawork/shared';

export function AgentTerminalPanel() {
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const workspaces = useAppStore((state) => state.workspaces);
  const sessions = useAppStore((state) => state.sessions);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const updateWorkspace = useAppStore((state) => state.updateWorkspace);
  const removeSession = useAppStore((state) => state.removeSession);

  const { subscribe } = useWebSocket();

  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);

  const workspace = workspaces.find((ws) => ws.id === focusedWorkspaceId);

  // Update last focused time
  useEffect(() => {
    if (!workspace) {
      setSession(null);
      return;
    }

    api.workspaces.update(workspace.id, {
      lastFocusedAt: Date.now(),
    });
  }, [workspace]);

  // Listen for session_completed WebSocket events
  useEffect(() => {
    const handleWebSocketEvent = (event: ServerToClientEvent) => {
      if (event.type === 'session_completed') {
        const { sessionId, workspaceId, success } = event.data;

        if (workspaceId !== workspace?.id) return;

        if (session?.id === sessionId) {
          const updatedSession: Session = {
            ...session,
            status: success ? 'completed' : 'failed',
            completedAt: event.data.timestamp,
          };
          setSession(updatedSession);
          setCurrentSession(workspaceId, updatedSession);

          // Update workspace status
          updateWorkspace(workspaceId, {
            status: success ? 'completed' : 'error'
          });
        }
      }
    };

    const unsubscribe = subscribe(handleWebSocketEvent);
    return unsubscribe;
  }, [workspace?.id, session, subscribe, setCurrentSession, updateWorkspace]);

  // Auto-load session for workspaces that are already running
  useEffect(() => {
    if (!workspace) {
      setSession(null);
      return;
    }

    if (workspace.status !== 'running' && workspace.status !== 'error') {
      setSession(null);
      return;
    }

    // Check appStore for session first
    const storedSession = sessions[workspace.id];
    if (storedSession && (storedSession.status === 'running' || storedSession.status === 'starting' || storedSession.status === 'failed')) {
      setSession(storedSession);
      return;
    }

    // Fall back to API load
    const loadSessionFromAPI = async () => {
      try {
        const apiSessions = await api.sessions.list(workspace.id);
        const activeSession = apiSessions.find((s) =>
          s.status === 'running' || s.status === 'starting' || s.status === 'failed'
        );
        if (activeSession) {
          setSession(activeSession);
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

  // Start a new session
  const handleStartSession = async () => {
    if (!workspace || starting) return;

    setStarting(true);
    try {
      const newSession = await api.sessions.create(workspace.id, {
        agentType: workspace.agentType as AgentType,
      });
      setSession(newSession);
      setCurrentSession(workspace.id, newSession);
      updateWorkspace(workspace.id, { status: 'running' });
    } catch (error) {
      console.error('Error starting session:', error);
    } finally {
      setStarting(false);
    }
  };

  // Stop the current session
  const handleStopSession = async () => {
    if (!workspace || !session) return;

    try {
      await api.sessions.stop(session.id);
      removeSession(workspace.id);
      setSession(null);
      updateWorkspace(workspace.id, { status: 'idle' });
    } catch (error) {
      console.error('Error stopping session:', error);
    }
  };

  // No workspace selected
  if (!workspace) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b border-border p-3 bg-muted/30">
          <h3 className="text-sm font-medium text-muted-foreground">Agent Terminal</h3>
        </div>
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center text-muted-foreground">
            <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No workspace selected</p>
            <p className="text-sm">Select a workspace from the sidebar to start</p>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = workspace.status === 'running' && session;
  const canStart = workspace.status !== 'running' && !starting;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with workspace info and controls */}
      <div className="border-b border-border px-4 py-2 flex items-center justify-between bg-muted/30">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate">{workspace.name}</h2>
          <p className="text-xs text-muted-foreground truncate">{workspace.path}</p>
        </div>

        {/* Session controls */}
        <div className="flex items-center gap-2 ml-4">
          {isRunning ? (
            <button
              onClick={handleStopSession}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
              title="Stop session"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleStartSession}
              disabled={!canStart}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Start session"
            >
              <Play className="w-4 h-4" />
              {starting ? 'Starting...' : 'Start'}
            </button>
          )}
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 overflow-hidden">
        <XTerminal session={session} />
      </div>
    </div>
  );
}
