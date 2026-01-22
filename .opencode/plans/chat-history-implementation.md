# Chat History Feature Implementation Plan

## Overview
This plan outlines the implementation of a comprehensive chat history viewing and session resumption feature for the Parawork workspace management system.

## Implementation Steps

### 1. Backend Type Extensions (`packages/shared/src/types.ts`)

**Add new interfaces:**
```typescript
/**
 * SessionHistoryItem represents a completed session with metadata
 */
export interface SessionHistoryItem extends Session {
  messageCount: number;
  duration: number;
  lastMessage?: string;
}

/**
 * ConversationEvent represents a unified event in conversation timeline
 */
export interface ConversationEvent {
  id: string;
  type: 'message' | 'terminal_input' | 'terminal_output' | 'agent_log';
  timestamp: number;
  content: string;
  role?: MessageRole;
  level?: LogLevel;
}
```

### 2. Backend Database Queries (`packages/backend/src/db/queries.ts`)

**Add to sessionQueries:**
```typescript
/**
 * Get completed sessions for workspace with metadata
 */
getCompletedByWorkspaceId(workspaceId: string): SessionHistoryItem[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT 
      s.*,
      COUNT(m.id) as message_count,
      CASE 
        WHEN s.completed_at IS NOT NULL AND s.started_at IS NOT NULL 
        THEN s.completed_at - s.started_at 
        ELSE 0 
      END as duration,
      (
        SELECT m.content 
        FROM messages m 
        WHERE m.session_id = s.id 
        ORDER BY m.timestamp DESC 
        LIMIT 1
      ) as last_message
    FROM sessions s
    LEFT JOIN messages m ON s.id = m.session_id
    WHERE s.workspace_id = ? AND s.status IN ('completed', 'failed')
    GROUP BY s.id
    ORDER BY s.started_at DESC
  `);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map(row => ({
    ...rowToSession(row),
    messageCount: row.message_count,
    duration: row.duration,
    lastMessage: row.last_message
  }));
}

/**
 * Get full conversation timeline for a session
 */
getFullConversation(sessionId: string): ConversationEvent[] {
  const db = getDatabase();
  
  // Get messages
  const messageStmt = db.prepare(`
    SELECT 'message' as type, id, timestamp, content, role, NULL as level
    FROM messages 
    WHERE session_id = ? 
  `);
  
  // Get agent logs (as terminal activity)
  const logStmt = db.prepare(`
    SELECT 'agent_log' as type, id, timestamp, message as content, NULL as role, level
    FROM agent_logs 
    WHERE session_id = ? 
  `);
  
  const messages = messageStmt.all(sessionId) as any[];
  const logs = logStmt.all(sessionId) as any[];
  
  // Merge and sort by timestamp
  return [...messages, ...logs]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(row => ({
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      content: row.content,
      role: row.role,
      level: row.level
    }));
}
```

### 3. Backend API Routes (`packages/backend/src/api/routes/sessions.ts`)

**Add new endpoints:**
```typescript
/**
 * GET /api/workspaces/:id/sessions/history
 * Get completed sessions with metadata
 */
