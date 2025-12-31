/**
 * Global application store using Zustand
 */
import { create } from 'zustand';
import type { Workspace } from '@parawork/shared';

interface AppState {
  // Workspaces
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;

  // Focused workspace (the ONE workspace currently being viewed)
  focusedWorkspaceId: string | null;
  setFocusedWorkspace: (id: string | null) => void;

  // WebSocket connection status
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
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
    })),

  // Focused workspace
  focusedWorkspaceId: null,
  setFocusedWorkspace: (id) => set({ focusedWorkspaceId: id }),

  // WebSocket connection
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
