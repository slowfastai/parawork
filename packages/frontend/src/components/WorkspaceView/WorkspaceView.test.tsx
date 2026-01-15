/**
 * Unit tests for WorkspaceView session loading logic
 * Tests that stored session is used when available and fallback to API when not
 * _Requirements: 2.3_
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { WorkspaceView } from './WorkspaceView';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import type { Session, Workspace } from '@parawork/shared';

// Mock the api module with all required methods
vi.mock('../../lib/api', () => ({
  api: {
    workspaces: {
      update: vi.fn().mockResolvedValue({}),
    },
    sessions: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      stop: vi.fn(),
      getLogs: vi.fn().mockResolvedValue([]),
      getChanges: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock the useWebSocket hook to prevent WebSocket connection attempts
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn().mockReturnValue({
    isConnected: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

// Helper to create a mock workspace
const createMockWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: 'workspace-1',
  name: 'Test Workspace',
  path: '/test/path',
  status: 'running',
  agentType: 'claude-code',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastFocusedAt: null,
  ...overrides,
});

// Helper to create a mock session
const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  workspaceId: 'workspace-1',
  agentType: 'claude-code',
  status: 'running',
  processId: 12345,
  startedAt: Date.now(),
  completedAt: null,
  ...overrides,
});

describe('WorkspaceView session loading', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppStore.setState({
      workspaces: [],
      focusedWorkspaceId: null,
      sessions: {},
      wsConnected: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use stored session from appStore when available', async () => {
    const mockWorkspace = createMockWorkspace();
    const mockSession = createMockSession();

    // Set up store with workspace and session
    useAppStore.setState({
      workspaces: [mockWorkspace],
      focusedWorkspaceId: mockWorkspace.id,
      sessions: { [mockWorkspace.id]: mockSession },
    });

    render(<WorkspaceView />);

    // Wait for effects to run
    await waitFor(() => {
      // API should NOT be called since session is in store
      expect(api.sessions.list).not.toHaveBeenCalled();
    });
  });

  it('should fall back to API when no stored session exists', async () => {
    const mockWorkspace = createMockWorkspace();
    const mockSession = createMockSession();

    // Mock API to return a session
    vi.mocked(api.sessions.list).mockResolvedValue([mockSession]);

    // Set up store with workspace but NO session
    useAppStore.setState({
      workspaces: [mockWorkspace],
      focusedWorkspaceId: mockWorkspace.id,
      sessions: {}, // No stored session
    });

    render(<WorkspaceView />);

    // Wait for API call
    await waitFor(() => {
      expect(api.sessions.list).toHaveBeenCalledWith(mockWorkspace.id);
    });
  });

  it('should store session in appStore after loading from API', async () => {
    const mockWorkspace = createMockWorkspace();
    const mockSession = createMockSession();

    // Mock API to return a session
    vi.mocked(api.sessions.list).mockResolvedValue([mockSession]);

    // Set up store with workspace but NO session
    useAppStore.setState({
      workspaces: [mockWorkspace],
      focusedWorkspaceId: mockWorkspace.id,
      sessions: {},
    });

    render(<WorkspaceView />);

    // Wait for session to be stored in appStore
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.sessions[mockWorkspace.id]).toEqual(mockSession);
    });
  });

  it('should not load session when workspace status is not running', async () => {
    const mockWorkspace = createMockWorkspace({ status: 'idle' });

    useAppStore.setState({
      workspaces: [mockWorkspace],
      focusedWorkspaceId: mockWorkspace.id,
      sessions: {},
    });

    render(<WorkspaceView />);

    // Wait a bit to ensure no API call is made
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(api.sessions.list).not.toHaveBeenCalled();
  });

  it('should not use stored session if status is not running or starting', async () => {
    const mockWorkspace = createMockWorkspace();
    const completedSession = createMockSession({ status: 'completed' });

    // Mock API to return empty (no running sessions)
    vi.mocked(api.sessions.list).mockResolvedValue([]);

    // Set up store with a completed session
    useAppStore.setState({
      workspaces: [mockWorkspace],
      focusedWorkspaceId: mockWorkspace.id,
      sessions: { [mockWorkspace.id]: completedSession },
    });

    render(<WorkspaceView />);

    // Should fall back to API since stored session is completed
    await waitFor(() => {
      expect(api.sessions.list).toHaveBeenCalledWith(mockWorkspace.id);
    });
  });
});
