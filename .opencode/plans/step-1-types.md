# Step 1: Backend Type Extensions

## File: `packages/shared/src/types.ts`

**Add these interfaces after the AgentLog interface (around line 86):**

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

**Also export the new types in the main index.ts file:**

The `packages/shared/src/index.ts` already exports everything from types.ts, so no changes needed there.

## Verification

After adding these types, run:
```bash
pnpm --filter @parawork/shared build
```

This ensures the new types are properly compiled and available for both frontend and backend.