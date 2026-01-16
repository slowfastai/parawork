/**
 * File Explorer Tree - Recursive tree view for workspace files
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  FileCode,
  FileJson,
  FileText,
  Image,
  Loader,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { FileEntry } from '@parawork/shared';

interface FileExplorerTreeProps {
  workspacePath?: string;
}

export function FileExplorerTree({ workspacePath }: FileExplorerTreeProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Record<string, FileEntry[]>>({});

  // Load root directory
  useEffect(() => {
    if (!workspacePath) {
      setEntries([]);
      setExpandedDirs(new Set());
      setDirContents({});
      return;
    }

    const loadRoot = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.filesystem.list(workspacePath);
        setEntries(response.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoading(false);
      }
    };

    loadRoot();
  }, [workspacePath]);

  // Toggle directory expansion
  const toggleDir = useCallback(async (path: string) => {
    setExpandedDirs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
        // Load contents if not already loaded
        if (!dirContents[path]) {
          loadDirContents(path);
        }
      }
      return newSet;
    });
  }, [dirContents]);

  // Load directory contents
  const loadDirContents = async (path: string) => {
    try {
      const response = await api.filesystem.list(path);
      setDirContents((prev) => ({
        ...prev,
        [path]: response.entries,
      }));
    } catch (err) {
      console.error('Failed to load directory:', path, err);
    }
  };

  // No workspace selected
  if (!workspacePath) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <p>Select a workspace to browse files</p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">
        <p>Error: {error}</p>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <p>No files found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <TreeItems
        entries={entries}
        depth={0}
        expandedDirs={expandedDirs}
        dirContents={dirContents}
        onToggle={toggleDir}
      />
    </div>
  );
}

interface TreeItemsProps {
  entries: FileEntry[];
  depth: number;
  expandedDirs: Set<string>;
  dirContents: Record<string, FileEntry[]>;
  onToggle: (path: string) => void;
}

function TreeItems({ entries, depth, expandedDirs, dirContents, onToggle }: TreeItemsProps) {
  return (
    <div className="space-y-0.5">
      {entries.map((entry) => (
        <TreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
          isExpanded={expandedDirs.has(entry.path)}
          children={dirContents[entry.path]}
          expandedDirs={expandedDirs}
          dirContents={dirContents}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

interface TreeItemProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  children?: FileEntry[];
  expandedDirs: Set<string>;
  dirContents: Record<string, FileEntry[]>;
  onToggle: (path: string) => void;
}

function TreeItem({
  entry,
  depth,
  isExpanded,
  children,
  expandedDirs,
  dirContents,
  onToggle,
}: TreeItemProps) {
  const Icon = getFileIcon(entry);

  return (
    <div>
      <button
        onClick={() => entry.isDirectory && onToggle(entry.path)}
        className={`
          w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-md transition-colors
          hover:bg-accent hover:text-accent-foreground text-left
          ${entry.isDirectory ? 'cursor-pointer' : 'cursor-default'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {entry.isDirectory ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-4" />
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 ${entry.isDirectory ? 'text-blue-400' : 'text-muted-foreground'}`} />
        <span className="truncate flex-1">{entry.name}</span>
      </button>

      {/* Children */}
      {entry.isDirectory && isExpanded && children && (
        <TreeItems
          entries={children}
          depth={depth + 1}
          expandedDirs={expandedDirs}
          dirContents={dirContents}
          onToggle={onToggle}
        />
      )}

      {/* Loading placeholder for directories being expanded */}
      {entry.isDirectory && isExpanded && !children && (
        <div
          className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground"
          style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
        >
          <Loader className="w-3 h-3 animate-spin" />
          <span>Loading...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Get appropriate icon for a file based on extension
 */
function getFileIcon(entry: FileEntry) {
  if (entry.isDirectory) {
    return Folder;
  }

  const ext = entry.name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
    case 'cs':
    case 'php':
    case 'swift':
    case 'kt':
    case 'scala':
    case 'vue':
    case 'svelte':
      return FileCode;

    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return FileJson;

    case 'md':
    case 'txt':
    case 'rtf':
    case 'doc':
    case 'docx':
      return FileText;

    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
      return Image;

    default:
      return File;
  }
}
