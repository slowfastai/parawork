/**
 * Repository Switcher - Sidebar showing repositories with nested workspaces
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Folder,
  Circle,
  CheckCircle,
  XCircle,
  Loader,
  GitBranch,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderGit2,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import type { Workspace, Repository, WorkspaceStatus } from '@parawork/shared';
import { AddRepositoryDialog } from './AddRepositoryDialog';

interface ContextMenuState {
  type: 'workspace' | 'repository' | null;
  item: Workspace | Repository | null;
  x: number;
  y: number;
}

interface RepositorySwitcherProps {
  onNewWorkspace: (repository?: Repository) => void;
}

export function RepositorySwitcher({ onNewWorkspace }: RepositorySwitcherProps) {
  const repositories = useAppStore((state) => state.repositories);
  const workspaces = useAppStore((state) => state.workspaces);
  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const setFocusedWorkspace = useAppStore((state) => state.setFocusedWorkspace);
  const sessions = useAppStore((state) => state.sessions);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);
  const removeSession = useAppStore((state) => state.removeSession);
  const removeRepository = useAppStore((state) => state.removeRepository);

  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    type: null,
    item: null,
    x: 0,
    y: 0,
  });

  // Group workspaces by repository
  const workspacesByRepo = workspaces.reduce((acc, ws) => {
    const repoId = ws.repositoryId || 'standalone';
    if (!acc[repoId]) acc[repoId] = [];
    acc[repoId].push(ws);
    return acc;
  }, {} as Record<string, Workspace[]>);

  const standaloneWorkspaces = workspacesByRepo['standalone'] || [];
  const runningCount = workspaces.filter((ws) => ws.status === 'running').length;

  // Auto-expand repos that have the focused workspace
  useEffect(() => {
    if (focusedWorkspaceId) {
      const focusedWorkspace = workspaces.find((ws) => ws.id === focusedWorkspaceId);
      if (focusedWorkspace?.repositoryId) {
        setExpandedRepos((prev) => new Set([...prev, focusedWorkspace.repositoryId!]));
      }
    }
  }, [focusedWorkspaceId, workspaces]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu({ type: null, item: null, x: 0, y: 0 });
    if (contextMenu.item) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.item]);

  const toggleExpand = useCallback((repoId: string) => {
    setExpandedRepos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(repoId)) {
        newSet.delete(repoId);
      } else {
        newSet.add(repoId);
      }
      return newSet;
    });
  }, []);

  const handleWorkspaceContextMenu = useCallback((e: React.MouseEvent, workspace: Workspace) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type: 'workspace', item: workspace, x: e.clientX, y: e.clientY });
  }, []);

  const handleRepoContextMenu = useCallback((e: React.MouseEvent, repository: Repository) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type: 'repository', item: repository, x: e.clientX, y: e.clientY });
  }, []);

  const handleStopWorkspace = useCallback(async () => {
    if (contextMenu.type !== 'workspace' || !contextMenu.item) return;
    const workspace = contextMenu.item as Workspace;
    const session = sessions[workspace.id];
    if (session) {
      try {
        await api.sessions.stop(session.id);
        removeSession(workspace.id);
      } catch (err) {
        console.error('Failed to stop session:', err);
      }
    }
    setContextMenu({ type: null, item: null, x: 0, y: 0 });
  }, [contextMenu, sessions, removeSession]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (contextMenu.type !== 'workspace' || !contextMenu.item) return;
    const workspace = contextMenu.item as Workspace;
    const confirmed = window.confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`);
    if (confirmed) {
      try {
        await api.workspaces.delete(workspace.id);
        removeWorkspace(workspace.id);
      } catch (err) {
        console.error('Failed to delete workspace:', err);
      }
    }
    setContextMenu({ type: null, item: null, x: 0, y: 0 });
  }, [contextMenu, removeWorkspace]);

  const handleDeleteRepository = useCallback(async () => {
    if (contextMenu.type !== 'repository' || !contextMenu.item) return;
    const repository = contextMenu.item as Repository;
    const repoWorkspaces = workspacesByRepo[repository.id] || [];
    const message = repoWorkspaces.length > 0
      ? `Delete repository "${repository.name}"? This will also remove ${repoWorkspaces.length} workspace(s) from this repository.`
      : `Delete repository "${repository.name}"?`;
    const confirmed = window.confirm(message);
    if (confirmed) {
      try {
        await api.repositories.delete(repository.id);
        removeRepository(repository.id);
      } catch (err) {
        console.error('Failed to delete repository:', err);
      }
    }
    setContextMenu({ type: null, item: null, x: 0, y: 0 });
  }, [contextMenu, workspacesByRepo, removeRepository]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold">Parawork</h1>
          <button
            onClick={() => setShowAddRepo(true)}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title="Add repository"
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

      {/* Repository List */}
      <div className="flex-1 overflow-y-auto p-2">
        {repositories.length === 0 && standaloneWorkspaces.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No repositories yet.
            <br />
            Click + to add one.
          </div>
        ) : (
          <div className="space-y-1">
            {/* Repositories with workspaces */}
            {repositories.map((repo) => (
              <RepositoryItem
                key={repo.id}
                repository={repo}
                workspaces={workspacesByRepo[repo.id] || []}
                isExpanded={expandedRepos.has(repo.id)}
                onToggle={() => toggleExpand(repo.id)}
                focusedWorkspaceId={focusedWorkspaceId}
                onSelectWorkspace={setFocusedWorkspace}
                onAddWorkspace={(repository) => onNewWorkspace(repository)}
                onWorkspaceContextMenu={handleWorkspaceContextMenu}
                onRepoContextMenu={handleRepoContextMenu}
                sessions={sessions}
              />
            ))}

            {/* Standalone workspaces */}
            {standaloneWorkspaces.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-xs text-muted-foreground mb-2 px-2 font-medium">
                  Standalone Workspaces
                </h3>
                {standaloneWorkspaces.map((ws) => (
                  <WorkspaceItem
                    key={ws.id}
                    workspace={ws}
                    isFocused={ws.id === focusedWorkspaceId}
                    onClick={() => setFocusedWorkspace(ws.id)}
                    onContextMenu={(e) => handleWorkspaceContextMenu(e, ws)}
                    depth={0}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.item && contextMenu.type === 'workspace' && (
        <WorkspaceContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          workspace={contextMenu.item as Workspace}
          hasSession={!!sessions[(contextMenu.item as Workspace).id]}
          onStop={handleStopWorkspace}
          onDelete={handleDeleteWorkspace}
        />
      )}
      {contextMenu.item && contextMenu.type === 'repository' && (
        <RepositoryContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={handleDeleteRepository}
        />
      )}

      {/* Add Repository Dialog */}
      {showAddRepo && <AddRepositoryDialog onClose={() => setShowAddRepo(false)} />}
    </div>
  );
}

interface RepositoryItemProps {
  repository: Repository;
  workspaces: Workspace[];
  isExpanded: boolean;
  onToggle: () => void;
  focusedWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onAddWorkspace: (repository: Repository) => void;
  onWorkspaceContextMenu: (e: React.MouseEvent, workspace: Workspace) => void;
  onRepoContextMenu: (e: React.MouseEvent, repository: Repository) => void;
  sessions: Record<string, any>;
}

function RepositoryItem({
  repository,
  workspaces,
  isExpanded,
  onToggle,
  focusedWorkspaceId,
  onSelectWorkspace,
  onAddWorkspace,
  onWorkspaceContextMenu,
  onRepoContextMenu,
}: RepositoryItemProps) {
  const runningInRepo = workspaces.filter((ws) => ws.status === 'running').length;

  return (
    <div className="group">
      <div
        onClick={onToggle}
        onContextMenu={(e) => onRepoContextMenu(e, repository)}
        className="w-full p-2 rounded-md text-left transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2 cursor-pointer"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
        )}
        <FolderGit2 className="w-4 h-4 flex-shrink-0 text-green-500" />
        <span className="font-medium truncate flex-1">{repository.name}</span>
        {runningInRepo > 0 && (
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
            {runningInRepo}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddWorkspace(repository);
          }}
          className="p-1 hover:bg-accent-foreground/10 rounded transition-colors"
          title="Add workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Workspaces in this repo */}
      {isExpanded && (
        <div className="ml-4 mt-1 space-y-1">
          {workspaces.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1">No workspaces</p>
          ) : (
            workspaces.map((ws) => (
              <WorkspaceItem
                key={ws.id}
                workspace={ws}
                isFocused={ws.id === focusedWorkspaceId}
                onClick={() => onSelectWorkspace(ws.id)}
                onContextMenu={(e) => onWorkspaceContextMenu(e, ws)}
                depth={1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface WorkspaceItemProps {
  workspace: Workspace;
  isFocused: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  depth: number;
}

function WorkspaceItem({ workspace, isFocused, onClick, onContextMenu, depth }: WorkspaceItemProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        w-full p-2 rounded-md text-left transition-colors
        ${
          isFocused
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent hover:text-accent-foreground'
        }
      `}
      style={{ paddingLeft: `${depth * 8 + 8}px` }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <Folder className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium truncate flex-1 text-sm">{workspace.name}</span>
        <StatusIcon status={workspace.status} />
      </div>
      {workspace.gitWorktree && (
        <div className="flex items-center gap-1 text-xs opacity-75">
          <GitBranch className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{workspace.gitWorktree.branchName}</span>
        </div>
      )}
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

interface WorkspaceContextMenuProps {
  x: number;
  y: number;
  workspace: Workspace;
  hasSession: boolean;
  onStop: () => void;
  onDelete: () => void;
}

function WorkspaceContextMenu({ x, y, workspace, hasSession, onStop, onDelete }: WorkspaceContextMenuProps) {
  const isRunning = workspace.status === 'running';

  return (
    <div
      className="fixed z-50 min-w-[160px] bg-background border border-border rounded-md shadow-lg py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {isRunning && hasSession && (
        <button
          onClick={onStop}
          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
      )}
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

interface RepositoryContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
}

function RepositoryContextMenu({ x, y, onDelete }: RepositoryContextMenuProps) {
  return (
    <div
      className="fixed z-50 min-w-[160px] bg-background border border-border rounded-md shadow-lg py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onDelete}
        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground transition-colors text-red-500"
      >
        <Trash2 className="w-4 h-4" />
        Remove Repository
      </button>
    </div>
  );
}
