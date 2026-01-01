/**
 * Core domain types for Parawork
 */

export type WorkspaceStatus = 'idle' | 'running' | 'completed' | 'error';
export type SessionStatus = 'starting' | 'running' | 'completed' | 'failed';
export type MessageRole = 'user' | 'assistant';
export type ChangeType = 'created' | 'modified' | 'deleted';
export type AgentType = 'claude-code' | 'codex';
export type LogLevel = 'info' | 'warning' | 'error';

/**
 * Workspace represents a focus unit (like a browser tab)
 */
export interface Workspace {
  id: string;
  name: string;
  path: string;
  status: WorkspaceStatus;
  agentType: AgentType | null;
  createdAt: number;
  updatedAt: number;
  lastFocusedAt: number | null;
}

/**
 * Session represents an agent execution within a workspace
 */
export interface Session {
  id: string;
  workspaceId: string;
  agentType: AgentType;
  status: SessionStatus;
  processId: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

/**
 * Message represents a chat message with an agent
 */
export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/**
 * FileChange represents a file modification by an agent
 */
export interface FileChange {
  id: number;
  sessionId: string;
  filePath: string;
  changeType: ChangeType;
  diff: string | null;
  timestamp: number;
}

/**
 * AgentLog represents a log entry from an agent
 */
export interface AgentLog {
  id: number;
  sessionId: string;
  timestamp: number;
  level: LogLevel;
  message: string;
}

/**
 * GitInfo represents git repository metadata
 */
export interface GitInfo {
  branch: string | null;
  remote: string | null;
}

/**
 * DirectoryEntry represents a directory with git detection
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: true;
  isGitRepository: boolean;
  gitInfo?: GitInfo;
  lastModified: number;
  itemCount?: number;
}

/**
 * BrowseResponse represents the response from directory browsing
 */
export interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

/**
 * WebSocket event types
 */
export type WebSocketEventType =
  | 'workspace_status_changed'
  | 'agent_log'
  | 'agent_message'
  | 'file_changed'
  | 'session_completed'
  | 'focus_workspace'
  | 'subscribe_workspace'
  | 'unsubscribe_workspace';

/**
 * WebSocket event payloads
 */
export interface WorkspaceStatusChangedEvent {
  type: 'workspace_status_changed';
  data: {
    workspaceId: string;
    status: WorkspaceStatus;
    timestamp: number;
  };
}

export interface AgentLogEvent {
  type: 'agent_log';
  data: {
    sessionId: string;
    workspaceId: string;
    level: LogLevel;
    message: string;
    timestamp: number;
  };
}

export interface AgentMessageEvent {
  type: 'agent_message';
  data: {
    sessionId: string;
    workspaceId: string;
    role: MessageRole;
    content: string;
    timestamp: number;
  };
}

export interface FileChangedEvent {
  type: 'file_changed';
  data: {
    sessionId: string;
    workspaceId: string;
    filePath: string;
    changeType: ChangeType;
    timestamp: number;
  };
}

export interface SessionCompletedEvent {
  type: 'session_completed';
  data: {
    sessionId: string;
    workspaceId: string;
    success: boolean;
    timestamp: number;
  };
}

export interface FocusWorkspaceEvent {
  type: 'focus_workspace';
  data: {
    workspaceId: string;
  };
}

export interface SubscribeWorkspaceEvent {
  type: 'subscribe_workspace';
  data: {
    workspaceId: string;
  };
}

export interface UnsubscribeWorkspaceEvent {
  type: 'unsubscribe_workspace';
  data: {
    workspaceId: string;
  };
}

export type ServerToClientEvent =
  | WorkspaceStatusChangedEvent
  | AgentLogEvent
  | AgentMessageEvent
  | FileChangedEvent
  | SessionCompletedEvent;

export type ClientToServerEvent =
  | FocusWorkspaceEvent
  | SubscribeWorkspaceEvent
  | UnsubscribeWorkspaceEvent;

export type WebSocketEvent = ServerToClientEvent | ClientToServerEvent;

/**
 * API Request/Response types
 */
export interface CreateWorkspaceRequest {
  name: string;
  path: string;
  agentType?: AgentType;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  status?: WorkspaceStatus;
  lastFocusedAt?: number;
}

export interface CreateSessionRequest {
  agentType: AgentType;
  initialPrompt?: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Configuration types
 */
export interface AgentConfig {
  enabled: boolean;
  command: string;
  defaultArgs: string[];
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origins: string[];
  };
}

export interface DatabaseConfig {
  path: string;
}

export interface TunnelConfig {
  enabled: boolean;
  provider: string;
  domain: string;
}

export interface SecurityConfig {
  apiKey: string;
}

export interface FeaturesConfig {
  gitIntegration: boolean;
  autoCleanup: boolean;
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  agents: Record<string, AgentConfig>;
  tunnel: TunnelConfig;
  security: SecurityConfig;
  features: FeaturesConfig;
}
