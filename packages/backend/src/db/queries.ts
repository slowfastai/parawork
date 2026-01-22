/**
 * Database queries for Parawork
 */
import { getDatabase } from './index.js';
import type {
  Workspace,
  Session,
  Message,
  FileChange,
  AgentLog,
  SessionHistoryItem,
  ConversationEvent,
  Repository,
  WorkspaceStatus,
  SessionStatus,
  AgentType,
  MessageRole,
  ChangeType,
  LogLevel,
} from '@parawork/shared';
import { sanitizeForDisplay } from '../utils/validation.js';

/**
 * Database row interfaces (snake_case as stored in SQLite)
 */
interface RepositoryRow {
  id: string;
  name: string;
  path: string;
  default_branch: string;
  remote_url: string | null;
  created_at: number;
  updated_at: number;
}

interface WorkspaceRow {
  id: string;
  repository_id: string | null;
  name: string;
  path: string;
  status: string;
  agent_type: string | null;
  created_at: number;
  updated_at: number;
  last_focused_at: number | null;
  // Git worktree fields
  git_worktree_path: string | null;
  git_branch_name: string | null;
  git_base_repo_path: string | null;
  git_base_branch: string | null;
  git_created_at: number | null;
}

interface SessionRow {
  id: string;
  workspace_id: string;
  agent_type: string;
  status: string;
  process_id: number | null;
  started_at: number | null;
  completed_at: number | null;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
}

interface FileChangeRow {
  id: number;
  session_id: string;
  file_path: string;
  change_type: string;
  diff: string | null;
  timestamp: number;
}

interface AgentLogRow {
  id: number;
  session_id: string;
  timestamp: number;
  level: string;
  message: string;
}

/**
 * Convert database row to Repository model
 */
function rowToRepository(row: RepositoryRow): Repository {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    defaultBranch: row.default_branch,
    remoteUrl: row.remote_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to Workspace model
 */
function rowToWorkspace(row: WorkspaceRow): Workspace {
  const workspace: Workspace = {
    id: row.id,
    repositoryId: row.repository_id,
    name: row.name,
    path: row.path,
    status: row.status as WorkspaceStatus,
    agentType: row.agent_type as AgentType | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastFocusedAt: row.last_focused_at,
  };

  // Add git worktree metadata if exists
  if (row.git_worktree_path && row.git_branch_name && row.git_base_repo_path) {
    workspace.gitWorktree = {
      worktreePath: row.git_worktree_path,
      branchName: row.git_branch_name,
      baseRepoPath: row.git_base_repo_path,
      baseBranch: row.git_base_branch || 'origin/main',
      createdAt: row.git_created_at || row.created_at,
    };
  }

  return workspace;
}

/**
 * Convert database row to Session model
 */
function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentType: row.agent_type as AgentType,
    status: row.status as SessionStatus,
    processId: row.process_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/**
 * Convert database row to Message model
 */
function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as MessageRole,
    content: row.content,
    timestamp: row.timestamp,
  };
}

/**
 * Convert database row to FileChange model
 */
function rowToFileChange(row: FileChangeRow): FileChange {
  return {
    id: row.id,
    sessionId: row.session_id,
    filePath: row.file_path,
    changeType: row.change_type as ChangeType,
    diff: row.diff,
    timestamp: row.timestamp,
  };
}

/**
 * Convert database row to AgentLog model
 */
function rowToAgentLog(row: AgentLogRow): AgentLog {
  return {
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    level: row.level as LogLevel,
    message: sanitizeForDisplay(row.message),
  };
}

/**
 * Allowed update fields for workspaces (prevents SQL injection via field names)
 */
const WORKSPACE_UPDATE_FIELDS = ['name', 'status', 'agent_type', 'last_focused_at'] as const;

/**
 * Allowed update fields for sessions
 */
const SESSION_UPDATE_FIELDS = ['status', 'process_id', 'started_at', 'completed_at'] as const;

/**
 * Repository queries
 */
