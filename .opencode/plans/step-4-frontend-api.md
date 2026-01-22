# Step 4: Frontend API Client Extensions

## File: `packages/frontend/src/lib/api.ts`

**Extend the sessions object (around line 188, after existing sessions methods):**

```typescript
sessions: {
  // ... existing methods
  getHistory: (workspaceId: string) =>
    fetchApi<SessionHistoryItem[]>(`/workspaces/${workspaceId}/sessions/history`),

  getFullConversation: (sessionId: string) =>
    fetchApi<ConversationEvent[]>(`/sessions/${sessionId}/full-conversation`),

  resume: (sessionId: string) =>
    fetchApi<Session>(`/sessions/${sessionId}/resume`, {
      method: 'POST',
    }),
},
```

**Also add imports to the top of the file (around line 4):**

```typescript
import type {
  Workspace,
  Session,
  Message,
  FileChange,
  AgentLog,
  SessionHistoryItem,
  ConversationEvent,
  Repository,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  CreateRepositoryRequest,
  UpdateRepositoryRequest,
  CreateSessionRequest,
  SendMessageRequest,
  ApiResponse,
  BrowseResponse,
  FileListResponse,
  SearchReposResponse,
} from '@parawork/shared';
```

## API Client Details

**`getHistory(workspaceId)`:**
- Fetches completed sessions with metadata
- Returns SessionHistoryItem[] with message counts, duration, previews
- Used by SessionHistoryModal for session listing

**`getFullConversation(sessionId)`:**
- Fetches unified conversation timeline
- Returns ConversationEvent[] sorted chronologically
- Used by ConversationTimeline for preview display

**`resume(sessionId)`:**
- Creates new session with historical context
- Returns new Session object
- Triggers workspace state updates

## Error Handling Considerations

The existing `fetchApi` wrapper handles:
- Network errors automatically
- Response parsing
- API error responses
- Authentication (API key headers)

## Usage Examples

```typescript
// Fetch session history
const { data: history } = await api.sessions.getHistory(workspaceId);

// Fetch conversation preview
const { data: conversation } = await api.sessions.getFullConversation(sessionId);

// Resume session
const { data: newSession } = await api.sessions.resume(sessionId);
```

## TypeScript Benefits

With these additions, you get:
- Full type safety for API responses
- Autocomplete in IDE
- Compile-time error checking
- Better developer experience

## Integration Points

These API methods will be used by:
1. SessionHistoryModal for loading sessions
2. ConversationTimeline for displaying conversations  
3. WorkspaceView for session resumption