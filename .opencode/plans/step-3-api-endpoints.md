# Step 3: Backend API Endpoints

## File: `packages/backend/src/api/routes/sessions.ts`

**Add these new routes after existing session routes (after the `/sessions/:id/input` route):**

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

    // Check if workspace already has active session
    const activeSession = sessionQueries.getActiveByWorkspaceId(originalSession.workspaceId);
    if (activeSession) {
      const response: ApiResponse = {
        success: false,
        error: 'Workspace already has an active session',
      };
      return res.status(400).json(response);
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

    // Start the agent process
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

## API Endpoint Details

**GET `/workspaces/:id/sessions/history`:**
- Returns list of completed sessions with metadata
- Includes message counts, duration, last message preview
- Used by SessionHistoryModal for session list

**GET `/sessions/:id/full-conversation`:**
- Returns unified timeline of messages and agent logs
- Sorted chronologically
- Used by ConversationTimeline for preview

**POST `/sessions/:id/resume`:**
- Creates new session with historical context
- Copies all messages to new session
- Starts fresh agent process
- Maintains conversation continuity

## Error Handling

1. **Session Not Found**: Returns 404 if original session doesn't exist
2. **Active Session Check**: Prevents resumption if workspace already running
3. **Database Errors**: Proper error logging and 500 responses
4. **Agent Start Failures**: Caught and reported appropriately

## Security Considerations

1. **Workspace Ownership**: Ensure user can only access their own workspace sessions
2. **Session Validation**: Verify session belongs to requested workspace
3. **Rate Limiting**: Consider rate limiting resume endpoints

## WebSocket Integration

When session is resumed, existing WebSocket subscriptions should automatically pick up the new session since they're workspace-based. No additional WebSocket changes needed initially.