export const repositoryQueries = {
  /**
   * Create a new repository
   */
  create(repository: Repository): Repository {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO repositories (id, name, path, default_branch, remote_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      repository.id,
      repository.name,
      repository.path,
      repository.defaultBranch,
      repository.remoteUrl,
      repository.createdAt,
      repository.updatedAt
    );

    return repository;
  },

  /**
   * Get all repositories
   */
  getAll(): Repository[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM repositories ORDER BY name ASC');
    const rows = stmt.all() as RepositoryRow[];
    return rows.map(rowToRepository);
  },

  /**
   * Get repository by ID
   */
  getById(id: string): Repository | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM repositories WHERE id = ?');
    const row = stmt.get(id) as RepositoryRow | undefined;
    return row ? rowToRepository(row) : null;
  },

  /**
   * Get repository by path
   */
  getByPath(path: string): Repository | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM repositories WHERE path = ?');
    const row = stmt.get(path) as RepositoryRow | undefined;
    return row ? rowToRepository(row) : null;
  },

  /**
   * Update repository
   */
  update(id: string, updates: Partial<Repository>): Repository | null {
    const db = getDatabase();
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.defaultBranch !== undefined) {
      setClauses.push('default_branch = ?');
      values.push(updates.defaultBranch);
    }
    if (updates.remoteUrl !== undefined) {
      setClauses.push('remote_url = ?');
      values.push(updates.remoteUrl);
    }

    if (setClauses.length === 0) {
      return this.getById(id);
    }

    setClauses.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE repositories SET ${setClauses.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);

    return this.getById(id);
  },

  /**
   * Delete repository
   */
  delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM repositories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  /**
   * Get workspaces belonging to a repository
   */
  getWorkspaces(repositoryId: string): Workspace[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM workspaces WHERE repository_id = ? ORDER BY created_at ASC, id ASC');
    const rows = stmt.all(repositoryId) as WorkspaceRow[];
    return rows.map(rowToWorkspace);
  },
};

/**
 * Workspace queries
 */
export const workspaceQueries = {
  /**
   * Create a new workspace
   */
  create(workspace: Workspace): Workspace {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO workspaces (
        id, repository_id, name, path, status, agent_type, created_at, updated_at, last_focused_at,
        git_worktree_path, git_branch_name, git_base_repo_path, git_base_branch, git_created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      workspace.id,
      workspace.repositoryId,
      workspace.name,
      workspace.path,
      workspace.status,
      workspace.agentType,
      workspace.createdAt,
      workspace.updatedAt,
      workspace.lastFocusedAt,
      workspace.gitWorktree?.worktreePath || null,
      workspace.gitWorktree?.branchName || null,
      workspace.gitWorktree?.baseRepoPath || null,
      workspace.gitWorktree?.baseBranch || null,
      workspace.gitWorktree?.createdAt || null
    );

    return workspace;
  },

  /**
   * Get all workspaces
   */
  getAll(): Workspace[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM workspaces ORDER BY created_at ASC, id ASC');
    const rows = stmt.all() as WorkspaceRow[];
    return rows.map(rowToWorkspace);
  },

  /**
   * Get workspace by ID
   */
  getById(id: string): Workspace | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    const row = stmt.get(id) as WorkspaceRow | undefined;
    return row ? rowToWorkspace(row) : null;
  },

  /**
   * Update workspace with safe field mapping
   */
  update(id: string, updates: Partial<Workspace>): Workspace | null {
    const db = getDatabase();
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    // Map camelCase to snake_case and validate field names
    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.agentType !== undefined) {
      setClauses.push('agent_type = ?');
      values.push(updates.agentType);
    }
    if (updates.lastFocusedAt !== undefined) {
      setClauses.push('last_focused_at = ?');
      values.push(updates.lastFocusedAt);
    }

    if (setClauses.length === 0) {
      return this.getById(id);
    }

    setClauses.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);

    return this.getById(id);
  },

  /**
   * Delete workspace
   */
  delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM workspaces WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

/**
 * Session queries
 */
