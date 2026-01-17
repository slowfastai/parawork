# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Parawork is an open-source TypeScript web orchestrator for AI coding agents (Claude Code, Codex, etc). It provides a **focus-first design** where you can run multiple agents in parallel in the background while focusing on ONE workspace at a time (like browser tabs, not split screen).

**Tech Stack:**
- **Backend**: Node.js + TypeScript + Express + SQLite + WebSocket
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Zustand
- **Monorepo**: pnpm workspaces

## Development Commands

### Prerequisites
- Node.js 18+ required
- pnpm 8+ required (`npm install -g pnpm`)
- Must use pnpm (not npm or yarn)

### Common Commands

```bash
# Install dependencies (from root)
pnpm install

# Run all packages in development mode (parallel)
pnpm dev

# Run individual packages
cd packages/backend && pnpm dev    # Backend on http://localhost:3000
cd packages/frontend && pnpm dev   # Frontend on http://localhost:5173

# Build all packages
pnpm build

# Type check all packages
pnpm typecheck

# Lint (frontend only currently)
cd packages/frontend && pnpm lint

# Clean build artifacts
pnpm clean

# Production
cd packages/backend && pnpm start    # Start production backend
cd packages/frontend && pnpm preview # Preview production frontend
```

### Package-Specific Scripts

**Backend** (`packages/backend`):
- `pnpm dev` - Run with tsx watch mode (auto-reload)
- `pnpm build` - Compile TypeScript to `dist/`
- `pnpm start` - Run production build
- `pnpm typecheck` - Type check without emitting
- `pnpm test` - Run tests with vitest
- `pnpm test:watch` - Run tests in watch mode

**Frontend** (`packages/frontend`):
- `pnpm dev` - Run Vite dev server
- `pnpm build` - Build for production (runs tsc + vite build)
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests with vitest
- `pnpm test:watch` - Run tests in watch mode

**Shared** (`packages/shared`):
- `pnpm build` - Compile shared types
- `pnpm dev` - Watch mode for type changes

## Architecture

### Monorepo Structure

```
packages/
├── backend/          # Node.js server
│   ├── src/
│   │   ├── agents/   # Agent process monitoring, lifecycle, and user terminals
│   │   │   ├── monitor.ts      # Agent session management
│   │   │   └── userTerminal.ts # PTY terminal management (node-pty)
│   │   ├── api/      # REST routes + WebSocket server
│   │   │   ├── routes/         # API endpoints (repositories, workspaces, sessions, terminals, filesystem)
│   │   │   └── websocket.ts    # WebSocket event handling
│   │   ├── db/       # SQLite database (better-sqlite3)
│   │   ├── config/   # Configuration management
│   │   ├── middleware/ # Auth, rate limiting
│   │   └── utils/    # Validation, filesystem utilities
│   └── data/         # SQLite database files (gitignored)
├── frontend/         # React web UI
│   └── src/
│       ├── components/ # React components
│       │   ├── AgentTerminalPanel/     # Agent output terminal
│       │   ├── RightPanel/             # Right panel with user terminal
│       │   ├── RepositorySwitcher/     # Repository management UI
│       │   ├── WorkspaceSwitcher/      # Workspace list
│       │   ├── WorkspaceView/          # Main workspace UI
│       │   ├── Layout/                 # 3-panel layout
│       │   ├── DirectoryBrowser.tsx    # Folder picker
│       │   └── NewWorkspaceDialog.tsx  # Workspace creation
│       ├── stores/   # Zustand state management
│       ├── hooks/    # Custom React hooks (WebSocket, API)
│       ├── contexts/ # React contexts (WebSocket)
│       └── lib/      # API client utilities
└── shared/           # Shared TypeScript types
    └── src/
        ├── types.ts  # Core domain types (Repository, Workspace, Session, etc.)
        └── schemas.ts # Zod validation schemas
```

### Key Architectural Concepts

