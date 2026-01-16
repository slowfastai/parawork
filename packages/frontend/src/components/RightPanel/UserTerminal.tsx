/**
 * User Terminal - Separate terminal for user commands
 * This is a placeholder that will be implemented with a separate PTY connection
 */
import { Terminal } from 'lucide-react';

interface UserTerminalProps {
  workspacePath?: string;
}

export function UserTerminal({ workspacePath }: UserTerminalProps) {
  if (!workspacePath) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <p>Select a workspace to open terminal</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Terminal Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/20 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">{workspacePath}</span>
      </div>

      {/* Terminal Placeholder */}
      <div className="flex-1 flex items-center justify-center bg-black/90">
        <div className="text-center text-muted-foreground">
          <Terminal className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">User terminal</p>
          <p className="text-xs opacity-60 mt-1">Coming in next update</p>
        </div>
      </div>
    </div>
  );
}
