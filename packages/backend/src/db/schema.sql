-- Parawork Database Schema
-- Workspace-centric design for focus-first agent orchestration

-- Workspaces (focus units, like browser tabs)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('idle', 'running', 'completed', 'error')),
  agent_type TEXT CHECK(agent_type IN ('claude-code', 'codex') OR agent_type IS NULL),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_focused_at INTEGER,
  -- Git worktree metadata (nullable for backward compatibility)
  git_worktree_path TEXT,
  git_branch_name TEXT,
  git_base_repo_path TEXT,
  git_base_branch TEXT,
  git_created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_last_focused ON workspaces(last_focused_at DESC);

-- Sessions (agent execution within workspace)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK(agent_type IN ('claude-code', 'codex')),
  status TEXT NOT NULL CHECK(status IN ('starting', 'running', 'completed', 'failed')),
  process_id INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Messages (chat conversation with agent)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- File Changes (what agent modified)
CREATE TABLE IF NOT EXISTS file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('created', 'modified', 'deleted')),
  diff TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_changes_session ON file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_timestamp ON file_changes(timestamp);

-- Agent Logs (real-time streaming logs per workspace)
CREATE TABLE IF NOT EXISTS agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_session ON agent_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp);
