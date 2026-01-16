/**
 * Add Repository Dialog - Search or browse for a git repository to add
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { X, FolderOpen, AlertCircle, Search, GitBranch, Loader2 } from 'lucide-react';
import { DirectoryBrowser } from '../DirectoryBrowser';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import type { DirectoryEntry } from '@parawork/shared';

interface AddRepositoryDialogProps {
  onClose: () => void;
}

export function AddRepositoryDialog({ onClose }: AddRepositoryDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DirectoryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<{ name: string; path: string } | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addRepository = useAppStore((state) => state.addRepository);

  // Search for repos with debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await api.filesystem.searchRepos(searchQuery);
        setSearchResults(response.results);
        setShowResults(true);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectFromSearch = useCallback((entry: DirectoryEntry) => {
    setSelectedRepo({ name: entry.name, path: entry.path });
    setSearchQuery(entry.name);
    setShowResults(false);
    setError(null);
  }, []);

  const handleSelectFromBrowser = useCallback((selectedPath: string, folderName: string) => {
    setSelectedRepo({ name: folderName, path: selectedPath });
    setSearchQuery(folderName);
    setShowBrowser(false);
    setError(null);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedRepo(null);
    setSearchQuery('');
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) return;

    setLoading(true);
    setError(null);

    try {
      const repository = await api.repositories.create({
        name: selectedRepo.name,
        path: selectedRepo.path,
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

          {/* Selected Repository (shown when selected) */}
          {selectedRepo ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Selected Repository
                </label>
                <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-muted/50">
                  <GitBranch className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="flex-1 truncate font-medium">{selectedRepo.name}</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="p-1 hover:bg-accent rounded transition-colors"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Path
                </label>
                <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-sm text-muted-foreground truncate">
                  {selectedRepo.path}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Browse button (primary action) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Select Repository
                </label>
                <button
                  type="button"
                  onClick={() => setShowBrowser(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-md hover:bg-accent transition-colors"
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>Browse for repository...</span>
                </button>
              </div>

              {/* Search input (quick-find) */}
              <div ref={searchRef} className="relative">
                <label className="block text-sm font-medium mb-1">
                  Or search by name
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    placeholder="Type to search git repositories..."
                    className="w-full pl-9 pr-10 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() => handleSelectFromSearch(entry)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors"
                      >
                        <GitBranch className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{entry.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{entry.path}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
                    No repositories found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </>
          )}

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
              disabled={loading || !selectedRepo}
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
          onSelect={handleSelectFromBrowser}
          onClose={() => setShowBrowser(false)}
          title="Select Git Repository"
          selectLabel="Select Repository"
          filterGitOnly={true}
        />
      )}
    </div>
  );
}
