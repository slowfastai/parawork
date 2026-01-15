/**
 * New Workspace Dialog
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../stores/appStore';
import type { AgentType } from '@parawork/shared';
import { DirectoryBrowser } from './DirectoryBrowser';

interface NewWorkspaceDialogProps {
  onClose: () => void;
}

export function NewWorkspaceDialog({ onClose }: NewWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('claude-code');
  const [creating, setCreating] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);

  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const setFocusedWorkspace = useAppStore((state) => state.setFocusedWorkspace);
  const updateWorkspace = useAppStore((state) => state.updateWorkspace);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !path.trim() || creating) return;

    setCreating(true);
    try {
      const workspace = await api.workspaces.create({
        name: name.trim(),
        path: path.trim(),
        agentType,
      });

      addWorkspace(workspace);
      setFocusedWorkspace(workspace.id);

      // Auto-start the session immediately after creating workspace
      const session = await api.sessions.create(workspace.id, {
        agentType,
      });

      // Store the session in the global store so WorkspaceView can use it
      setCurrentSession(workspace.id, session);

      // Update workspace status in store to match backend
      updateWorkspace(workspace.id, { status: 'running' });

      // Close dialog immediately (no alert to block the flow)
      onClose();

      console.log('[NewWorkspaceDialog] Workspace created:', {
        workspaceId: workspace.id,
        sessionId: session.id,
        sessionStatus: session.status
      });
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">New Workspace</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-feature"
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Project Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/project"
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="button"
                onClick={() => setShowBrowser(true)}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors whitespace-nowrap"
              >
                Browse...
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select a git repository to auto-create a worktree, or any directory for a regular workspace
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Agent Type
            </label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value as AgentType)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="claude-code">Claude Code</option>
              <option value="codex">Codex CLI</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim() || !path.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>

      {/* Directory Browser */}
      {showBrowser && (
        <DirectoryBrowser
          onSelect={(selectedPath) => {
            setPath(selectedPath);
            setShowBrowser(false);
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