export const sessionQueries = {
  /**
   * Create a new session
   */
  create(session: Session): Session {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO sessions (id, workspace_id, agent_type, status, process_id, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.workspaceId,
      session.agentType,
      session.status,
      session.processId,
      session.startedAt,
      session.completedAt
    );

    return session;
  },

  /**
   * Get session by ID
   */
  getById(id: string): Session | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  },

  /**
   * Get sessions by workspace ID
   */
  getByWorkspaceId(workspaceId: string): Session[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM sessions WHERE workspace_id = ? ORDER BY started_at DESC');
    const rows = stmt.all(workspaceId) as SessionRow[];
    return rows.map(rowToSession);
  },

  /**
   * Get active session for workspace
   */
  getActiveByWorkspaceId(workspaceId: string): Session | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM sessions
      WHERE workspace_id = ? AND status IN ('starting', 'running')
      ORDER BY started_at DESC
      LIMIT 1
    `);
    const row = stmt.get(workspaceId) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  },

  /**
   * Update session with safe field mapping
   */
  update(id: string, updates: Partial<Session>): Session | null {
    const db = getDatabase();
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.processId !== undefined) {
      setClauses.push('process_id = ?');
      values.push(updates.processId);
    }
    if (updates.startedAt !== undefined) {
      setClauses.push('started_at = ?');
      values.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push('completed_at = ?');
      values.push(updates.completedAt);
    }

    if (setClauses.length === 0) {
      return this.getById(id);
    }

    values.push(id);

    const sql = `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);

    return this.getById(id);
  },

  /**
   * Get completed sessions for workspace with metadata
   */
  getCompletedByWorkspaceId(workspaceId: string): SessionHistoryItem[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        s.*,
        COUNT(m.id) as message_count,
        CASE 
          WHEN s.completed_at IS NOT NULL AND s.started_at IS NOT NULL 
          THEN s.completed_at - s.started_at 
          ELSE 0 
        END as duration,
        (
          SELECT m.content 
          FROM messages m 
          WHERE m.session_id = s.id 
          ORDER BY m.timestamp DESC 
          LIMIT 1
        ) as last_message
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
      WHERE s.workspace_id = ? AND s.status IN ('completed', 'failed')
      GROUP BY s.id
      ORDER BY s.started_at DESC
    `);
    const rows = stmt.all(workspaceId) as any[];
    return rows.map(row => ({
      ...rowToSession(row),
      messageCount: row.message_count,
      duration: row.duration,
      lastMessage: row.last_message
    }));
  },

  /**
   * Get full conversation timeline for a session
   */
  getFullConversation(sessionId: string): ConversationEvent[] {
    const db = getDatabase();
    
    // Get messages
    const messageStmt = db.prepare(`
      SELECT 'message' as type, id, timestamp, content, role, NULL as level
      FROM messages 
      WHERE session_id = ? 
    `);
    
    // Get agent logs (as terminal activity)
    const logStmt = db.prepare(`
      SELECT 'agent_log' as type, id, timestamp, message as content, NULL as role, level
      FROM agent_logs 
      WHERE session_id = ? 
    `);
    
    const messages = messageStmt.all(sessionId) as any[];
    const logs = logStmt.all(sessionId) as any[];
    
    // Merge and sort by timestamp
    return [...messages, ...logs]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(row => ({
        id: row.id.toString(),
        type: row.type,
        timestamp: row.timestamp,
        content: row.type === 'agent_log' ? sanitizeForDisplay(String(row.content ?? '')) : row.content,
        role: row.role,
        level: row.level
      }));
  },
};

/**
 * Message queries
 */
export const messageQueries = {
  /**
   * Create a new message
   */
  create(message: Message): Message {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.timestamp
    );

    return message;
  },

  /**
   * Get messages by session ID
   */
  getBySessionId(sessionId: string): Message[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC');
    const rows = stmt.all(sessionId) as MessageRow[];
    return rows.map(rowToMessage);
  },
};

/**
 * File change queries
 */
export const fileChangeQueries = {
  /**
   * Create a new file change
   */
  create(change: Omit<FileChange, 'id'>): FileChange {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO file_changes (session_id, file_path, change_type, diff, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      change.sessionId,
      change.filePath,
      change.changeType,
      change.diff,
      change.timestamp
    );

    return {
      id: Number(result.lastInsertRowid),
      ...change,
    };
  },

  /**
   * Get file changes by session ID
   */
  getBySessionId(sessionId: string): FileChange[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM file_changes WHERE session_id = ? ORDER BY timestamp DESC');
    const rows = stmt.all(sessionId) as FileChangeRow[];
    return rows.map(rowToFileChange);
  },
};

/**
 * Agent log queries
 */
export const agentLogQueries = {
  /**
   * Create a new log entry
   */
  create(log: Omit<AgentLog, 'id'>): AgentLog {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO agent_logs (session_id, timestamp, level, message)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      log.sessionId,
      log.timestamp,
      log.level,
      log.message
    );

    return {
      id: Number(result.lastInsertRowid),
      ...log,
    };
  },

  /**
   * Get logs by session ID
   */
  getBySessionId(sessionId: string, limit?: number): AgentLog[] {
    const db = getDatabase();
    const query = limit
      ? 'SELECT * FROM agent_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT * FROM agent_logs WHERE session_id = ? ORDER BY timestamp DESC';

    const stmt = db.prepare(query);
    const rows = (limit ? stmt.all(sessionId, limit) : stmt.all(sessionId)) as AgentLogRow[];
    return rows.map(rowToAgentLog);
  },
};
