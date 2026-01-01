/**
 * Directory Browser Component
 * Allows users to visually browse and select project directories
 */
import { useState, useEffect } from 'react';
import { Folder, GitBranch, X, Home, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { DirectoryEntry } from '@parawork/shared';

interface DirectoryBrowserProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  initialPath?: string;
}

export function DirectoryBrowser({ onSelect, onClose, initialPath }: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '~');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch directory contents
  const fetchDirectory = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.filesystem.browse(path);
      setCurrentPath(response.currentPath);
      setParentPath(response.parentPath);
      setEntries(response.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  };

  // Load initial directory
  useEffect(() => {
    fetchDirectory(currentPath);
  }, []);

  // Navigate to a new directory
  const navigateTo = (path: string) => {
    fetchDirectory(path);
  };

  // Navigate to parent directory
  const navigateToParent = () => {
    if (parentPath) {
      navigateTo(parentPath);
    }
  };

  // Parse breadcrumb segments from path
  const getBreadcrumbs = () => {
    if (!currentPath) return [];

    const segments = currentPath.split('/').filter(Boolean);
    const breadcrumbs: Array<{ name: string; path: string }> = [
      { name: 'Root', path: '/' },
    ];

    let accumulatedPath = '';
    for (const segment of segments) {
      accumulatedPath += '/' + segment;
      breadcrumbs.push({
        name: segment,
        path: accumulatedPath,
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg w-full max-w-3xl h-[32rem] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Browse Directories</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1 text-sm overflow-x-auto">
            <button
              onClick={() => navigateTo('~')}
              className="flex items-center gap-1 px-2 py-1 hover:bg-accent rounded transition-colors"
              title="Home directory"
            >
              <Home className="w-4 h-4" />
            </button>
            {breadcrumbs.map((crumb) => (
              <div key={crumb.path} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => navigateTo(crumb.path)}
                  className="px-2 py-1 hover:bg-accent rounded transition-colors truncate max-w-[200px]"
                  title={crumb.path}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
              <p className="font-medium">Error loading directory</p>
              <p className="text-sm mt-1">{error}</p>
              {parentPath && (
                <button
                  onClick={navigateToParent}
                  className="mt-2 text-sm underline"
                >
                  Go back to parent directory
                </button>
              )}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No directories found
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="space-y-1">
              {/* Parent directory link */}
              {parentPath && (
                <button
                  onClick={navigateToParent}
                  className="w-full flex items-center gap-2 p-3 hover:bg-accent rounded-md transition-colors text-left"
                >
                  <Folder className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 font-medium">..</span>
                  <span className="text-sm text-muted-foreground">Parent directory</span>
                </button>
              )}

              {/* Directory entries */}
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => navigateTo(entry.path)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-accent rounded-md transition-colors text-left group"
                >
                  <Folder className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{entry.name}</span>

                  {/* Git badge */}
                  {entry.isGitRepository && entry.gitInfo && (
                    <div
                      className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500 flex-shrink-0"
                      title={`Branch: ${entry.gitInfo.branch || 'unknown'}\nRemote: ${entry.gitInfo.remote || 'none'}`}
                    >
                      <GitBranch className="w-4 h-4" />
                      {entry.gitInfo.branch && (
                        <span className="max-w-[100px] truncate">
                          {entry.gitInfo.branch}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <div className="text-sm text-muted-foreground truncate max-w-[60%]" title={currentPath}>
            {currentPath}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSelect(currentPath)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Select This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