router.get('/workspaces/:id/sessions/history', (req, res) => {
  try {
    const sessions = sessionQueries.getCompletedByWorkspaceId(req.params.id);
    const response: ApiResponse<SessionHistoryItem[]> = {
      success: true,
      data: sessions,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching session history:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch session history',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/sessions/:id/full-conversation
 * Get complete conversation timeline
 */
router.get('/sessions/:id/full-conversation', (req, res) => {
  try {
    const conversation = sessionQueries.getFullConversation(req.params.id);
    const response: ApiResponse<ConversationEvent[]> = {
      success: true,
      data: conversation,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch conversation',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/sessions/:id/resume
 * Resume a session with historical context
 */
router.post('/sessions/:id/resume', async (req, res) => {
  try {
    const originalSession = sessionQueries.getById(req.params.id);
    if (!originalSession) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }

    // Create new session with context from original
    const newSessionId = uuidv4();
    const newSession: Session = {
      id: newSessionId,
      workspaceId: originalSession.workspaceId,
      agentType: originalSession.agentType,
      status: 'starting',
      processId: null,
      startedAt: null,
      completedAt: null,
    };

    const created = sessionQueries.create(newSession);
    
    // Copy messages to new session for context
    const originalMessages = messageQueries.getBySessionId(req.params.id);
    for (const message of originalMessages) {
      const contextMessage: Message = {
        ...message,
        id: uuidv4(),
        sessionId: newSessionId,
      };
      messageQueries.create(contextMessage);
    }

    // Start the agent
    await startAgent(newSessionId, originalSession.workspaceId, originalSession.agentType);

    const response: ApiResponse<Session> = {
      success: true,
      data: created,
    };
    res.json(response);
  } catch (error) {
    console.error('Error resuming session:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to resume session',
    };
    res.status(500).json(response);
  }
});
```

### 4. Frontend API Client (`packages/frontend/src/lib/api.ts`)

**Extend sessions API:**
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

### 5. Frontend Components

**SessionHistoryModal Component:**
```typescript
// packages/frontend/src/components/WorkspaceView/SessionHistoryModal.tsx
import { useState, useEffect } from 'react';
import { X, Clock, MessageCircle, Play } from 'lucide-react';
import { api } from '../../lib/api';
import type { SessionHistoryItem, ConversationEvent } from '@parawork/shared';
import { ConversationTimeline } from './ConversationTimeline';

interface SessionHistoryModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSessionResume: (sessionId: string) => void;
}

export function SessionHistoryModal({ 
  workspaceId, 
  isOpen, 
  onClose, 
  onSessionResume 
}: SessionHistoryModalProps) {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null);
  const [conversation, setConversation] = useState<ConversationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadSessions();
    }
  }, [isOpen, workspaceId]);

  const loadSessions = async () => {
    try {
      const response = await api.sessions.getHistory(workspaceId);
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading session history:', error);
    }
  };

  const loadConversation = async (sessionId: string) => {
    setLoading(true);
    try {
      const response = await api.sessions.getFullConversation(sessionId);
      setConversation(response.data);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (session: SessionHistoryItem) => {
    setSelectedSession(session);
    loadConversation(session.id);
  };

  const handleResume = () => {
    if (selectedSession) {
      onSessionResume(selectedSession.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Session History</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Session List */}
          <div className="w-80 border-r overflow-y-auto p-4">
            <h3 className="font-medium mb-3">Completed Sessions</h3>
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No completed sessions found</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedSession?.id === session.id 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleSessionSelect(session)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{session.agentType}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        session.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(session.startedAt!).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {session.messageCount} messages
                      </div>
                    </div>
                    {session.lastMessage && (
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {session.lastMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversation Preview */}
          <div className="flex-1 flex flex-col">
            {selectedSession ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">
                        {selectedSession.agentType} - {new Date(selectedSession.startedAt!).toLocaleString()}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedSession.messageCount} messages • {Math.round(selectedSession.duration / 60000)} minutes
                      </p>
                    </div>
                    <button
                      onClick={handleResume}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      <Play className="w-4 h-4" />
                      Resume Session
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="text-center text-muted-foreground">Loading conversation...</div>
                  ) : (
                    <ConversationTimeline events={conversation} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a session to view conversation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**ConversationTimeline Component:**
```typescript
// packages/frontend/src/components/WorkspaceView/ConversationTimeline.tsx
import type { ConversationEvent } from '@parawork/shared';

interface ConversationTimelineProps {
  events: ConversationEvent[];
}

export function ConversationTimeline({ events }: ConversationTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        No conversation activity found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex-shrink-0 text-xs text-muted-foreground w-20">
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
          <div className="flex-1">
            {event.type === 'message' && (
              <div className={`flex ${event.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    event.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{event.content}</p>
                  <p className="text-xs opacity-70 mt-1 capitalize">{event.role}</p>
                </div>
              </div>
            )}
            {event.type === 'agent_log' && (
              <div className="bg-muted/50 rounded p-3">
                <p className="text-sm font-mono whitespace-pre-wrap">{event.content}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {event.level} • Agent Activity
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 6. WorkspaceView Integration

**Add history button and modal management:**
```typescript
// Add to WorkspaceView.tsx state
const [showHistoryModal, setShowHistoryModal] = useState(false);

// Add button in header when no active session
{!session && (
  <div className="flex gap-2">
    <button
      onClick={() => setShowHistoryModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
    >
      <Clock className="w-4 h-4" />
      View Chat History
    </button>
  </div>
)}

// Add modal component
<SessionHistoryModal
  workspaceId={workspace.id}
  isOpen={showHistoryModal}
  onClose={() => setShowHistoryModal(false)}
  onSessionResume={async (sessionId) => {
    try {
      const response = await api.sessions.resume(sessionId);
      const newSession = response.data;
      setSession(newSession);
      setCurrentSession(workspace.id, newSession);
      
      // Update workspace status to running
      await api.workspaces.update(workspace.id, { status: 'running' });
    } catch (error) {
      console.error('Error resuming session:', error);
    }
  }}
/>
```

## Implementation Priority

1. **High Priority**: Backend types, database queries, API endpoints
2. **High Priority**: Frontend API client extensions
3. **Medium Priority**: SessionHistoryModal component
4. **Medium Priority**: ConversationTimeline component  
5. **Medium Priority**: WorkspaceView integration
6. **Low Priority**: WebSocket handling for resumed sessions
7. **Low Priority**: Testing and edge case handling

## Testing Strategy

1. **Backend Unit Tests**: Test new database queries and API endpoints
2. **Integration Tests**: Test full session resumption flow
3. **Frontend Tests**: Component rendering and user interactions
4. **E2E Tests**: Complete user workflow from history view to resumed session

## Edge Cases to Handle

1. **Empty History**: Display appropriate messaging when no completed sessions
2. **Large Histories**: Implement pagination for sessions with many messages
3. **Failed Sessions**: Handle resumption of failed sessions gracefully
4. **Network Errors**: Proper error handling and user feedback
5. **Concurrent Sessions**: Prevent multiple active sessions in same workspace

## Performance Considerations

1. **Database Optimization**: Index queries on session_id and timestamp
2. **Frontend Rendering**: Virtual scrolling for long conversations
3. **API Caching**: Cache session history responses
4. **Memory Management**: Limit conversation preview size

This comprehensive plan provides a complete implementation roadmap for the chat history feature with all necessary components, from backend data layer to frontend user interface.