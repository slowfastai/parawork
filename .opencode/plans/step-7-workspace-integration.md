# Step 7: WorkspaceView Integration

## File: `packages/frontend/src/components/WorkspaceView/WorkspaceView.tsx`

**Add imports at top:**

```typescript
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { api } from '../../lib/api';
import { FileChanges } from './FileChanges';
import { XTerminal } from './XTerminal';
import { SessionHistoryModal } from './SessionHistoryModal';
import type { Session, FileChange, ServerToClientEvent } from '@parawork/shared';
```

**Add state variables (around line 21, after existing state):**

```typescript
const [session, setSession] = useState<Session | null>(null);
const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
const [showHistoryModal, setShowHistoryModal] = useState(false);
```

**Add session resume handler (after existing useEffect hooks):**

```typescript
const handleSessionResume = async (sessionId: string) => {
  try {
    // Resume the session via API
    const response = await api.sessions.resume(sessionId);
    const newSession = response.data;
    
    // Update local state
    setSession(newSession);
    setCurrentSession(workspace.id, newSession);
    
    // Update workspace status to running
    await api.workspaces.update(workspace.id, { status: 'running' });
    
    console.log('Session resumed successfully:', newSession);
  } catch (error) {
    console.error('Error resuming session:', error);
    // Could show toast notification here
  }
};
```

**Update header section to include history button (around line 138):**

```typescript
{/* Header */}
<div className="border-b border-border p-4">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-xl font-semibold">{workspace.name}</h2>
      <p className="text-sm text-muted-foreground">{workspace.path}</p>
    </div>
    
    {/* Action Buttons */}
    <div className="flex gap-2">
      {/* Show history button when no active session */}
      {!session && workspace.status !== 'running' && (
        <button
          onClick={() => setShowHistoryModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          title="View and resume previous sessions"
        >
          <Clock className="w-4 h-4" />
          View Chat History
        </button>
      )}
    </div>
  </div>
</div>
```

**Add SessionHistoryModal component (after main content div, before closing return):**

```typescript
{/* Session History Modal */}
<SessionHistoryModal
  workspaceId={workspace.id}
  isOpen={showHistoryModal}
  onClose={() => setShowHistoryModal(false)}
  onSessionResume={handleSessionResume}
/>
```

## Integration Details

**Button Display Logic:**
- Only shows when no active session
- Only when workspace isn't already running
- Disappears when session starts
- Reappears when session completes/stops

**Session Resume Flow:**
1. User clicks "View Chat History" → Opens modal
2. User selects session and clicks "Resume" → Triggers handler
3. API call to resume session → Creates new session with context
4. Update local state → Workspace shows active session
5. Update workspace status → Synchronizes with backend
6. Terminal starts → User can continue conversation

**State Management:**
- Modal visibility handled locally
- Session state managed through existing patterns
- Workspace updates use existing API methods
- Store integration maintains consistency

## WebSocket Considerations

Existing WebSocket subscriptions automatically handle resumed sessions because:
- Subscriptions are workspace-based
- New session has same workspace ID
- Events flow through existing handlers
- No additional WebSocket changes needed

## Error Handling

**Resume Failures:**
- Network errors logged to console
- Could extend with toast notifications
- Modal remains open for retry
- User can select different session

**State Inconsistencies:**
- Store updates ensure frontend/backend sync
- Existing session loading patterns handle edge cases
- Component re-renders on state changes

## User Experience Flow

1. **Initial State**: User sees workspace with history button
2. **History Browse**: Modal opens, shows completed sessions
3. **Session Selection**: Click session to preview conversation
4. **Resume Action**: Click resume button in modal
5. **Transition**: Modal closes, workspace activates
6. **Active Session**: Terminal appears, chat history loaded

## Styling Consistency

- Uses existing Tailwind classes
- Matches current design patterns
- Responsive button placement
- Consistent spacing and colors

## Performance Considerations

- Modal only renders when open
- Lazy loading of session data
- Efficient state updates
- Minimal re-renders during transitions

This integration seamlessly adds chat history browsing to the existing workspace interface while maintaining all current functionality and design patterns.