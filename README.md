# Parawork

> **Parallel workspaces. Focused execution.**

An open-source TypeScript web orchestrator for AI coding agents (Claude Code, Codex, etc). Focus on one workspace at a time while many run in parallel in the background.

## Why Parawork?

AI coding agents are powerful but require constant monitoring. Parawork solves this with a **focus-first design**:

- ✅ **Run multiple agents in parallel** - Background execution
- ✅ **Focus on ONE workspace** - No distraction, deep work
- ✅ **Switch when needed** - Like browser tabs, not split screen
- ✅ **Open source & TypeScript** - Easy to contribute
- ✅ **Self-hosted** - Run on your machine

**NOT a Kanban board** - We don't show all tasks simultaneously. You focus on ONE workspace at a time.

## Features

### Core Features
- **Workspace-centric design** - Each workspace is a focus unit (like a browser tab)
- **Real-time updates** - WebSocket-powered live logs and status updates
- **Chat interface** - Communicate with agents directly
- **File change tracking** - See what files agents modify
- **Multi-agent support** - Works with Claude Code, Codex, and more

### Architecture
- **Backend**: Node.js + TypeScript + Express + SQLite
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **WebSocket**: Real-time bidirectional communication
- **Monorepo**: pnpm workspaces for easy development

## Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- pnpm 8+ (`npm install -g pnpm`)
- Claude Code or Codex CLI installed

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/parawork.git
cd parawork

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the backend (in one terminal)
cd packages/backend
pnpm dev

# Start the frontend (in another terminal)
cd packages/frontend
pnpm dev
```

The backend will start on `http://localhost:3000` and the frontend on `http://localhost:5173`.

### Configuration

On first run, a `config.json` file will be created in the backend directory. You can customize:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "agents": {
    "claude-code": {
      "enabled": true,
      "command": "claude",
      "defaultArgs": ["code"]
    },
    "codex": {
      "enabled": true,
      "command": "codex",
      "defaultArgs": []
    }
  }
}
```

## Usage

1. **Create a workspace** - Click the `+` button in the sidebar
2. **Name your workspace** - Give it a descriptive name (e.g., "auth-feature")
3. **Set project path** - Point to your project directory
4. **Choose agent** - Select Claude Code or Codex
5. **Start session** - Click "Start" to begin
6. **Focus and work** - Switch between workspaces as needed

Multiple agents can run simultaneously in the background while you focus on one workspace.

## Project Structure

```
parawork/
├── packages/
│   ├── backend/          # Node.js + TypeScript server
│   │   ├── src/
│   │   │   ├── api/      # REST API & WebSocket
│   │   │   ├── db/       # SQLite database
│   │   │   ├── agents/   # Agent monitoring
│   │   │   └── config/   # Configuration
│   │   └── package.json
│   ├── frontend/         # React + TypeScript web UI
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── stores/
│   │   └── package.json
│   └── shared/           # Shared types between backend/frontend
│       ├── src/
│       │   ├── types.ts
│       │   └── schemas.ts
│       └── package.json
├── docs/
├── package.json
└── pnpm-workspace.yaml
```

## API Documentation

### REST API Endpoints

#### Workspaces
- `GET /api/workspaces` - List all workspaces
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces/:id` - Get workspace details
- `PATCH /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace

#### Sessions
- `POST /api/workspaces/:id/sessions` - Start new session
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/:id/stop` - Stop running session
- `GET /api/sessions/:id/logs` - Get session logs
- `GET /api/sessions/:id/messages` - Get chat messages
- `POST /api/sessions/:id/messages` - Send message to agent
- `GET /api/sessions/:id/changes` - Get file changes

#### System
- `GET /api/health` - Health check
- `GET /api/agents` - List available agents
- `GET /api/config` - Get configuration

### WebSocket Events

#### Server → Client
- `workspace_status_changed` - Workspace status update
- `agent_log` - Real-time agent log
- `agent_message` - Agent chat message
- `file_changed` - File modification notification
- `session_completed` - Session completion event

#### Client → Server
- `focus_workspace` - User focused on workspace
- `subscribe_workspace` - Subscribe to workspace updates
- `unsubscribe_workspace` - Unsubscribe from workspace

## Development

### Run in Development Mode

```bash
# Root directory - run all in parallel
pnpm dev

# Or individually:
cd packages/backend && pnpm dev
cd packages/frontend && pnpm dev
```

### Build for Production

```bash
# Build all packages
pnpm build

# Start production backend
cd packages/backend && pnpm start

# Serve production frontend (use a static file server)
cd packages/frontend && pnpm preview
```

### Type Checking

```bash
# Check types across all packages
pnpm typecheck
```

### Clean Build Artifacts

```bash
pnpm clean
```

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./docs/contributing.md) for guidelines.

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/parawork.git`
3. Create a branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Run tests and type checking
6. Submit a pull request

## Roadmap

### MVP (Current)
- ✅ Workspace management
- ✅ Real-time WebSocket updates
- ✅ Chat interface with agents
- ✅ File change tracking
- ✅ Agent log streaming

### Planned Features
- [ ] Advanced agent monitoring and metrics
- [ ] Git integration (auto-commit, branch management)
- [ ] Enhanced diff viewer with syntax highlighting
- [ ] Plugin system for custom agents
- [ ] Multi-user support (team features)
- [ ] Cloud deployment option

## License

MIT License - see [LICENSE](./LICENSE) for details

## Community

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Questions and community chat
- **Twitter**: [@paraworkHQ](https://x.com/paraworkHQ)

## Acknowledgments

Inspired by:
- [Conductor](https://www.conductor.build/) - Focus-first workspace design
- [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) - Agent orchestration
- Claude Code, Codex, and other AI coding agents

---

**Built with ❤️ by developers, for developers.**

*Parawork: Parallel workspaces. Focused execution.*
