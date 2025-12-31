/**
 * API client for Parawork backend
 */
import type {
  Workspace,
  Session,
  Message,
  FileChange,
  AgentLog,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  CreateSessionRequest,
  SendMessageRequest,
  ApiResponse,
} from '@parawork/shared';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/**
 * Get API key from localStorage
 */
function getApiKey(): string {
  return localStorage.getItem('parawork_api_key') || '';
}

/**
 * Set API key in localStorage
 */
export function setApiKey(key: string): void {
  localStorage.setItem('parawork_api_key', key);
}

/**
 * Check if API key is configured
 */
export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options?.headers,
    },
  });

  // Handle authentication errors
  if (response.status === 401 || response.status === 403) {
    throw new Error('Authentication failed. Please check your API key.');
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }

  return data.data as T;
}

export const api = {
  // Workspaces
  workspaces: {
    list: () => fetchApi<Workspace[]>('/workspaces'),

    create: (data: CreateWorkspaceRequest) =>
      fetchApi<Workspace>('/workspaces', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => fetchApi<Workspace>(`/workspaces/${id}`),

    update: (id: string, data: UpdateWorkspaceRequest) =>
      fetchApi<Workspace>(`/workspaces/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchApi<void>(`/workspaces/${id}`, {
        method: 'DELETE',
      }),
  },

  // Sessions
  sessions: {
    create: (workspaceId: string, data: CreateSessionRequest) =>
      fetchApi<Session>(`/workspaces/${workspaceId}/sessions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => fetchApi<Session>(`/sessions/${id}`),

    stop: (id: string) =>
      fetchApi<Session>(`/sessions/${id}/stop`, {
        method: 'POST',
      }),

    getLogs: (id: string, limit?: number) => {
      const query = limit ? `?limit=${limit}` : '';
      return fetchApi<AgentLog[]>(`/sessions/${id}/logs${query}`);
    },

    getMessages: (id: string) =>
      fetchApi<Message[]>(`/sessions/${id}/messages`),

    sendMessage: (id: string, data: SendMessageRequest) =>
      fetchApi<Message>(`/sessions/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getChanges: (id: string) =>
      fetchApi<FileChange[]>(`/sessions/${id}/changes`),
  },

  // System
  system: {
    health: () =>
      fetchApi<{ status: string; timestamp: number }>('/health'),

    getAgents: () =>
      fetchApi<Array<{ name: string; command: string; defaultArgs: string[] }>>(
        '/agents'
      ),

    getConfig: () => fetchApi<Record<string, unknown>>('/config'),

    // Test API key validity
    testConnection: async (): Promise<boolean> => {
      try {
        await fetchApi<{ status: string; timestamp: number }>('/health');
        return true;
      } catch {
        return false;
      }
    },
  },
};
