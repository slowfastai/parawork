# Step 8: Testing Strategy & Quality Assurance

## Backend Testing

### Unit Tests (`packages/backend/src/db/queries.test.ts`)

```typescript
import { sessionQueries } from './queries';
import { setupTestDatabase, cleanupTestDatabase } from '../test/utils';

describe('Session History Queries', () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe('getCompletedByWorkspaceId', () => {
    it('should return only completed sessions', async () => {
      // Setup: Create test sessions (completed, running, failed)
      const workspaceId = 'test-workspace';
      // Insert test data...
      
      const sessions = sessionQueries.getCompletedByWorkspaceId(workspaceId);
      
      expect(sessions).toHaveLength(2); // completed + failed
      expect(sessions.every(s => s.status === 'completed' || s.status === 'failed')).toBe(true);
    });

    it('should include message metadata', () => {
      // Test message count, duration, last message
    });
  });

  describe('getFullConversation', () => {
    it('should merge messages and logs chronologically', () => {
      // Test timeline ordering
    });

    it('should handle empty conversations', () => {
      // Test edge cases
    });
  });
});
```

### API Integration Tests (`packages/backend/test/api/sessions.test.ts`)

```typescript
import request from 'supertest';
import { app } from '../../app';
import { setupTestDatabase } from '../utils';

describe('Session History API', () => {
  beforeEach(() => setupTestDatabase());

  describe('GET /workspaces/:id/sessions/history', () => {
    it('should return session history', async () => {
      const response = await request(app)
        .get('/workspaces/test-workspace/sessions/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/sessions/:id/resume', () => {
    it('should resume session successfully', async () => {
      const response = await request(app)
        .post('/sessions/test-session/resume')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('starting');
    });
  });
});
```

## Frontend Testing

### Component Tests (`packages/frontend/src/components/WorkspaceView/SessionHistoryModal.test.tsx`)

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionHistoryModal } from './SessionHistoryModal';
import { api } from '../../../lib/api';

// Mock API
jest.mock('../../../lib/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('SessionHistoryModal', () => {
  const defaultProps = {
    workspaceId: 'test-workspace',
    isOpen: true,
    onClose: jest.fn(),
    onSessionResume: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render session list', async () => {
    mockApi.sessions.getHistory.mockResolvedValue({
      data: [
        {
          id: 'session1',
          agentType: 'claude-code',
          status: 'completed',
          messageCount: 5,
          duration: 300000,
          lastMessage: 'Hello world',
          startedAt: Date.now() - 3600000,
        }
      ]
    });

    render(<SessionHistoryModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('claude-code')).toBeInTheDocument();
      expect(screen.getByText('5 messages')).toBeInTheDocument();
    });
  });

  it('should handle session resume', async () => {
    mockApi.sessions.getHistory.mockResolvedValue({ data: [] });
    mockApi.sessions.resume.mockResolvedValue({
      data: { id: 'new-session', status: 'starting' }
    });

    render(<SessionHistoryModal {...defaultProps} />);

    // Select session and click resume
    // fireEvent.click(screen.getByText('Resume Session'));

    await waitFor(() => {
      expect(defaultProps.onSessionResume).toHaveBeenCalledWith('session1');
    });
  });
});
```

### E2E Tests (`packages/frontend/e2e/session-history.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Session History', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to workspace
    await page.goto('/workspace/test-workspace');
  });

  test('should view and resume session history', async ({ page }) => {
    // Click view history button
    await page.click('button:has-text("View Chat History")');
    
    // Wait for modal to appear
    await expect(page.locator('[data-testid="session-history-modal"]')).toBeVisible();
    
    // Should see completed sessions
    await expect(page.locator('[data-testid="session-item"]')).toHaveCount(2);
    
    // Click first session
    await page.click('[data-testid="session-item"]:first-child');
    
    // Should load conversation
    await expect(page.locator('[data-testid="conversation-timeline"]')).toBeVisible();
    
    // Click resume button
    await page.click('button:has-text("Resume Session")');
    
    // Modal should close and session should start
    await expect(page.locator('[data-testid="session-history-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="x-terminal"]')).toBeVisible();
  });

  test('should search and filter sessions', async ({ page }) => {
    await page.click('button:has-text("View Chat History")');
    
    // Type in search
    await page.fill('input[placeholder="Search sessions..."]', 'claude');
    
    // Should filter results
    await expect(page.locator('[data-testid="session-item"]')).toHaveCount(1);
  });
});
```

## Performance Testing

### Database Query Performance

```typescript
// Performance benchmarks for queries
describe('Query Performance', () => {
  it('should handle large conversation histories', async () => {
    // Create session with 1000+ messages
    const startTime = performance.now();
    const conversation = sessionQueries.getFullConversation('large-session');
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(500); // < 500ms
    expect(conversation.length).toBeGreaterThan(1000);
  });
});
```

### Frontend Performance Tests

```typescript
// Component rendering performance
test('should render large conversations efficiently', async ({ page }) => {
  // Load conversation with 500+ events
  await page.goto('/session/large-session/conversation');
  
  const startTime = Date.now();
  await page.waitForSelector('[data-testid="conversation-event-500"]');
  const renderTime = Date.now() - startTime;
  
  expect(renderTime).toBeLessThan(1000); // < 1 second
});
```

## Manual Testing Checklist

### Functional Testing

- [ ] Session history modal opens/closes properly
- [ ] Completed sessions display with correct metadata
- [ ] Search/filter functionality works
- [ ] Conversation preview loads correctly
- [ ] Resume button creates new session
- [ ] Historical context loads in chat interface
- [ ] Terminal starts fresh with chat context

### Edge Cases

- [ ] Empty session history shows appropriate message
- [ ] Failed sessions display correctly
- [ ] Very long conversations handle scrolling
- [ ] Network errors show helpful messages
- [ ] Concurrent sessions prevented
- [ ] Browser refresh maintains state

### Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Responsiveness

- [ ] iPhone SE (375px width)
- [ ] iPhone 12 (390px width)
- [ ] iPad (768px width)
- [ ] Desktop (1920px width)

## Error Handling Tests

### API Error Scenarios

```typescript
test('should handle API errors gracefully', async ({ page }) => {
  // Mock API failure
  await page.route('/api/workspaces/*/sessions/history', route => {
    route.fulfill({ status: 500, body: '{"error":"Server Error"}' });
  });

  await page.click('button:has-text("View Chat History")');
  
  // Should show error message
  await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
});
```

### Network Disconnection

```typescript
test('should handle network disconnection', async ({ page }) => {
  // Disconnect network during session resume
  await page.click('button:has-text("View Chat History")');
  await page.click('button:has-text("Resume Session")');
  
  // Disconnect
  await page.setOffline(true);
  
  // Should show network error
  await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
});
```

## Accessibility Testing

### WCAG 2.1 Compliance

- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader compatibility
- [ ] Color contrast ratios
- [ ] Focus indicators
- [ ] ARIA labels and roles

### Automated Accessibility Tests

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test.beforeEach(async ({ page }) => {
  await injectAxe(page);
});

test('should be accessible', async ({ page }) => {
  await page.goto('/workspace/test-workspace');
  await page.click('button:has-text("View Chat History")');
  
  await checkA11y(page, {
    detailedReport: true,
    detailedReportOptions: { html: true }
  });
});
```

This comprehensive testing strategy ensures the chat history feature is reliable, performant, and accessible across all scenarios.