#### 1. Repository and Workspace Model
- **Repository** = A git repository that contains the main branch and can spawn multiple workspaces
- **Workspace** = A focus unit (like a browser tab), represents a git worktree for isolated work
- **Session** = An agent execution within a workspace (can have multiple sessions over time)
- Users focus on **ONE** workspace at a time, while others run in the background
- The UI uses `focusedWorkspaceId` in Zustand store to track which workspace is being viewed

**Git Worktree Workflow:**
- Repositories are registered first (pointing to the main branch)
- Workspaces are created from repositories using git worktrees
- Each workspace is an isolated worktree for a specific task/feature
- Base repository should always be on main branch when creating new workspaces
- This allows multiple agents to work on different features simultaneously without conflicts
- The 3-panel layout: Repository list (left) → Workspace list (center) → Active workspace (right)

#### 2. Real-Time Communication
- **WebSocket** for bidirectional real-time updates (logs, status changes, messages)
- **REST API** for CRUD operations (create workspace, start session, etc)
- Clients subscribe to specific workspaces via WebSocket to receive targeted updates
- See `packages/backend/src/api/websocket.ts` for WebSocket event types

#### 3. Agent Process Management
- Agents run as child processes spawned via `child_process.spawn()`
- Output is buffered and streamed in real-time via WebSocket
- Processes are monitored in `packages/backend/src/agents/monitor.ts`
- Graceful shutdown with SIGTERM, force kill with SIGKILL after timeout
- Output buffer limits (1MB per stream) to prevent memory issues

#### 4. User Terminal System
- **User terminals** are separate from agent terminals - they provide an interactive shell in the workspace directory
- Powered by **node-pty** for real PTY (pseudo-terminal) support
- Backend manages PTY processes in `packages/backend/src/agents/userTerminal.ts`
- Frontend uses **xterm.js** for terminal rendering in `packages/frontend/src/components/RightPanel/UserTerminal.tsx`
- One terminal per workspace, persists across UI navigation (can reconnect to existing terminal)
- WebSocket events: `user_terminal_data`, `user_terminal_input`, `user_terminal_resize`, `user_terminal_started`, `user_terminal_exited`
- Allows users to run commands (git, npm, etc.) while agent is working

#### 5. Database Schema
- **SQLite** with WAL mode for better concurrency
- **6 core tables**: repositories, workspaces, sessions, messages, file_changes, agent_logs
- `repositories` table stores git repositories (main branch locations)
- `workspaces` table includes `repositoryId` foreign key linking to parent repository
- Cascading deletes: deleting a repository deletes all workspaces; deleting a workspace deletes all sessions/logs/messages
- Schema in `packages/backend/src/db/schema.sql`
- Queries use prepared statements in `packages/backend/src/db/queries.ts`

#### 6. Type Safety
- Shared types in `@parawork/shared` package used by both backend and frontend
- Zod schemas for runtime validation (WebSocket messages, API requests)
- Full TypeScript strict mode

### Data Flow Example: Starting an Agent Session

1. **Frontend**: User clicks "Start" button on a workspace
2. **API Request**: `POST /api/workspaces/:id/sessions` with agent type
3. **Backend**: Creates session record in DB with `starting` status
4. **Agent Monitor**: Spawns child process (e.g., `claude code`)
5. **Process Output**: stdout/stderr captured and buffered
6. **WebSocket Broadcast**: Logs streamed to subscribed clients in real-time
7. **Completion**: On process exit, session marked as `completed` or `failed`

### Configuration

Backend config at `packages/backend/config.json`:
- Server settings (port, host, CORS)
- Database path
- Agent commands (claude-code, codex)
- Security (API key for WebSocket auth)
- Feature flags (git integration, auto-cleanup)

Config is auto-generated on first run with defaults. Edit this file to customize.

### WebSocket Events

**Server → Client:**
- `workspace_status_changed` - Workspace status update
- `agent_log` - Real-time agent output logs
- `agent_message` - Chat message from agent
- `file_changed` - File modification notification
- `session_completed` - Session completion event
- `user_terminal_data` - Terminal output data
- `user_terminal_started` - Terminal started notification
- `user_terminal_exited` - Terminal exited notification

