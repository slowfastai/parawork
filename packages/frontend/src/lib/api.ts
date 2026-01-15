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
  BrowseResponse,
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

  // Handle HTTP errors
  if (!response.ok) {
    // Try to parse error response as JSON
    const text = await response.text();
    if (text) {
      try {
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
      } catch {
        throw new Error(`HTTP ${response.status}: ${text || 'Request failed'}`);
      }
    }
    throw new Error(`HTTP ${response.status}: Request failed`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    throw new Error('Empty response from server');
  }

  const data: ApiResponse<T> = JSON.parse(text);

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

    list: (workspaceId: string) =>
      fetchApi<Session[]>(`/workspaces/${workspaceId}/sessions`),

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

    sendInput: (id: string, input: string) =>
      fetchApi<void>(`/sessions/${id}/input`, {
        method: 'POST',
        body: JSON.stringify({ input }),
      }),

    openInTerminal: (id: string) =>
      fetchApi<void>(`/sessions/${id}/open-terminal`, {
        method: 'POST',
      }),
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

  // Filesystem
  filesystem: {
    browse: (path?: string) =>
      fetchApi<BrowseResponse>(
        `/fs/browse${path ? `?path=${encodeURIComponent(path)}` : ''}`
      ),
  },
};
