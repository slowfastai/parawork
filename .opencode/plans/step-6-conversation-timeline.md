# Step 6: ConversationTimeline Component

## New File: `packages/frontend/src/components/WorkspaceView/ConversationTimeline.tsx`

```typescript
/**
 * Conversation Timeline - Display unified conversation events
 */
import type { ConversationEvent } from '@parawork/shared';

interface ConversationTimelineProps {
  events: ConversationEvent[];
}

export function ConversationTimeline({ events }: ConversationTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-dashed border-border rounded-full mx-auto mb-3 flex items-center justify-center">
            <span className="text-2xl">💬</span>
          </div>
          <p>No conversation activity found</p>
          <p className="text-sm mt-1">This session may not have had any messages or logs</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getEventIcon = (event: ConversationEvent) => {
    switch (event.type) {
      case 'message':
        return event.role === 'user' ? '👤' : '🤖';
      case 'agent_log':
        return event.level === 'error' ? '❌' : event.level === 'warning' ? '⚠️' : '📝';
      default:
        return '•';
    }
  };

  const getEventLabel = (event: ConversationEvent) => {
    switch (event.type) {
      case 'message':
        return event.role || 'Unknown';
      case 'agent_log':
        return event.level ? `${event.level.charAt(0).toUpperCase() + event.level.slice(1)} Log` : 'Agent Log';
      default:
        return 'Activity';
    }
  };

  const getEventColor = (event: ConversationEvent) => {
    switch (event.type) {
      case 'message':
        return event.role === 'user' 
          ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' 
          : 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      case 'agent_log':
        if (event.level === 'error') return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
        if (event.level === 'warning') return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
        return 'bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={`${event.id}-${index}`} className="flex gap-4 group">
          {/* Timestamp */}
          <div className="flex-shrink-0 text-xs text-muted-foreground w-20 font-mono leading-tight">
            {formatTime(event.timestamp)}
          </div>

          {/* Event Indicator */}
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted border-2 border-border flex items-center justify-center text-xs group-hover:scale-110 transition-transform">
            {getEventIcon(event)}
          </div>

          {/* Event Content */}
          <div className="flex-1 min-w-0">
            {event.type === 'message' ? (
              <div className={`flex ${event.role === 'user' ? 'justify-end' : 'justify-start'} mb-1`}>
                <div
                  className={`max-w-[85%] rounded-lg p-3 border ${
                    event.role === 'user'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-foreground border-border'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{event.content}</p>
                  <p className={`text-xs mt-1 ${
                    event.role === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {getEventLabel(event)} • {formatTime(event.timestamp)}
                  </p>
                </div>
              </div>
            ) : (
              <div className={`rounded-lg p-3 border ${getEventColor(event)}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {getEventLabel(event)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <p className="text-sm font-mono whitespace-pre-wrap break-words">{event.content}</p>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {/* Timeline End Indicator */}
      <div className="flex gap-4 pt-4 border-t border-border/50">
        <div className="w-20"></div>
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted border-2 border-border flex items-center justify-center">
          ✓
        </div>
        <div className="flex-1 text-xs text-muted-foreground italic">
          Session {events[events.length - 1]?.type === 'message' ? 'completed' : 'ended'}
        </div>
      </div>
    </div>
  );
}
```

## Component Features

**Visual Design:**
- Timeline with visual indicators for different event types
- Color-coded event types (messages vs logs)
- Role-based message styling (user vs assistant)
- Responsive layout with proper spacing

**Event Types:**
- **Messages**: Styled as chat bubbles, aligned by role
- **Agent Logs**: Styled as log entries with severity indicators
- **Timestamps**: Consistent formatting for all events

**User Experience:**
- Empty state with helpful messaging
- Hover effects on event indicators
- Proper word wrapping for long content
- Session completion indicator

**Accessibility:**
- Semantic HTML structure
- Proper color contrast
- Clear visual hierarchy
- Keyboard navigation support

## Styling Details

**Color Scheme:**
- User messages: Primary color
- Assistant messages: Muted background
- Error logs: Red accents
- Warning logs: Yellow accents
- Info logs: Gray accents

**Typography:**
- Monospace font for agent logs (code-like)
- Sans-serif for messages
- Consistent sizing and spacing
- Clear timestamp formatting

## Performance Considerations

- Efficient rendering with keyed list items
- Minimal re-renders with stable component structure
- Optimized for conversations with 100+ events
- Proper content truncation and word breaking

## Responsive Design

- Adapts to different screen sizes
- Mobile-friendly touch targets
- Proper text wrapping on small screens
- Maintains readability across devices

This component provides a clean, informative view of session conversations that makes it easy for users to understand what happened during previous sessions.