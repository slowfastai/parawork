/**
 * Three-panel resizable layout component
 * Left: Repositories + Workspaces
 * Middle: Agent Terminal
 * Right: File Explorer + User Terminal
 *
 * Using CSS flexbox for reliable panel sizing
 */
import { useState, useRef, useCallback } from 'react';
import { RepositorySwitcher } from '../RepositorySwitcher/RepositorySwitcher';
import { AgentTerminalPanel } from '../AgentTerminalPanel';
import { RightPanel } from '../RightPanel';

interface PanelLayoutProps {
  onNewWorkspace: () => void;
}

export function PanelLayout({ onNewWorkspace }: PanelLayoutProps) {
  // Panel widths in percentages
  const [leftWidth, setLeftWidth] = useState(20);
  const [rightWidth, setRightWidth] = useState(30);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<'left' | 'right' | null>(null);

  const handleMouseDown = useCallback((separator: 'left' | 'right') => {
    isDraggingRef.current = separator;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;
    const percentage = (mouseX / containerWidth) * 100;

    if (isDraggingRef.current === 'left') {
      // Left separator: adjust left panel width
      const newLeftWidth = Math.max(15, Math.min(35, percentage));
      setLeftWidth(newLeftWidth);
    } else if (isDraggingRef.current === 'right') {
      // Right separator: adjust right panel width
      const newRightWidth = Math.max(20, Math.min(45, 100 - percentage));
      setRightWidth(newRightWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Middle panel takes remaining space
  const middleWidth = 100 - leftWidth - rightWidth;

  return (
    <div
      ref={containerRef}
      className="flex h-screen w-screen"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left Panel */}
      <div
        className="flex-shrink-0 bg-muted/30 overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        <RepositorySwitcher onNewWorkspace={onNewWorkspace} />
      </div>

      {/* Left Separator */}
      <div
        className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0"
        onMouseDown={() => handleMouseDown('left')}
      />

      {/* Middle Panel */}
      <div
        className="overflow-hidden"
        style={{ width: `${middleWidth}%` }}
      >
        <AgentTerminalPanel />
      </div>

      {/* Right Separator */}
      <div
        className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0"
        onMouseDown={() => handleMouseDown('right')}
      />

      {/* Right Panel */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{ width: `${rightWidth}%` }}
      >
        <RightPanel />
      </div>
    </div>
  );
}
