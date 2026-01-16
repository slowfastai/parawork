/**
 * Add Repository Dialog - Select a git repository to add
 */
import { useState, useCallback } from 'react';
import { X, FolderOpen, AlertCircle } from 'lucide-react';
import { DirectoryBrowser } from '../DirectoryBrowser';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';

interface AddRepositoryDialogProps {
  onClose: () => void;
}

export function AddRepositoryDialog({ onClose }: AddRepositoryDialogProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRepository = useAppStore((state) => state.addRepository);

  const handleSelectPath = useCallback((selectedPath: string, folderName: string) => {
    setPath(selectedPath);
    // Auto-fill name from folder name if empty
    if (!name) {
      setName(folderName);
    }
    setShowBrowser(false);
    setError(null);
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const repository = await api.repositories.create({
        name: name.trim(),
        path: path.trim(),
      });
      addRepository(repository);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add Repository</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Repository Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Repository Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., my-project"
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Repository Path */}
          <div>
            <label htmlFor="path" className="block text-sm font-medium mb-1">
              Repository Path
            </label>
            <div className="flex gap-2">
              <input
                id="path"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/git/repository"
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="button"
                onClick={() => setShowBrowser(true)}
                className="px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors"
                title="Browse for repository"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select a directory that contains a .git folder
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !path.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Repository'}
            </button>
          </div>
        </form>
      </div>

      {/* Directory Browser */}
      {showBrowser && (
        <DirectoryBrowser
          onSelect={handleSelectPath}
          onClose={() => setShowBrowser(false)}
          title="Select Git Repository"
          selectLabel="Select Repository"
          filterGitOnly={true}
        />
      )}
    </div>
  );
}