**Client → Server:**
- `focus_workspace` - User focused on workspace
- `subscribe_workspace` - Subscribe to workspace updates
- `unsubscribe_workspace` - Unsubscribe from workspace
- `user_terminal_input` - Send input to user terminal
- `user_terminal_resize` - Resize terminal dimensions

### Security Considerations

- Command validation: Agent commands are whitelisted in `utils/validation.ts`
- API key authentication for WebSocket connections
- Input sanitization for logs and file paths
- Output size limits to prevent DoS
- CORS configuration for frontend origin
- SQL injection prevention via prepared statements

## Important File Locations

**Backend:**
- `src/index.ts` - Entry point, initializes DB and starts server
- `src/server.ts` - Express server setup with routes
- `src/agents/monitor.ts` - Core agent lifecycle management
- `src/agents/userTerminal.ts` - User terminal PTY management
- `src/api/websocket.ts` - WebSocket server and event handling
- `src/api/routes/` - API endpoints (repositories, workspaces, sessions, terminals, filesystem)
- `src/db/queries.ts` - All database operations
- `src/config/settings.ts` - Configuration loading

**Frontend:**
- `src/App.tsx` - Root component with routing
- `src/stores/appStore.ts` - Global state (repositories, workspaces, focused workspace)
- `src/contexts/WebSocketContext.tsx` - WebSocket connection context
- `src/hooks/useWebSocket.ts` - WebSocket hooks
- `src/lib/api.ts` - REST API client functions
- `src/components/Layout/` - 3-panel layout components
- `src/components/RepositorySwitcher/` - Repository list and management
- `src/components/WorkspaceSwitcher/` - Workspace list
- `src/components/RightPanel/UserTerminal.tsx` - Interactive user terminal (xterm.js)
- `src/components/AgentTerminalPanel/` - Agent output terminal
- `src/components/DirectoryBrowser.tsx` - Directory picker with git repository indicators

**Shared:**
- `src/types.ts` - All TypeScript interfaces and types (Repository, Workspace, Session, etc.)
- `src/schemas.ts` - Zod validation schemas

## Development Tips

### When Adding New Features

1. **Types first**: Add types to `packages/shared/src/types.ts`
2. **Database**: Update `schema.sql` if needed, add queries to `queries.ts`
3. **Backend**: Add API routes, WebSocket events, business logic
4. **Frontend**: Add UI components, API calls, WebSocket handlers
5. **Build shared**: Run `cd packages/shared && pnpm build` after type changes

### Working with the Database

- Database file: `packages/backend/data/parawork.db`
- Use prepared statements from `db/queries.ts` - never raw SQL in routes
- Run migrations by updating `schema.sql` (uses `CREATE TABLE IF NOT EXISTS`)
- To reset DB: delete `data/` directory and restart backend

### WebSocket Development

- Test WebSocket auth by passing API key as query param: `ws://localhost:3000?apiKey=...`
- API key is auto-generated in `config.json` on first run
- Clients must subscribe to workspaces to receive their events
- Use Chrome DevTools → Network → WS to debug WebSocket messages

### Agent Process Debugging

- Agent stdout/stderr is captured and stored in `agent_logs` table
- Check `activeProcesses` Map in `agents/monitor.ts` for running processes
- Process limits: 1MB buffer per stream, 10KB max per log message
- Graceful shutdown timeout: 5 seconds before force kill

### Testing

- **Test framework**: Vitest for both backend and frontend
- **Backend tests**: Located in `packages/backend/src/**/*.test.ts`
- **Frontend tests**: Located in `packages/frontend/src/**/*.test.tsx`
- Run tests with `pnpm test` (one-time) or `pnpm test:watch` (watch mode)
- Test utilities: `fast-check` for property-based testing, `@testing-library/react` for component testing
- Coverage reports generated with `vitest --coverage`

