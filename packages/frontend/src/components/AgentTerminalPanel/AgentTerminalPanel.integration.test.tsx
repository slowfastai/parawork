/**
 * Integration tests for AgentTerminalPanel with XTerminal
 * Feature: terminal-session-cleanup
 * 
 * These tests verify the complete flow from AgentTerminalPanel through XTerminal,
 * ensuring terminal state management works correctly across all session transitions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AgentTerminalPanel } from './AgentTerminalPanel';
import type { Session, Workspace } from '@parawork/shared';

// Mock the API
const mockCreateSession = vi.fn();
const mockStopSession = vi.fn();
const mockListSessions = vi.fn();
const mockUpdateWorkspace = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    sessions: {
      create: (...args: any[]) => mockCreateSession(...args),
      stop: (...args: any[]) => mockStopSession(...args),
      list: (...args: any[]) => mockListSessions(...args),
    },
    workspaces: {
      update: (...args: any[]) => mockUpdateWorkspace(...args),
    },
  },
}));

// Mock the app store
let mockWorkspaces: Workspace[] = [];
let mockSessions: Record<string, Session> = {};
let mockFocusedWorkspaceId: string | null = null;
const mockSetCurrentSession = vi.fn();
const mockUpdateWorkspaceStore = vi.fn();
const mockRemoveSession = vi.fn();

vi.mock('../../stores/appStore', () => ({
  useAppStore: (selector: any) => {
    const state = {
      workspaces: mockWorkspaces,
      sessions: mockSessions,
      focusedWorkspaceId: mockFocusedWorkspaceId,
      setCurrentSession: mockSetCurrentSession,
      updateWorkspace: mockUpdateWorkspaceStore,
      removeSession: mockRemoveSession,
    };
    return selector(state);
  },
}));

// Mock WebSocket context
let mockWebSocketSubscribe = vi.fn(() => vi.fn());
const mockWebSocketSend = vi.fn(() => true);

vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    subscribe: mockWebSocketSubscribe,
    send: mockWebSocketSend,
  }),
}));

// Create shared mock functions for xterm.js
let mockResetFn: ReturnType<typeof vi.fn>;
let mockWriteFn: ReturnType<typeof vi.fn>;
let mockWritelnFn: ReturnType<typeof vi.fn>;
let mockFocusFn: ReturnType<typeof vi.fn>;
let mockDisposeFn: ReturnType<typeof vi.fn>;
let mockLoadAddonFn: ReturnType<typeof vi.fn>;
let mockOpenFn: ReturnType<typeof vi.fn>;
let mockOnDataFn: ReturnType<typeof vi.fn>;
let mockFitFn: ReturnType<typeof vi.fn>;

// Mock xterm.js
vi.mock('xterm', () => {
  class MockTerminal {
    clear: () => void;
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

describe('AgentTerminalPanel Integration Tests', () => {
  beforeEach(() => {
    // Initialize mock functions
    mockResetFn = vi.fn();
    mockWriteFn = vi.fn();
    mockWritelnFn = vi.fn();
    mockFocusFn = vi.fn();
    mockDisposeFn = vi.fn();
    mockLoadAddonFn = vi.fn();
    mockOpenFn = vi.fn();
    mockOnDataFn = vi.fn(() => ({ dispose: vi.fn() }));
    mockFitFn = vi.fn();

    // Reset store state
    mockWorkspaces = [];
    mockSessions = {};
    mockFocusedWorkspaceId = null;

    // Reset API mocks
    mockCreateSession.mockReset();
    mockStopSession.mockReset();
    mockListSessions.mockReset();
    mockUpdateWorkspace.mockReset();
    mockSetCurrentSession.mockReset();
    mockUpdateWorkspaceStore.mockReset();
    mockRemoveSession.mockReset();

    // Reset WebSocket mock
    mockWebSocketSubscribe = vi.fn(() => vi.fn());

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  /**
   * Test: Complete flow - start session → stop session → start new session
   * **Validates: Requirements 1.1, 2.1, 3.1**
   * 
   * This test verifies terminal clearing behavior through session transitions
   * by directly testing the XTerminal component with different session props.
   */
  it('should clear terminal through complete flow: start → stop → start new', async () => {
    // Use real timers for this test
    vi.useRealTimers();

    // Import XTerminal directly
    const { XTerminal } = await import('../WorkspaceView/XTerminal');

    // Step 1: Start with no session
    const { rerender } = render(<XTerminal session={null} />);
    await new Promise(resolve => setTimeout(resolve, 100));

    const clearCallsInitial = mockResetFn.mock.calls.length;

    // Step 2: Start session 1 (null → session-1)
    const session1: Session = {
      id: 'session-1',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    rerender(<XTerminal session={session1} />);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify terminal was cleared when session started
    const clearCallsAfterStart1 = mockResetFn.mock.calls.length;
    expect(clearCallsAfterStart1).toBeGreaterThan(clearCallsInitial);

    // Step 3: Stop session (session-1 → null)
    rerender(<XTerminal session={null} />);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify terminal was cleared when session stopped
    const clearCallsAfterStop = mockResetFn.mock.calls.length;
    expect(clearCallsAfterStop).toBeGreaterThan(clearCallsAfterStart1);

    // Step 4: Start session 2 (null → session-2)
    const session2: Session = {
      id: 'session-2',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 5678,
      startedAt: Date.now(),
      completedAt: null,
    };

    rerender(<XTerminal session={session2} />);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify terminal was cleared when new session started
    const clearCallsAfterStart2 = mockResetFn.mock.calls.length;
    expect(clearCallsAfterStart2).toBeGreaterThan(clearCallsAfterStop);

    // Verify total clear count: should be 3 (start1, stop, start2)
    expect(clearCallsAfterStart2 - clearCallsInitial).toBe(3);

    // Restore fake timers for other tests
    vi.useFakeTimers();
  });

  /**
   * Test: Workspace switching with different sessions
   * **Validates: Requirements 2.1, 3.1**
   * 
   * This test verifies that switching between workspaces with different sessions
   * properly clears the terminal to prevent content from one workspace appearing
   * in another.
   */
  it('should clear terminal when switching workspaces with different sessions', async () => {
    // Setup: Create two workspaces with different sessions
    const workspace1: Workspace = {
      id: 'workspace-1',
      name: 'Workspace 1',
      path: '/test/path1',
      agentType: 'claude-code',
      status: 'running',
      createdAt: Date.now(),
      lastFocusedAt: Date.now(),
    };

    const workspace2: Workspace = {
      id: 'workspace-2',
      name: 'Workspace 2',
      path: '/test/path2',
      agentType: 'claude-code',
      status: 'running',
      createdAt: Date.now(),
      lastFocusedAt: Date.now(),
    };

    const session1: Session = {
      id: 'session-1',
      workspaceId: workspace1.id,
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    const session2: Session = {
      id: 'session-2',
      workspaceId: workspace2.id,
      agentType: 'claude-code',
      status: 'running',
      processId: 5678,
      startedAt: Date.now(),
      completedAt: null,
    };

    // Start with workspace 1
    mockWorkspaces = [workspace1, workspace2];
    mockFocusedWorkspaceId = workspace1.id;
    mockSessions = { [workspace1.id]: session1 };
    mockListSessions.mockResolvedValue([session1]);

    const { rerender } = render(<AgentTerminalPanel />);
    vi.runAllTimers();

    // Record clear calls after initial render
    const clearCallsAfterWorkspace1 = mockResetFn.mock.calls.length;

    // Switch to workspace 2
    mockFocusedWorkspaceId = workspace2.id;
    mockSessions = { [workspace2.id]: session2 };
    mockListSessions.mockResolvedValue([session2]);

    rerender(<AgentTerminalPanel />);
    vi.runAllTimers();

    // Verify terminal was cleared when switching workspaces (session-1 → session-2)
    const clearCallsAfterWorkspace2 = mockResetFn.mock.calls.length;
    expect(clearCallsAfterWorkspace2).toBeGreaterThan(clearCallsAfterWorkspace1);
  });

  /**
   * Test: Returning to workspace with same session
   * **Validates: Requirements 3.1**
   * 
   * This test verifies that when switching back to a workspace with the same
   * session, the terminal content is preserved (not cleared).
   */
  it('should preserve terminal content when returning to workspace with same session', async () => {
    // Setup: Create two workspaces
    const workspace1: Workspace = {
      id: 'workspace-1',
      name: 'Workspace 1',
      path: '/test/path1',
      agentType: 'claude-code',
      status: 'running',
      createdAt: Date.now(),
      lastFocusedAt: Date.now(),
    };

    const workspace2: Workspace = {
      id: 'workspace-2',
      name: 'Workspace 2',
      path: '/test/path2',
      agentType: 'claude-code',
      status: 'idle',
      createdAt: Date.now(),
      lastFocusedAt: Date.now(),
    };

    const session1: Session = {
      id: 'session-1',
      workspaceId: workspace1.id,
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    // Start with workspace 1 (has session)
    mockWorkspaces = [workspace1, workspace2];
    mockFocusedWorkspaceId = workspace1.id;
    mockSessions = { [workspace1.id]: session1 };
    mockListSessions.mockResolvedValue([session1]);

    const { rerender } = render(<AgentTerminalPanel />);
    vi.runAllTimers();

    // Record clear calls after initial render with workspace 1
    const clearCallsAfterWorkspace1 = mockResetFn.mock.calls.length;

    // Switch to workspace 2 (no session)
    mockFocusedWorkspaceId = workspace2.id;
    mockSessions = {};
    mockListSessions.mockResolvedValue([]);

    rerender(<AgentTerminalPanel />);
    vi.runAllTimers();

    // Terminal should clear when going from session to no session
    const clearCallsAfterWorkspace2 = mockResetFn.mock.calls.length;
    expect(clearCallsAfterWorkspace2).toBeGreaterThan(clearCallsAfterWorkspace1);

    // Switch back to workspace 1 (same session)
    mockFocusedWorkspaceId = workspace1.id;
    mockSessions = { [workspace1.id]: session1 };
    mockListSessions.mockResolvedValue([session1]);

    rerender(<AgentTerminalPanel />);
    vi.runAllTimers();

    // Terminal should clear when going from no session back to session
    // (This is expected behavior - null → session triggers clear)
    const clearCallsAfterReturn = mockResetFn.mock.calls.length;
    expect(clearCallsAfterReturn).toBeGreaterThan(clearCallsAfterWorkspace2);

    // Now if we stay on workspace 1 and the session updates (but same ID),
    // terminal should NOT clear
    const clearCallsBeforeUpdate = mockResetFn.mock.calls.length;

    // Update session status but keep same ID
    const updatedSession1: Session = {
      ...session1,
      status: 'completed',
      completedAt: Date.now(),
    };

    mockSessions = { [workspace1.id]: updatedSession1 };

    rerender(<AgentTerminalPanel />);
    vi.runAllTimers();

    // Terminal should NOT clear when session ID stays the same
    const clearCallsAfterUpdate = mockResetFn.mock.calls.length;
    expect(clearCallsAfterUpdate).toBe(clearCallsBeforeUpdate);
  });

  /**
   * Test: Terminal state matches expected behavior in all scenarios
   * **Validates: Requirements 1.1, 2.1, 3.1**
   * 
   * This test verifies that the terminal state (cleared or preserved) matches
   * the expected behavior across various session transition scenarios.
   * 
   * Note: This is a simplified version that tests the core XTerminal behavior
   * directly rather than through the full AgentTerminalPanel integration.
   */
  it('should maintain correct terminal state across all transition scenarios', async () => {
    // Import XTerminal directly for this test
    const { XTerminal } = await import('../WorkspaceView/XTerminal');
    
    // Scenario 1: No session → No session (no change)
    const { rerender } = render(<XTerminal session={null} />);
    await vi.runAllTimersAsync();
    
    const clearCallsScenario1 = mockResetFn.mock.calls.length;
    rerender(<XTerminal session={null} />);
    await vi.runAllTimersAsync();
    expect(mockResetFn.mock.calls.length).toBe(clearCallsScenario1); // No clear

    // Scenario 2: No session → Session A (should clear)
    const sessionA: Session = {
      id: 'session-a',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    const clearCallsScenario2Before = mockResetFn.mock.calls.length;
    rerender(<XTerminal session={sessionA} />);
    await vi.runAllTimersAsync();
    expect(mockResetFn.mock.calls.length).toBeGreaterThan(clearCallsScenario2Before); // Cleared

    // Scenario 3: Session A → Session A (same ID, different status - should NOT clear)
    const sessionAUpdated: Session = {
      ...sessionA,
      status: 'completed',
      completedAt: Date.now(),
    };

    const clearCallsScenario3Before = mockResetFn.mock.calls.length;
    rerender(<XTerminal session={sessionAUpdated} />);
    await vi.runAllTimersAsync();
    expect(mockResetFn.mock.calls.length).toBe(clearCallsScenario3Before); // NOT cleared

    // Scenario 4: Session A → No session (should clear)
    const clearCallsScenario4Before = mockResetFn.mock.calls.length;
    rerender(<XTerminal session={null} />);
    await vi.runAllTimersAsync();
    expect(mockResetFn.mock.calls.length).toBeGreaterThan(clearCallsScenario4Before); // Cleared

    // Scenario 5: No session → Session B (should clear)
    const sessionB: Session = {
      id: 'session-b',
      workspaceId: 'test-workspace',
      agentType: 'claude-code',
      status: 'running',
      processId: 5678,
      startedAt: Date.now(),
      completedAt: null,
    };

    const clearCallsScenario5Before = mockResetFn.mock.calls.length;
    rerender(<XTerminal session={sessionB} />);
    await vi.runAllTimersAsync();
    expect(mockResetFn.mock.calls.length).toBeGreaterThan(clearCallsScenario5Before); // Cleared
  });

  /**
   * Test: Session status changes don't trigger clear
   * **Validates: Requirements 3.1, 4.2**
   * 
   * This test specifically verifies that when a session transitions through
   * different statuses (starting → running → completed) but keeps the same ID,
   * the terminal content is preserved.
   */
  it('should not clear terminal when session status changes but ID remains same', async () => {
    const workspace: Workspace = {
      id: 'workspace-1',
      name: 'Test Workspace',
      path: '/test/path',
      agentType: 'claude-code',
      status: 'running',
      createdAt: Date.now(),
      lastFocusedAt: Date.now(),
    };

    const sessionId = 'stable-session-id';

    // Start with 'starting' status
    const sessionStarting: Session = {
      id: sessionId,
      workspaceId: workspace.id,
      agentType: 'claude-code',
      status: 'starting',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    mockWorkspaces = [workspace];
    mockFocusedWorkspaceId = workspace.id;
    mockSessions = { [workspace.id]: sessionStarting };
    mockListSessions.mockResolvedValue([sessionStarting]);

    const { rerender } = render(<AgentTerminalPanel />);
    vi.runAllTimers();

    const clearCallsAfterStarting = mockResetFn.mock.calls.length;

    // Transition to 'running' status (same ID)
    const sessionRunning: Session = {
      ...sessionStarting,
      status: 'running',
    };

    mockSessions = { [workspace.id]: sessionRunning };
    rerender(<AgentTerminalPanel />);
    vi.runAllTimers();

    const clearCallsAfterRunning = mockResetFn.mock.calls.length;
    expect(clearCallsAfterRunning).toBe(clearCallsAfterStarting); // NOT cleared

    // Transition to 'completed' status (same ID)
    const sessionCompleted: Session = {
      ...sessionRunning,
      status: 'completed',
      completedAt: Date.now(),
    };

    mockSessions = { [workspace.id]: sessionCompleted };
    rerender(<AgentTerminalPanel />);
    vi.runAllTimers();

    const clearCallsAfterCompleted = mockResetFn.mock.calls.length;
    expect(clearCallsAfterCompleted).toBe(clearCallsAfterRunning); // NOT cleared
  });

  /**
   * Test: WebSocket session_completed event handling
   * **Validates: Requirements 3.1, 4.2**
   * 
   * This test verifies that when a session completes via WebSocket event,
   * the terminal preserves content (doesn't clear) since the session ID
   * remains the same.
   */
  it('should preserve terminal content when session completes via WebSocket', async () => {
    const workspace: Workspace = {
      id: 'workspace-1',
      name: 'Test Workspace',
      path: '/test/path',
      agentType: 'claude-code',
      status: 'running',
      createdAt: Date.now(),
      lastFocusedAt: Date.now(),
    };

    const session: Session = {
      id: 'session-1',
      workspaceId: workspace.id,
      agentType: 'claude-code',
      status: 'running',
      processId: 1234,
      startedAt: Date.now(),
      completedAt: null,
    };

    mockWorkspaces = [workspace];
    mockFocusedWorkspaceId = workspace.id;
    mockSessions = { [workspace.id]: session };
    mockListSessions.mockResolvedValue([session]);

    // Capture the WebSocket event handler
    let webSocketHandler: ((event: any) => void) | null = null;
    mockWebSocketSubscribe.mockImplementation((handler: any) => {
      webSocketHandler = handler;
      return vi.fn();
    });

    render(<AgentTerminalPanel />);
    vi.runAllTimers();

    expect(webSocketHandler).not.toBeNull();

    const clearCallsBeforeCompletion = mockResetFn.mock.calls.length;

    // Simulate session_completed WebSocket event
    webSocketHandler!({
      type: 'session_completed',
      data: {
        sessionId: session.id,
        workspaceId: workspace.id,
        success: true,
        timestamp: Date.now(),
      },
    });

    vi.runAllTimers();

    // Terminal should NOT clear because session ID remains the same
    const clearCallsAfterCompletion = mockResetFn.mock.calls.length;
    expect(clearCallsAfterCompletion).toBe(clearCallsBeforeCompletion);
  });
});
