/**
 * Workspace Switcher - Sidebar for switching between workspaces
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Folder, Circle, CheckCircle, XCircle, Loader, GitBranch, Square, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import type { Workspace, WorkspaceStatus } from '@parawork/shared';

interface ContextMenuState {
  workspace: Workspace | null;
  x: number;
  y: number;
}

interface WorkspaceSwitcherProps {
  onNewWorkspace: () => void;
}

export function WorkspaceSwitcher({ onNewWorkspace }: WorkspaceSwitcherProps) {
  const workspaces = useAppStore((state) => state.workspaces);
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const setFocusedWorkspace = useAppStore((state) => state.setFocusedWorkspace);
  const sessions = useAppStore((state) => state.sessions);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);
  const removeSession = useAppStore((state) => state.removeSession);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    workspace: null,
    x: 0,
    y: 0,
  });

  const runningCount = workspaces.filter((ws) => ws.status === 'running').length;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu({ workspace: null, x: 0, y: 0 });
    if (contextMenu.workspace) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.workspace]);

  const handleContextMenu = useCallback((e: React.MouseEvent, workspace: Workspace) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ workspace, x: e.clientX, y: e.clientY });
  }, []);

  const handleStop = useCallback(async () => {
    if (!contextMenu.workspace) return;
    const session = sessions[contextMenu.workspace.id];
    if (session) {
      try {
        await api.sessions.stop(session.id);
        removeSession(contextMenu.workspace.id);
      } catch (err) {
        console.error('Failed to stop session:', err);
      }
    }
    setContextMenu({ workspace: null, x: 0, y: 0 });
  }, [contextMenu.workspace, sessions, removeSession]);

  const handleDelete = useCallback(async () => {
    if (!contextMenu.workspace) return;
    const confirmed = window.confirm(`Delete workspace "${contextMenu.workspace.name}"? This cannot be undone.`);
    if (confirmed) {
      try {
        await api.workspaces.delete(contextMenu.workspace.id);
        removeWorkspace(contextMenu.workspace.id);
      } catch (err) {
        console.error('Failed to delete workspace:', err);
      }
    }
    setContextMenu({ workspace: null, x: 0, y: 0 });
  }, [contextMenu.workspace, removeWorkspace]);

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
                onContextMenu={(e) => handleContextMenu(e, workspace)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.workspace && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          workspace={contextMenu.workspace}
          hasSession={!!sessions[contextMenu.workspace.id]}
          onStop={handleStop}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

interface WorkspaceItemProps {
  workspace: Workspace;
  isFocused: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function WorkspaceItem({ workspace, isFocused, onClick, onContextMenu }: WorkspaceItemProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
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
      {workspace.gitWorktree && (
        <div className="flex items-center gap-1 text-xs opacity-75 mb-1">
          <GitBranch className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{workspace.gitWorktree.branchName}</span>
        </div>
      )}
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

interface ContextMenuProps {
  x: number;
  y: number;
  workspace: Workspace;
  hasSession: boolean;
  onStop: () => void;
  onDelete: () => void;
}

function ContextMenu({ x, y, workspace, hasSession, onStop, onDelete }: ContextMenuProps) {
  const isRunning = workspace.status === 'running';

  return (
    <div
      className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Stop option - only show if workspace is running */}
      {isRunning && hasSession && (
        <button
          onClick={onStop}
          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
      )}
      {/* Delete option */}
      <button
        onClick={onDelete}
        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground transition-colors text-red-500"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}
