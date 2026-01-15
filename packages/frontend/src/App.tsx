/**
 * Main App Component
 */
import { useEffect, useState } from 'react';
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher/WorkspaceSwitcher';
import { WorkspaceView } from './components/WorkspaceView/WorkspaceView';
import { NewWorkspaceDialog } from './components/NewWorkspaceDialog';
import { useWebSocket } from './contexts/WebSocketContext';
import { useAppStore } from './stores/appStore';
import { api } from './lib/api';

export function App() {
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);

  const setWorkspaces = useAppStore((state) => state.setWorkspaces);
  const updateWorkspace = useAppStore((state) => state.updateWorkspace);
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const setFocusedWorkspace = useAppStore((state) => state.setFocusedWorkspace);
  const wsConnected = useAppStore((state) => state.wsConnected);

  const { send, subscribe, reset } = useWebSocket();

  // Initialize API key from backend on first load
  // IMPORTANT: After storing the key, we must reset the WebSocket to reconnect with the key
  useEffect(() => {
    const initApiKey = async () => {
      const stored = localStorage.getItem('parawork_api_key');
      console.log('[App] Checking API key, stored:', stored ? 'yes' : 'no');
      if (!stored) {
        try {
          // Fetch API key from backend config (use relative URL for Vite proxy)
          console.log('[App] Fetching API key from backend...');
          const response = await fetch('/api/config');
          console.log('[App] Config response status:', response.status);
          if (response.ok) {
            const config = await response.json();
            console.log('[App] Config received, has apiKey:', !!config.data?.apiKey);
            if (config.data?.apiKey) {
              localStorage.setItem('parawork_api_key', config.data.apiKey);
              console.log('[App] API key stored, resetting WebSocket...');
              // Reset WebSocket to reconnect with the new API key
              reset();
            }
          }
        } catch (error) {
          console.error('[App] Error fetching API key:', error);
        }
      } else {
        console.log('[App] API key already in localStorage');
      }
    };
    initApiKey();
  }, [reset]);

  // Load workspaces on mount
  useEffect(() => {
    api.workspaces
      .list()
      .then((workspaces) => {
        setWorkspaces(workspaces);

        // Auto-focus on the most recently focused workspace
        if (workspaces.length > 0 && !focusedWorkspaceId) {
          const mostRecent = workspaces.reduce((prev, curr) => {
            if (!curr.lastFocusedAt) return prev;
            if (!prev.lastFocusedAt) return curr;
            return curr.lastFocusedAt > prev.lastFocusedAt ? curr : prev;
          });
          setFocusedWorkspace(mostRecent.id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setWorkspaces, focusedWorkspaceId, setFocusedWorkspace]);

  // Subscribe to WebSocket events
  useEffect(() => {
    return subscribe((event) => {
      switch (event.type) {
        case 'workspace_status_changed':
          updateWorkspace(event.data.workspaceId, {
            status: event.data.status,
            updatedAt: event.data.timestamp,
          });
          break;

        case 'agent_log':
          // Logs are handled by LogStream component
          break;

        case 'agent_message':
          // Messages are handled by ChatInterface component
          break;

        case 'file_changed':
          // File changes are handled by FileChanges component
          break;

        case 'session_completed':
          // Update workspace status based on session completion
          const success = event.data.success;
          updateWorkspace(event.data.workspaceId, {
            status: success ? 'completed' : 'error',
            updatedAt: event.data.timestamp,
          });
          break;
      }
    });
  }, [subscribe, updateWorkspace]);

  // Subscribe to focused workspace on WebSocket
  // IMPORTANT: Must depend on wsConnected to retry subscription after reconnect
  useEffect(() => {
    console.log('[App] Subscription effect running:', { focusedWorkspaceId, wsConnected });

    if (!focusedWorkspaceId) {
      console.log('[App] No workspace focused, skipping subscription');
      return;
    }

    if (!wsConnected) {
      console.log('[App] WebSocket not connected, skipping subscription');
      return;
    }

    console.log('[App] Subscribing to workspace:', focusedWorkspaceId);
    const sent = send({
      type: 'subscribe_workspace',
      data: { workspaceId: focusedWorkspaceId },
    });
    console.log('[App] Subscribe message sent:', sent);

    return () => {
      console.log('[App] Cleanup: Unsubscribing from workspace:', focusedWorkspaceId);
      send({
        type: 'unsubscribe_workspace',
        data: { workspaceId: focusedWorkspaceId },
      });
    };
  }, [focusedWorkspaceId, wsConnected, send]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Parawork...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <WorkspaceSwitcher onNewWorkspace={() => setShowNewWorkspace(true)} />
      <WorkspaceView />

      {showNewWorkspace && (
        <NewWorkspaceDialog onClose={() => setShowNewWorkspace(false)} />
      )}
    </div>
  );
}
