/**
 * Workspace Switcher - Sidebar for switching between workspaces
 */
import { Plus, Folder, Circle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { Workspace, WorkspaceStatus } from '@parawork/shared';

interface WorkspaceSwitcherProps {
  onNewWorkspace: () => void;
}

export function WorkspaceSwitcher({ onNewWorkspace }: WorkspaceSwitcherProps) {
  const workspaces = useAppStore((state) => state.workspaces);
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const setFocusedWorkspace = useAppStore((state) => state.setFocusedWorkspace);

  const runningCount = workspaces.filter((ws) => ws.status === 'running').length;

  return (
    <div className="w-64 border-r border-border bg-muted/30 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold">Parawork</h1>
          <button
            onClick={onNewWorkspace}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title="New workspace"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {runningCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {runningCount} workspace{runningCount !== 1 ? 's' : ''} running
          </p>
        )}
      </div>

      {/* Workspace List */}
      <div className="flex-1 overflow-y-auto">
        {workspaces.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No workspaces yet.
            <br />
            Click + to create one.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {workspaces.map((workspace) => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                isFocused={workspace.id === focusedWorkspaceId}
                onClick={() => setFocusedWorkspace(workspace.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WorkspaceItemProps {
  workspace: Workspace;
  isFocused: boolean;
  onClick: () => void;
}

function WorkspaceItem({ workspace, isFocused, onClick }: WorkspaceItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-md text-left transition-colors
        ${
          isFocused
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent hover:text-accent-foreground'
        }
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <Folder className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium truncate flex-1">{workspace.name}</span>
        <StatusIcon status={workspace.status} />
      </div>
      <p className="text-xs opacity-75 truncate">{workspace.path}</p>
    </button>
  );
}

function StatusIcon({ status }: { status: WorkspaceStatus }) {
  switch (status) {
    case 'idle':
      return <Circle className="w-3 h-3 flex-shrink-0" />;
    case 'running':
      return <Loader className="w-3 h-3 flex-shrink-0 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-3 h-3 flex-shrink-0 text-green-500" />;
    case 'error':
      return <XCircle className="w-3 h-3 flex-shrink-0 text-red-500" />;
  }
}
