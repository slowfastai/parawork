/**
 * Right Panel - File Explorer + User Terminal with tabs
 */
import { useState } from 'react';
import { FolderTree, Terminal } from 'lucide-react';
import { FileExplorerTree } from './FileExplorerTree';
import { UserTerminal } from './UserTerminal';
import { useAppStore } from '../../stores/appStore';

type TabId = 'files' | 'terminal';

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('files');

  const focusedWorkspaceId = useAppStore((state) => state.focusedWorkspaceId);
  const workspaces = useAppStore((state) => state.workspaces);

  const workspace = workspaces.find((ws) => ws.id === focusedWorkspaceId);

  const tabs = [
    { id: 'files' as TabId, label: 'Files', icon: FolderTree },
    { id: 'terminal' as TabId, label: 'Terminal', icon: Terminal },
  ];

  return (
    <div className="h-full flex flex-col border-l border-border">
      {/* Tab Bar */}
      <div className="flex border-b border-border bg-muted/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'border-b-2 border-primary text-foreground bg-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <FileExplorerTree workspacePath={workspace?.path} />
        )}
        {activeTab === 'terminal' && (
          <UserTerminal workspacePath={workspace?.path} />
        )}
      </div>
    </div>
  );
}