### Common Pitfalls

- **Forgetting to build shared**: After changing types, run `pnpm build` in `packages/shared`
- **Port conflicts**: Backend (3000) and frontend (5173) must be available
- **Database locks**: SQLite is in WAL mode but still has limits on concurrent writes
- **WebSocket auth**: Must include API key from `config.json` in connection URL
- **CORS**: Add frontend URL to `config.json` cors.origins if running on different port
- **Terminal not working**: Ensure workspace has a valid path and user terminal has been started
- **Repository/Workspace relationship**: Workspaces must be linked to a repository; standalone workspaces are deprecated

## UI Components

### Directory Browser

The `DirectoryBrowser` component (`packages/frontend/src/components/DirectoryBrowser.tsx`) is a web-based folder picker used when creating new workspaces.

**Design Philosophy:**
- **Web-native**: Backend-driven browsing via API, not native OS dialogs
  - Web apps have browser security restrictions that prevent accessing absolute file paths via native `<input type="file">` dialogs
  - Backend has full filesystem access and can provide absolute paths reliably
  - Cross-platform consistent UX (Mac/Windows/Linux)
- **Lightweight**: Keeps parawork as a terminal-style tool (like Claude Code, Codex CLI)
  - No Electron or desktop app overhead
  - Just `pnpm dev` and access via browser
- **Git-aware**: Shows visual indicators for git repositories
  - Green GitBranch icon badge indicates a folder is a git repository
- **No branch names displayed** - not needed for worktree workflow (as workspaces are created from main)
  - Helps users quickly identify git projects without clutter

**Features:**
- **Cross-platform native interaction model**:
  - Single-click to select a folder (highlights it)
  - Double-click to navigate into a folder
  - Enter key navigates into selected folder
  - Matches macOS Finder, Windows Explorer, and Linux file manager behavior
- **Smart selection UI**:
  - Visual highlighting for selected folders (primary color border and background)
  - "Select This Folder" button is disabled (gray) when nothing selected
  - Button becomes enabled (bright blue) when a folder is selected
  - Footer displays selected folder path
- Grid and list view modes
- Search/filter directories
- Breadcrumb navigation
- Git repository visual indicators (icon badge only, no branch names)
- Backend-driven directory listing for reliable absolute paths

**Why not native Finder/Explorer?**
- Native OS dialogs require Electron (converts web app to desktop app)
- Browser security prevents web apps from getting absolute paths via `<input webkitdirectory>`
- Current approach keeps parawork lightweight and web-based

### 3-Panel Layout

Parawork uses a focus-first 3-panel layout:

**Left Panel: Repository Switcher**
- Shows list of registered git repositories
- Search/filter repositories
- Add new repositories via `+` button
- Click to filter workspaces by repository

**Center Panel: Workspace Switcher**
- Shows workspaces (optionally filtered by selected repository)
- Create new workspace via `+` button (creates git worktree from repository)
- Click to focus a workspace
- Right-click context menu for workspace actions

**Right Panel: Active Workspace**
- **Top section**: Agent terminal (read-only output from agent)
- **Bottom section**: User terminal (interactive shell using xterm.js + node-pty)
- Resizable splitter between agent and user terminals
- User can run commands while agent is working

This design ensures you focus on ONE workspace at a time while maintaining awareness of all repositories and workspaces.

### User Terminal vs Agent Terminal

**Agent Terminal** (`AgentTerminalPanel/`):
- Read-only display of agent output
- Shows what the AI agent (Claude Code, Codex, etc.) is doing
- Streamed via WebSocket as `agent_log` events
- Located in top section of right panel

**User Terminal** (`RightPanel/UserTerminal.tsx`):
- Interactive shell running in workspace directory
- Powered by node-pty (real PTY) + xterm.js (frontend)
- Allows user to run git, npm, build commands, etc.
- Separate from agent - user and agent can work simultaneously
- One persistent terminal per workspace (can reconnect)
- Located in bottom section of right panel
