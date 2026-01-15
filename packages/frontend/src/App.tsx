/**
 * Main App Component
 */
import { useEffect, useState } from 'react';
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher/WorkspaceSwitcher';
import { WorkspaceView } from './components/WorkspaceView/WorkspaceView';
import { NewWorkspaceDialog } from './components/NewWorkspaceDialog';
import { useWebSocket } from './hooks/useWebSocket';
import { useAppStore } from './stores/appStore';
import { api } from './lib/api';

export function App() {
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);

  const setWorkspaces = useAppStore((state) => state.setWorkspaces);
  const updateWorkspace = useAppStore((state) => state.updateWorkspace);
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const setFocusedWorkspace = useAppStore((state) => state.setFocusedWorkspace);

  const { send, subscribe } = useWebSocket();

  // Initialize API key from backend on first load
  useEffect(() => {
    const initApiKey = async () => {
      const stored = localStorage.getItem('parawork_api_key');
      if (!stored) {
        try {
          // Fetch API key from backend config
          const response = await fetch('http://localhost:3000/api/config');
          if (response.ok) {
            const config = await response.json();
            if (config.data?.apiKey) {
              localStorage.setItem('parawork_api_key', config.data.apiKey);
              console.log('API key initialized from backend');
            }
          }
        } catch (error) {
          console.warn('Could not fetch API key from backend:', error);
        }
      }
    };
    initApiKey();
  }, []);

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
  useEffect(() => {
    if (focusedWorkspaceId) {
      send({
        type: 'subscribe_workspace',
        data: { workspaceId: focusedWorkspaceId },
      });

      return () => {
        send({
          type: 'unsubscribe_workspace',
          data: { workspaceId: focusedWorkspaceId },
        });
      };
    }
  }, [focusedWorkspaceId, send]);

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
