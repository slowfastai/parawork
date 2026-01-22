# Step 2: Backend Database Queries

## File: `packages/backend/src/db/queries.ts`

**Add these methods to sessionQueries object (after existing methods, around line 517):**

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
},

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
      id: row.id.toString(),
      type: row.type,
      timestamp: row.timestamp,
      content: row.content,
      role: row.role,
      level: row.level
    }));
},
```

**Required imports at top of file:**

The new types `SessionHistoryItem` and `ConversationEvent` will be available after Step 1 is completed.

## Database Query Details

**`getCompletedByWorkspaceId`:**
- Fetches only completed/failed sessions
- Includes message count, duration, and last message preview
- Optimized with single JOIN query
- Returns sessions in reverse chronological order

**`getFullConversation`:**
- Merges messages and agent logs chronologically
- Creates unified timeline for conversation view
- Handles both chat messages and terminal activity
- Sorts by timestamp for proper sequence

## Performance Considerations

1. **Index Optimization**: Ensure indexes on:
   - `sessions(workspace_id, status, started_at)`
   - `messages(session_id, timestamp)`
   - `agent_logs(session_id, timestamp)`

2. **Query Efficiency**: Single query for session metadata, separate queries for conversation to avoid complex joins

3. **Memory Management**: Could add LIMIT for large conversations in future

## Testing Strategy

```typescript
// Test cases to verify:
// 1. Returns only completed sessions
// 2. Correct message counts
// 3. Proper duration calculation
// 4. Last message preview extraction
// 5. Conversation timeline ordering
```