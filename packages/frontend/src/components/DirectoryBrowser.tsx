/**
 * Directory Browser Component
 * Allows users to visually browse and select project directories
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Folder, GitBranch, X, Home, ChevronRight, Grid3x3, List, Search } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<DirectoryEntry | null>(null);

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
  const navigateTo = useCallback((path: string) => {
    setSelectedEntry(null); // Clear selection when navigating
    fetchDirectory(path);
  }, []);

  // Navigate to parent directory
  const navigateToParent = () => {
    if (parentPath) {
      navigateTo(parentPath);
    }
  };

  // Handle single-click: select folder
  const handleSingleClick = (entry: DirectoryEntry) => {
    setSelectedEntry(entry);
  };

  // Handle double-click: navigate into folder
  const handleDoubleClick = (entry: DirectoryEntry) => {
    navigateTo(entry.path);
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events from input fields to prevent conflicts
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter' && selectedEntry) {
        // Enter key navigates into the selected folder
        navigateTo(selectedEntry.path);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntry, navigateTo]);

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

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) {
      return entries;
    }
    const query = searchQuery.toLowerCase();
    return entries.filter(entry => entry.name.toLowerCase().includes(query));
  }, [entries, searchQuery]);

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
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Browse Directories</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-accent rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search and View Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search directories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
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
            <>
              {/* Parent directory link */}
              {parentPath && (
                <button
                  onClick={navigateToParent}
                  className="w-full flex items-center gap-2 p-3 mb-2 hover:bg-accent rounded-md transition-colors text-left"
                >
                  <Folder className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 font-medium">..</span>
                  <span className="text-sm text-muted-foreground">Parent directory</span>
                </button>
              )}

              {/* No results message */}
              {filteredEntries.length === 0 && searchQuery && (
                <div className="text-center py-8 text-muted-foreground">
                  No directories found matching "{searchQuery}"
                </div>
              )}

              {/* List View */}
              {viewMode === 'list' && filteredEntries.length > 0 && (
                <div className="space-y-1">
                  {filteredEntries.map((entry) => (
                    <button
                      key={entry.path}
                      onClick={() => handleSingleClick(entry)}
                      onDoubleClick={() => handleDoubleClick(entry)}
                      className={`w-full flex items-center gap-2 p-3 rounded-md transition-colors text-left group ${
                        selectedEntry?.path === entry.path
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'hover:bg-accent border-2 border-transparent'
                      }`}
                    >
                      <Folder className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate">{entry.name}</span>

                      {/* Git repository indicator (icon only, no branch name) */}
                      {entry.isGitRepository && (
                        <div title="Git repository" className="flex-shrink-0">
                          <GitBranch className="w-4 h-4 text-green-600 dark:text-green-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Grid View */}
              {viewMode === 'grid' && filteredEntries.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredEntries.map((entry) => (
                    <button
                      key={entry.path}
                      onClick={() => handleSingleClick(entry)}
                      onDoubleClick={() => handleDoubleClick(entry)}
                      className={`flex flex-col items-center p-3 rounded-md transition-colors group ${
                        selectedEntry?.path === entry.path
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'hover:bg-accent border-2 border-transparent'
                      }`}
                    >
                      <div className="relative mb-2">
                        <Folder className="w-12 h-12 text-blue-400" />
                        {/* Git repository indicator badge (icon only, no branch name) */}
                        {entry.isGitRepository && (
                          <div title="Git repository" className="absolute -bottom-1 -right-1">
                            <GitBranch className="w-4 h-4 text-green-600 dark:text-green-500 bg-background rounded-full p-0.5" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-center truncate w-full px-1" title={entry.name}>
                        {entry.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <div className="text-sm text-muted-foreground truncate max-w-[60%]" title={selectedEntry?.path || currentPath}>
            {selectedEntry ? selectedEntry.path : currentPath}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedEntry && onSelect(selectedEntry.path)}
              disabled={!selectedEntry}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedEntry
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              Select This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
