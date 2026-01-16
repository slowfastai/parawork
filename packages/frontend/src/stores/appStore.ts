/**
 * Global application store using Zustand
 */
import { create } from 'zustand';
import type { Workspace, Session, Repository } from '@parawork/shared';

interface AppState {
  // Repositories
  repositories: Repository[];
  setRepositories: (repositories: Repository[]) => void;
  addRepository: (repository: Repository) => void;
  updateRepository: (id: string, updates: Partial<Repository>) => void;
  removeRepository: (id: string) => void;

  // Workspaces
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;

  // Focused workspace (the ONE workspace currently being viewed)
  focusedWorkspaceId: string | null;
  setFocusedWorkspace: (id: string | null) => void;

  // Active sessions (workspaceId -> session mapping)
  sessions: Record<string, Session>;
  setCurrentSession: (workspaceId: string, session: Session | null) => void;
  removeSession: (workspaceId: string) => void;

  // WebSocket connection status
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Repositories
  repositories: [],
  setRepositories: (repositories) => set({ repositories }),
  addRepository: (repository) =>
    set((state) => ({
      repositories: [repository, ...state.repositories],
    })),
  updateRepository: (id, updates) =>
    set((state) => ({
      repositories: state.repositories.map((repo) =>
        repo.id === id ? { ...repo, ...updates } : repo
      ),
    })),
  removeRepository: (id) =>
    set((state) => ({
      repositories: state.repositories.filter((repo) => repo.id !== id),
    })),

  // Workspaces
  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) =>
    set((state) => ({
      workspaces: [workspace, ...state.workspaces],
    })),
  updateWorkspace: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === id ? { ...ws, ...updates } : ws
      ),
    })),
  removeWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.filter((ws) => ws.id !== id),
      focusedWorkspaceId:
        state.focusedWorkspaceId === id ? null : state.focusedWorkspaceId,
      // Also remove session for this workspace
      sessions: Object.fromEntries(
        Object.entries(state.sessions).filter(([wsId]) => wsId !== id)
      ),
    })),

  // Focused workspace
  focusedWorkspaceId: null,
  setFocusedWorkspace: (id) => set({ focusedWorkspaceId: id }),

  // Sessions
  sessions: {},
  setCurrentSession: (workspaceId, session) =>
    set((state) => ({
      sessions: session
        ? { ...state.sessions, [workspaceId]: session }
        : Object.fromEntries(
            Object.entries(state.sessions).filter(([wsId]) => wsId !== workspaceId)
          ),
    })),
  removeSession: (workspaceId) =>
    set((state) => ({
      sessions: Object.fromEntries(
        Object.entries(state.sessions).filter(([wsId]) => wsId !== workspaceId)
      ),
    })),

  // WebSocket connection
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
