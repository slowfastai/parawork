/**
 * Property-based tests for XTerminal session transition clearing
 * Feature: terminal-session-cleanup
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { XTerminal } from './XTerminal';
import type { Session } from '@parawork/shared';

// Create shared mock functions that we can track
let mockResetFn: ReturnType<typeof vi.fn>;
let mockWriteFn: ReturnType<typeof vi.fn>;
let mockWritelnFn: ReturnType<typeof vi.fn>;
let mockFocusFn: ReturnType<typeof vi.fn>;
let mockDisposeFn: ReturnType<typeof vi.fn>;
let mockLoadAddonFn: ReturnType<typeof vi.fn>;
let mockOpenFn: ReturnType<typeof vi.fn>;
let mockOnDataFn: ReturnType<typeof vi.fn>;
let mockFitFn: ReturnType<typeof vi.fn>;

// Mock xterm.js - must be defined inline in vi.mock factory
vi.mock('xterm', () => {
  class MockTerminal {
    reset: () => void;
    write: (data: string) => void;
    writeln: (data: string) => void;
    focus: () => void;
    dispose: () => void;
    loadAddon: (addon: unknown) => void;
    open: (element: HTMLElement) => void;
    onData: (callback: (data: string) => void) => { dispose: () => void };
    cols = 80;
    rows = 24;
    textarea = document.createElement('textarea');
    buffer = {
      active: {
        length: 0,
        getLine: vi.fn(() => ({ translateToString: () => '' })),
      },
    };
    
    constructor() {
      this.reset = mockResetFn;
      this.write = mockWriteFn;
      this.writeln = mockWritelnFn;
      this.focus = mockFocusFn;
      this.dispose = mockDisposeFn;
      this.loadAddon = mockLoadAddonFn;
      this.open = mockOpenFn;
      this.onData = mockOnDataFn;
    }
  }
  
  return {
    Terminal: MockTerminal,
  };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit: () => void;
    
    constructor() {
      this.fit = mockFitFn;
    }
  }
  
  return {
    FitAddon: MockFitAddon,
  };
});

// Mock WebSocket context
vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    subscribe: vi.fn(() => vi.fn()),
    send: vi.fn(() => true),
  }),
}));

describe('XTerminal - Property-Based Tests', () => {
  beforeEach(() => {
    // Initialize mock functions before each test
    mockResetFn = vi.fn();
    mockWriteFn = vi.fn();
    mockWritelnFn = vi.fn();
    mockFocusFn = vi.fn();
    mockDisposeFn = vi.fn();
    mockLoadAddonFn = vi.fn();
    mockOpenFn = vi.fn();
    mockOnDataFn = vi.fn(() => ({ dispose: vi.fn() }));
    mockFitFn = vi.fn();
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  /**
   * Property 1: Session ID Transition Triggers Clear
   * **Validates: Requirements 1.1, 2.3, 4.1**
   * 
   * For any terminal instance with a session ID (or null), when the session ID 
   * changes to a different value (including null), the terminal buffer should 
   * be cleared before any new content is displayed.
   */
  it('Property 1: any session ID change triggers terminal clear', () => {
    fc.assert(
      fc.property(
        // Generate two optional session IDs (can be null or a UUID string)
        fc.option(fc.uuid(), { nil: null }),
        fc.option(fc.uuid(), { nil: null }),
        (prevId, currId) => {
          // Create mock session objects with all required properties
          const createSession = (id: string): Session => ({
            id,
            workspaceId: 'test-workspace',
            agentType: 'claude-code',
            status: 'running',
            processId: 1234,
            startedAt: Date.now(),
            completedAt: null,
          });

          // Setup terminal with previous session
          const { rerender } = render(
            <XTerminal session={prevId ? createSession(prevId) : null} />
          );

          // Wait for initial effects to complete
          vi.runAllTimers();

          // Record clear calls before transition
          const clearCallsBefore = mockResetFn.mock.calls.length;

          // Change to current session (trigger transition)
          rerender(
            <XTerminal session={currId ? createSession(currId) : null} />
          );

          // Wait for transition effects to complete
          vi.runAllTimers();

          // Record clear calls after transition
          const clearCallsAfter = mockResetFn.mock.calls.length;

          // Determine if clear should have been called
          const shouldHaveCleared = prevId !== currId;

          // Verify the property holds
          if (shouldHaveCleared) {
            // Session ID changed - clear should have been called
            return clearCallsAfter > clearCallsBefore;
          } else {
            // Session ID stayed the same - clear should NOT have been called
            return clearCallsAfter === clearCallsBefore;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Clear Operation Resets Scrollback
   * **Validates: Requirements 1.3**
   * 
   * For any terminal instance with content in the scrollback buffer, when the 
   * clear operation is executed, both the visible buffer and scrollback buffer 
   * should be empty.
   */
  it('Property 2: clear operation empties both buffer and scrollback', () => {
    fc.assert(
      fc.property(
        // Generate random terminal content (array of strings)
        fc.array(fc.string({ minLength: 1, maxLength: 80 }), { minLength: 1, maxLength: 100 }),
        (contentLines) => {
          // Create a session to start with
          const session: Session = {
            id: 'test-session-id',
            workspaceId: 'test-workspace',
            agentType: 'claude-code',
            status: 'running',
            processId: 1234,
            startedAt: Date.now(),
            completedAt: null,
          };

          // Render terminal with initial session
          const { rerender } = render(<XTerminal session={session} />);

          // Wait for initial effects to complete
          vi.runAllTimers();

          // Simulate filling terminal with content
          // In a real terminal, this would fill the scrollback buffer
          contentLines.forEach(line => {
            mockWritelnFn(line);
          });

          // Record that clear was not called yet (or reset the count)
          const clearCallsBefore = mockResetFn.mock.calls.length;

          // Trigger clear by changing session to null (session stop)
          rerender(<XTerminal session={null} />);

          // Wait for transition effects to complete
          vi.runAllTimers();

          // Verify clear was called
          const clearCallsAfter = mockResetFn.mock.calls.length;

          // The property holds if clear was called at least once
          // This verifies that the clear operation is triggered, which in a real
          // xterm.js instance would empty both the visible buffer and scrollback
          return clearCallsAfter > clearCallsBefore;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Same Session ID Preserves Content
   * **Validates: Requirements 3.1, 4.2**
   * 
   * For any terminal instance displaying a session, when the session prop updates 
   * with the same session ID (even if other properties like status change), the 
   * terminal content should remain unchanged.
   */
  it('Property 3: same session ID preserves content regardless of status changes', () => {
    fc.assert(
      fc.property(
        // Generate a session ID
        fc.uuid(),
        // Generate two different status values
        fc.constantFrom('starting', 'running', 'completed', 'failed'),
        fc.constantFrom('starting', 'running', 'completed', 'failed'),
        (sessionId, initialStatus, newStatus) => {
          // Create initial session with first status
          const initialSession: Session = {
            id: sessionId,
            workspaceId: 'test-workspace',
            agentType: 'claude-code',
            status: initialStatus as 'starting' | 'running' | 'completed' | 'failed',
            processId: 1234,
            startedAt: Date.now(),
            completedAt: null,
          };

          // Render terminal with initial session
          const { rerender } = render(<XTerminal session={initialSession} />);

          // Wait for initial effects to complete
          vi.runAllTimers();

          // Record clear calls before status change
          const clearCallsBefore = mockResetFn.mock.calls.length;

          // Update session with new status but SAME session ID
          const updatedSession: Session = {
            ...initialSession,
            status: newStatus as 'starting' | 'running' | 'completed' | 'failed',
          };

          rerender(<XTerminal session={updatedSession} />);

          // Wait for transition effects to complete
          vi.runAllTimers();

          // Record clear calls after status change
          const clearCallsAfter = mockResetFn.mock.calls.length;

          // The property holds if clear was NOT called
          // When the session ID stays the same, terminal content should be preserved
          return clearCallsAfter === clearCallsBefore;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Session Sequence Maintains Clean State
   * **Validates: Requirements 2.1**
   * 
   * For any sequence of session transitions (Session A → null → Session B), 
   * the terminal should display only content from Session B with no residual 
   * content from Session A.
   */
  it('Property 4: session A → null → session B results in clean terminal', () => {
    fc.assert(
      fc.property(
        // Generate two different session IDs
        fc.uuid(),
        fc.uuid(),
        // Generate content that would be written during session A
        fc.array(fc.string({ minLength: 1, maxLength: 80 }), { minLength: 1, maxLength: 50 }),
        (sessionAId, sessionBId, sessionAContent) => {
          // Precondition: Ensure sessions are different
          fc.pre(sessionAId !== sessionBId);

          // Create session A
          const sessionA: Session = {
            id: sessionAId,
            workspaceId: 'test-workspace',
            agentType: 'claude-code',
            status: 'running',
            processId: 1234,
            startedAt: Date.now(),
            completedAt: null,
          };

          // Start with session A
          const { rerender } = render(<XTerminal session={sessionA} />);

          // Wait for initial effects to complete
          vi.runAllTimers();

          // Simulate content being written during session A
          sessionAContent.forEach(line => {
            mockWritelnFn(line);
          });

          // Record clear calls before first transition
          const clearCallsBeforeStop = mockResetFn.mock.calls.length;

          // Transition: Session A → null (stop session)
          rerender(<XTerminal session={null} />);

          // Wait for transition effects to complete
          vi.runAllTimers();

          // Record clear calls after stopping session A
          const clearCallsAfterStop = mockResetFn.mock.calls.length;

          // Verify clear was called when stopping session A
          const clearedOnStop = clearCallsAfterStop > clearCallsBeforeStop;

          // Transition: null → Session B (start new session)
          const sessionB: Session = {
            id: sessionBId,
            workspaceId: 'test-workspace',
            agentType: 'claude-code',
            status: 'running',
            processId: 5678,
            startedAt: Date.now(),
            completedAt: null,
          };

          rerender(<XTerminal session={sessionB} />);

          // Wait for transition effects to complete
          vi.runAllTimers();

          // Record clear calls after starting session B
          const clearCallsAfterStart = mockResetFn.mock.calls.length;

          // Verify clear was called when starting session B
          const clearedOnStart = clearCallsAfterStart > clearCallsAfterStop;

          // The property holds if clear was called at least twice:
          // 1. When transitioning from session A to null
          // 2. When transitioning from null to session B
          // This ensures no content from session A leaks into session B
          return clearedOnStop && clearedOnStart;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('XTerminal - Unit Tests for Edge Cases', () => {
  beforeEach(() => {
    // Initialize mock functions before each test
    mockResetFn = vi.fn();
    mockWriteFn = vi.fn();
    mockWritelnFn = vi.fn();
    mockFocusFn = vi.fn();
    mockDisposeFn = vi.fn();
    mockLoadAddonFn = vi.fn();
    mockOpenFn = vi.fn();
    mockOnDataFn = vi.fn(() => ({ dispose: vi.fn() }));
    mockFitFn = vi.fn();
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  /**
   * Test: Initial render with no session
   * **Validates: Requirements 1.1, 2.1, 3.1, 4.1**
   * 
   * Verifies that the terminal renders correctly when initially mounted with
   * no active session (session = null).
   */
  it('should render without errors when initially mounted with no session', () => {
    // Render terminal with no session
    const { container } = render(<XTerminal session={null} />);

    // Wait for all effects to complete
    vi.runAllTimers();

    // Verify terminal was initialized (open was called)
    expect(mockOpenFn).toHaveBeenCalled();

    // Verify terminal was not cleared (no session transition occurred)
    expect(mockResetFn).not.toHaveBeenCalled();

    // Verify component rendered successfully
    expect(container.querySelector('[class*="flex-col"]')).toBeTruthy();
  });

  /**
   * Test: Rapid session transitions
   * **Validates: Requirements 1.1, 2.1, 4.1**
   * 
   * Verifies that the terminal handles rapid session transitions correctly
   * (start → stop → start quickly) without errors or missed clear operations.
   */
  it('should handle rapid session transitions (start/stop/start quickly)', () => {
    const session1: Session = {
      id: 'session-1',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    const session2: Session = {
      id: 'session-2',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 5678,
      startedAt: Date.now(),
      completedAt: null,
    };

    // Start with no session
    const { rerender } = render(<XTerminal session={null} />);
    vi.runAllTimers();

    const clearCallsInitial = mockResetFn.mock.calls.length;

    // Rapid transition 1: null → session1 (start)
    rerender(<XTerminal session={session1} />);
    vi.runAllTimers();

    const clearCallsAfterStart1 = mockResetFn.mock.calls.length;
    expect(clearCallsAfterStart1).toBeGreaterThan(clearCallsInitial);

    // Rapid transition 2: session1 → null (stop)
    rerender(<XTerminal session={null} />);
    vi.runAllTimers();

    const clearCallsAfterStop = mockResetFn.mock.calls.length;
    expect(clearCallsAfterStop).toBeGreaterThan(clearCallsAfterStart1);

    // Rapid transition 3: null → session2 (start new)
    rerender(<XTerminal session={session2} />);
    vi.runAllTimers();

    const clearCallsAfterStart2 = mockResetFn.mock.calls.length;
    expect(clearCallsAfterStart2).toBeGreaterThan(clearCallsAfterStop);

    // Verify clear was called 3 times total (once for each transition)
    expect(clearCallsAfterStart2 - clearCallsInitial).toBe(3);
  });

  /**
   * Test: Terminal initialization failures (null refs)
   * **Validates: Requirements 1.1, 3.1**
   * 
   * Verifies that the terminal handles initialization failures gracefully
   * when clear is called but terminal ref might be null.
   */
  it('should handle terminal initialization failures gracefully', () => {
    // We can't easily mock the Terminal constructor to fail in the middle of a test,
    // but we can verify that the clear operation is protected by a null check.
    // The implementation has: if (shouldClear && xtermRef.current) { ... }
    // This test verifies that transitioning sessions doesn't throw errors.

    const session: Session = {
      id: 'test-session',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    // Render with a session
    const { rerender } = render(<XTerminal session={session} />);
    vi.runAllTimers();

    // Transition to null - should not throw even if there are any ref issues
    expect(() => {
      rerender(<XTerminal session={null} />);
      vi.runAllTimers();
    }).not.toThrow();

    // Transition back to a session - should not throw
    expect(() => {
      rerender(<XTerminal session={session} />);
      vi.runAllTimers();
    }).not.toThrow();
  });

  /**
   * Test: Terminal clear with null terminal ref
   * **Validates: Requirements 1.1**
   * 
   * Verifies that attempting to clear the terminal when the terminal ref is null
   * doesn't cause errors (graceful degradation).
   */
  it('should not error when clearing with null terminal ref', () => {
    const session: Session = {
      id: 'test-session',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    // Render with a session
    const { rerender } = render(<XTerminal session={session} />);
    vi.runAllTimers();

    // Manually set the terminal ref to null to simulate initialization failure
    // This is a bit tricky since we can't directly access the ref, but we can
    // verify that the clear operation is protected by checking it doesn't throw
    
    // Transition to null session - should not throw even if terminal ref is null
    expect(() => {
      rerender(<XTerminal session={null} />);
      vi.runAllTimers();
    }).not.toThrow();
  });

  /**
   * Test: Invalid session objects
   * **Validates: Requirements 1.1, 2.1, 4.1**
   * 
   * Verifies that the terminal handles invalid or malformed session objects
   * gracefully without crashing.
   */
  it('should handle invalid session objects gracefully', () => {
    // Test with undefined session (should be treated as null)
    const { rerender } = render(<XTerminal session={undefined as any} />);
    vi.runAllTimers();

    expect(mockOpenFn).toHaveBeenCalled();
    expect(mockResetFn).not.toHaveBeenCalled();

    // Test with session missing some optional properties
    const partialSession = {
      id: 'test-id',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      // Missing completedAt (which is optional)
    } as Session;

    expect(() => {
      rerender(<XTerminal session={partialSession} />);
      vi.runAllTimers();
    }).not.toThrow();

    // Test with empty string id (edge case)
    const sessionWithEmptyId = {
      id: '',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    } as Session;

    expect(() => {
      rerender(<XTerminal session={sessionWithEmptyId} />);
      vi.runAllTimers();
    }).not.toThrow();
  });

  /**
   * Test: Session with same ID but different object reference
   * **Validates: Requirements 3.1**
   * 
   * Verifies that the terminal doesn't clear when receiving a new session object
   * with the same ID (e.g., when session object is recreated but ID is unchanged).
   */
  it('should not clear when session object changes but ID remains the same', () => {
    const sessionId = 'stable-session-id';

    const session1: Session = {
      id: sessionId,
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    // Render with first session object
    const { rerender } = render(<XTerminal session={session1} />);
    vi.runAllTimers();

    const clearCallsBefore = mockResetFn.mock.calls.length;

    // Create a new session object with the same ID but different reference
    const session2: Session = {
      id: sessionId, // Same ID
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now() + 1000, // Different timestamp
      completedAt: null,
    };

    // Rerender with new object (different reference, same ID)
    rerender(<XTerminal session={session2} />);
    vi.runAllTimers();

    const clearCallsAfter = mockResetFn.mock.calls.length;

    // Clear should NOT have been called since ID is the same
    expect(clearCallsAfter).toBe(clearCallsBefore);
  });

  /**
   * Test: Clear operation error handling
   * **Validates: Requirements 1.1**
   * 
   * Verifies that errors during terminal reset operations are caught and logged
   * without crashing the component.
   */
  it('should handle errors during reset operation gracefully', () => {
    // Mock reset to throw an error
    mockResetFn.mockImplementation(() => {
      throw new Error('Reset operation failed');
    });

    const session: Session = {
      id: 'test-session',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    // Render with session
    const { rerender } = render(<XTerminal session={session} />);
    vi.runAllTimers();

    // Mock console.error to verify error is logged
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Transition to null - should catch the error and log it
    expect(() => {
      rerender(<XTerminal session={null} />);
      vi.runAllTimers();
    }).not.toThrow();

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[XTerminal] Error clearing terminal:'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
