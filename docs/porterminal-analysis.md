# Porterminal & Parawork: Technical Analysis & Integration Guide

> Comprehensive technical analysis based on porterminal codebase exploration (2026-01-04)

## Executive Summary

**Porterminal** is a web-based terminal application enabling remote access via mobile devices using Cloudflare Quick Tunnel. This document provides a deep technical analysis of porterminal's architecture and concrete recommendations for integrating its best practices into Parawork.

**Key Takeaway**: Porterminal and Parawork share the same core challenge—remote access to local services—but solve different problems. Porterminal's solutions for tunneling, session persistence, and mobile UX are highly transferable to Parawork.

---

## Table of Contents

1. [Porterminal Project Overview](#1-porterminal-project-overview)
2. [PTY (Pseudo-Terminal) Deep Dive](#2-pty-pseudo-terminal-deep-dive)
3. [Hexagonal Architecture Analysis](#3-hexagonal-architecture-analysis)
4. [Cloudflare Tunnel Integration](#4-cloudflare-tunnel-integration)
5. [Session Persistence Architecture](#5-session-persistence-architecture)
6. [WebSocket Communication Patterns](#6-websocket-communication-patterns)
7. [Parawork vs Porterminal Comparison](#7-parawork-vs-porterminal-comparison)
8. [Integration Recommendations for Parawork](#8-integration-recommendations-for-parawork)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Porterminal Project Overview

### Core Features

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Remote Access** | Cloudflare Quick Tunnel exposes service to internet | `infrastructure/cloudflared.py` |
| **Mobile-Friendly** | Touch UI with virtual keys and gestures | Frontend components |
| **Cross-Platform** | Windows (PowerShell/CMD/WSL), Linux/macOS (Bash/Zsh/Fish) | `pty/windows.py`, `pty/unix.py` |
| **Session Persistence** | Sessions survive disconnects, multi-device viewing | `SessionService` with reconnection logic |

### Quick Start Commands

```bash
uvx ptn                  # Run instantly (no install)
ptn                      # Start in current directory
ptn ~/projects/myapp     # Start in specific folder
ptn --no-tunnel          # Local network only
ptn -p                   # Enable password protection
ptn -b                   # Run in background
```

### Project Structure

```
porterminal/
├── porterminal/
│   ├── domain/          # Core business logic, entities, value objects
│   │   ├── entities/    # Session, Tab (with business logic)
│   │   ├── values/      # SessionId, UserId, TerminalDimensions
│   │   ├── ports/       # SessionRepository, PTYPort (interfaces)
│   │   └── services/    # SessionLimitChecker, EnvironmentSanitizer
│   ├── application/     # Use cases and application services
│   │   ├── services/    # TerminalService, SessionService
│   │   └── ports/       # ConnectionPort (WebSocket abstraction)
│   ├── infrastructure/  # External adapters and implementations
│   │   ├── cloudflared.py     # Tunnel installer & manager
│   │   ├── server.py          # Server lifecycle management
│   │   ├── web/               # FastAPI WebSocket adapter
│   │   └── repositories/      # In-memory session storage
│   ├── pty/             # Platform-specific PTY implementations
│   │   ├── unix.py      # Unix/Linux/macOS PTY
│   │   └── windows.py   # Windows ConPTY/WinPTY
│   └── cli/             # Command-line interface
└── frontend/            # TypeScript/Vite web application
```

---

## 2. PTY (Pseudo-Terminal) Deep Dive

### What is a PTY?

A **PTY (Pseudo-Terminal)** is a virtual device provided by the OS that allows programs to interact as if communicating with a physical terminal.

```
┌─────────────────────────────────────────────────────────────┐
│  Physical Terminal          vs          Pseudo-Terminal     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                    ┌──────────────────┐   │
│  │  Keyboard   │ ══════════════>    │  /dev/ptmx       │   │
│  │  Display    │  Direct Hardware   │  (Master)        │   │
│  └─────────────┘                    └──────────────────┘   │
│                                              ║              │
│                                              ║              │
│                                      ┌───────▼──────────┐   │
│                                      │  /dev/pts/N      │   │
│                                      │  (Slave)         │   │
│                                      └──────────────────┘   │
│                                              ║              │
│                                              ▼              │
│                                      ┌──────────────────┐   │
│                                      │  Shell Process   │   │
│                                      │  (bash/zsh)      │   │
│                                      └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Python PTY Example

```python
import pty
import os

# Fork a process with PTY
pid, fd = pty.fork()

if pid == 0:
    # Child process: execute shell
    os.execvp('bash', ['bash'])
else:
    # Parent process: communicate via fd
    os.write(fd, b"ls -la\n")
    output = os.read(fd, 4096)
    print(output.decode())
```

### Common PTY Use Cases

| Use Case | Examples | Why PTY? |
|----------|----------|----------|
| **Terminal Emulators** | xterm, iTerm2, GNOME Terminal | Provide virtual terminal to shell |
| **SSH Servers** | OpenSSH | Create interactive remote sessions |
| **Web Terminals** | **Porterminal**, Wetty, ttyd | Bridge browser ↔ shell interaction |
| **Script Automation** | expect, pexpect | Automate interactive CLI programs |

### pywinpty: Windows PTY Support

**Problem**: Windows doesn't have native Unix-style PTY (`/dev/ptmx`).

**Solution**: `pywinpty` provides ConPTY (modern) and WinPTY (legacy) support.

| Feature | ConPTY | WinPTY |
|---------|--------|--------|
| **Windows Version** | 10 1903+ (May 2019) | Windows 7+ |
| **Performance** | Native, fast | Slower (translation layer) |
| **Stability** | Better | Good |
| **Recommended** | ✅ Yes (if available) | Fallback only |

```python
from pywinpty import PTY

# Create PTY using ConPTY backend
pty = PTY(backend='conpty')
pty.spawn('cmd.exe')
pty.write('dir\n')
output = pty.read()
```

**Porterminal's Approach** (`pty/windows.py`):
- Auto-detects Windows version
- Tries ConPTY first, falls back to WinPTY
- Handles encoding issues (UTF-8 vs CP437)

---

## 3. Hexagonal Architecture Analysis

Porterminal uses **Hexagonal Architecture** (Ports & Adapters) for clean separation of concerns.

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Entities    │  │    Values     │  │   Services   │         │
│  │  - Session   │  │  - SessionId  │  │  - Limits    │         │
│  │  - Tab       │  │  - UserId     │  │  - Sanitizer │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌────────────────────── PORTS ──────────────────────┐         │
│  │  Interfaces (abstract, no implementation)         │         │
│  │  - SessionRepository[PTYHandle]                   │         │
│  │  - PTYPort (is_alive, write, read, resize)        │         │
│  │  - ConnectionPort (send/receive WebSocket msgs)   │         │
│  └────────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────┘
                              ║
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  ┌────────────────────────────────────────────────────┐        │
│  │  Use Cases (orchestrate domain logic)              │        │
│  │  - SessionService: create/reconnect/destroy        │        │
│  │  - TerminalService: handle input/output streaming  │        │
│  │  - TabService: manage multi-tab UI state           │        │
│  └────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────┘
                              ║
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Adapters    │  │  External    │  │  Platforms   │         │
│  │  - WebSocket │  │  - Cloudflare│  │  - UnixPTY   │         │
│  │  - FastAPI   │  │  - Auth      │  │  - WinPTY    │         │
│  │  - InMemory  │  │              │  │              │         │
│  │    Repo      │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────────────────────────────────────────┘
```

### Key Patterns

#### 1. Dependency Inversion

**Domain defines interfaces (ports), infrastructure implements them.**

```python
# Domain: Define the port (interface)
class PTYPort(ABC):
    @abstractmethod
    def is_alive(self) -> bool: ...

    @abstractmethod
    def write(self, data: bytes) -> int: ...

    @abstractmethod
    def read(self, size: int) -> bytes: ...

# Infrastructure: Implement the adapter
class UnixPTY(PTYPort):
    def __init__(self, shell: str, dimensions: TerminalDimensions):
        self.pid, self.fd = pty.fork()
        if self.pid == 0:
            os.execvp(shell, [shell])

    def is_alive(self) -> bool:
        try:
            os.waitpid(self.pid, os.WNOHANG)
            return True
        except ChildProcessError:
            return False

    def write(self, data: bytes) -> int:
        return os.write(self.fd, data)
```

#### 2. Repository Pattern

```python
# Domain: Repository interface
class SessionRepository[PTYHandle](ABC):
    @abstractmethod
    def add(self, session: Session[PTYHandle]) -> None: ...

    @abstractmethod
    def get(self, session_id: SessionId) -> Session[PTYHandle] | None: ...

    @abstractmethod
    def remove(self, session_id: SessionId) -> Session[PTYHandle] | None: ...

# Infrastructure: In-memory implementation
class InMemorySessionRepository(SessionRepository[PTYPort]):
    def __init__(self):
        self._sessions: dict[SessionId, Session[PTYPort]] = {}

    def add(self, session: Session[PTYPort]) -> None:
        self._sessions[session.id] = session
```

**Benefits for Parawork**:
- ✅ Easily swap SQLite for PostgreSQL (just implement `SessionRepository`)
- ✅ Test with mock repositories (no real database needed)
- ✅ Domain logic stays pure, infrastructure concerns isolated

---

## 4. Cloudflare Tunnel Integration

### Why Cloudflare Quick Tunnel?

| Feature | Cloudflare Tunnel | ngrok Free | Port Forwarding |
|---------|-------------------|------------|-----------------|
| **No Registration** | ✅ Yes | ❌ Requires account | ✅ Yes |
| **Automatic HTTPS** | ✅ Yes | ✅ Yes | ❌ Manual SSL |
| **Random URL** | ✅ Yes | ✅ Yes (limited) | ❌ Static IP |
| **Setup Complexity** | ⭐ One command | ⭐⭐ Install + auth | ⭐⭐⭐⭐ Router config |
| **Firewall Bypass** | ✅ Yes | ✅ Yes | ❌ No |

### Porterminal's Implementation

**File**: `infrastructure/cloudflared.py` (300 lines)

#### 1. Auto-Installation

```python
class CloudflaredInstaller:
    @staticmethod
    def install() -> bool:
        """Auto-install cloudflared on current platform."""
        if sys.platform == "win32":
            return CloudflaredInstaller._install_windows()
        elif sys.platform == "darwin":
            return CloudflaredInstaller._install_macos()
        elif sys.platform == "linux":
            return CloudflaredInstaller._install_linux()
```

**Windows Strategy** (with fallback chain):
1. Try `winget install Cloudflare.cloudflared` (preferred)
2. If winget fails → download from GitHub releases
3. Add to PATH for current session

**macOS Strategy**:
1. Try `brew install cloudflared` (if Homebrew available)
2. If brew fails → download `.tgz` from GitHub
3. Extract to `~/.local/bin` and make executable

**Linux Strategy**:
1. Try package manager (`apt`, `yum`, `dnf`)
2. For apt: Add Cloudflare repository with GPG key
3. If all fail → download binary from GitHub

#### 2. Tunnel Management

**File**: `infrastructure/server.py`

```python
def start_cloudflared(port: int) -> tuple[subprocess.Popen, str | None]:
    """Start cloudflared tunnel and return the URL."""
    cmd = [
        "cloudflared",
        "tunnel",
        "--no-autoupdate",
        "--protocol", "http2",  # HTTP/2 more reliable than QUIC
        "--config", os.devnull,  # Ignore config files
        "--url", f"http://127.0.0.1:{port}",
    ]

    # Clear environment to force quick tunnel mode
    env = os.environ.copy()
    env["TUNNEL_ORIGIN_CERT"] = ""
    env["NO_AUTOUPDATE"] = "true"
    env["TUNNEL_CONFIG"] = os.devnull

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )

    # Parse URL from output
    url_pattern = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
    for line in iter(process.stdout.readline, ""):
        match = url_pattern.search(line)
        if match:
            return process, match.group(0)

    return process, None
```

**Key Techniques**:
- **Use `os.devnull`** for cross-platform null device
- **HTTP/2 protocol** more stable than QUIC on Windows
- **Regex URL parsing** from cloudflared output
- **Environment variable override** to force quick tunnel mode

#### 3. QR Code Generation

Porterminal generates QR codes for easy mobile access:

```python
import qrcode

def generate_qr_code(url: str) -> None:
    qr = qrcode.QRCode()
    qr.add_data(url)
    qr.make()
    qr.print_ascii(invert=True)
```

**Display in Terminal**:
```
Scan this QR code with your phone:

█████████████████████████████████
██ ▄▄▄▄▄ █▀█ █▄▀▄▀▀▄█ ▄▄▄▄▄ ██
██ █   █ █▀▀▀█ ▀ █▀▀█ █   █ ██
██ █▄▄▄█ █▀ █▀▀▀▄ ▀▀█ █▄▄▄█ ██
...
```

---

## 5. Session Persistence Architecture

### Core Concept

**Sessions survive disconnects**—close browser, switch networks, even connect from a different device. Your shell and running processes remain alive.

```
┌────────────────────────────────────────────────────────────┐
│  Timeline: Session Lifecycle with Reconnection             │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  t=0    CREATE SESSION                                      │
│         └─> PTY spawned (bash)                              │
│         └─> Session stored in repository                    │
│         └─> Client count = 1                                │
│                                                              │
│  t=30   Client sends "vim myfile.txt"                       │
│         └─> PTY still active, vim running                   │
│                                                              │
│  t=60   DISCONNECT (browser closed)                         │
│         └─> Client count = 0                                │
│         └─> PTY remains alive!                              │
│         └─> vim still running in background                 │
│                                                              │
│  t=120  RECONNECT (scan QR on different device)             │
│         └─> Fetch session by ID                             │
│         └─> Check PTY is_alive() → true                     │
│         └─> Client count = 1                                │
│         └─> Replay buffered output to new client            │
│         └─> vim appears instantly!                          │
│                                                              │
│  t=600  CLEANUP (10min idle, no clients)                    │
│         └─> Destroy session                                 │
│         └─> Kill PTY process                                │
└────────────────────────────────────────────────────────────┘
```

### Implementation Details

**File**: `application/services/session_service.py`

#### Session Entity

```python
@dataclass
class Session[PTYHandle]:
    id: SessionId
    user_id: UserId
    shell_id: str
    dimensions: TerminalDimensions
    created_at: datetime
    last_activity: datetime
    pty_handle: PTYHandle
    _client_count: int = 0
    _output_buffer: bytearray = field(default_factory=bytearray)

    def add_client(self) -> int:
        """Add a client connection."""
        self._client_count += 1
        return self._client_count

    def remove_client(self) -> int:
        """Remove a client connection."""
        self._client_count = max(0, self._client_count - 1)
        return self._client_count

    def touch(self, timestamp: datetime) -> None:
        """Update last activity timestamp."""
        self.last_activity = timestamp
```

#### SessionService: Create & Reconnect

```python
class SessionService:
    async def create_session(
        self,
        user_id: UserId,
        shell: ShellCommand,
        dimensions: TerminalDimensions,
    ) -> Session[PTYPort]:
        """Create a new terminal session."""
        # Check limits
        limit_result = self._limit_checker.can_create_session(
            user_id,
            self._repository.count_for_user(user_id),
            self._repository.count(),
        )
        if not limit_result.allowed:
            raise ValueError(limit_result.reason)

        # Create PTY
        env = self._sanitizer.sanitize(dict(os.environ))
        pty = self._pty_factory(shell, dimensions, env, self._cwd)

        # Create session
        session = Session(
            id=SessionId(str(uuid.uuid4())),
            user_id=user_id,
            shell_id=shell.id,
            dimensions=dimensions,
            created_at=datetime.now(UTC),
            last_activity=datetime.now(UTC),
            pty_handle=pty,
        )

        self._repository.add(session)
        return session

    async def reconnect_session(
        self,
        session_id: SessionId,
        user_id: UserId,
    ) -> Session[PTYPort] | None:
        """Reconnect to existing session."""
        session = self._repository.get(session_id)
        if not session:
            return None

        # Check ownership
        limit_result = self._limit_checker.can_reconnect(session, user_id)
        if not limit_result.allowed:
            return None

        # Check if PTY still alive
        if not session.pty_handle.is_alive():
            await self.destroy_session(session_id)
            return None

        session.add_client()
        session.touch(datetime.now(UTC))
        return session
```

#### Cleanup Loop

```python
async def _cleanup_loop(self) -> None:
    """Background task to cleanup stale sessions."""
    while self._running:
        await asyncio.sleep(60)  # Every minute
        await self._cleanup_stale_sessions()

async def _cleanup_stale_sessions(self) -> None:
    """Check and cleanup stale sessions."""
    now = datetime.now(UTC)

    for session in self._repository.all_sessions():
        should_cleanup, reason = self._limit_checker.should_cleanup_session(
            session,
            now,
            session.pty_handle.is_alive(),
        )

        if should_cleanup:
            logger.info(f"Cleaning up session {session.id}: {reason}")
            await self.destroy_session(session.id)
```

**Cleanup Rules** (from `domain/services/session_limits.py`):
- PTY process died → immediate cleanup
- No clients + idle >10min → cleanup
- Absolute max age (24h) → cleanup

---

## 6. WebSocket Communication Patterns

### Adapter Pattern for WebSocket

**File**: `infrastructure/web/websocket_adapter.py`

```python
class FastAPIWebSocketAdapter(ConnectionPort):
    """Adapts FastAPI WebSocket to domain ConnectionPort."""

    def __init__(self, websocket: WebSocket):
        self._websocket = websocket
        self._closed = False

    async def send_output(self, data: bytes) -> None:
        """Send terminal output (binary)."""
        if not self._closed:
            await self._websocket.send_bytes(data)

    async def send_message(self, message: dict[str, Any]) -> None:
        """Send control message (JSON)."""
        if not self._closed:
            await self._websocket.send_json(message)

    async def receive(self) -> dict[str, Any] | bytes:
        """Receive from client (binary input or JSON control)."""
        message = await self._websocket.receive()

        if message.get("bytes"):
            return message["bytes"]  # User typed input
        elif message.get("text"):
            return json.loads(message["text"])  # Control message

        if message.get("type") == "websocket.disconnect":
            self._closed = True
            raise WebSocketDisconnect()
```

**Benefits**:
- Domain never imports FastAPI
- Easy to swap WebSocket library (Socket.IO, etc.)
- Testable with mock adapters

### Message Types

**Client → Server (Terminal Input)**:
```typescript
// Binary messages (keystrokes)
websocket.send(new TextEncoder().encode("ls -la\n"));
```

**Server → Client (Terminal Output)**:
```typescript
// Binary messages (shell output)
websocket.onmessage = (event) => {
  if (event.data instanceof Blob) {
    // Render to terminal emulator (xterm.js)
    terminal.write(event.data);
  }
};
```

**Control Messages (JSON)**:
```json
// Resize terminal
{"type": "resize", "cols": 80, "rows": 24}

// Keep-alive ping
{"type": "ping"}

// Session metadata
{"type": "session_info", "id": "abc123", "shell": "bash"}
```

---

## 7. Parawork vs Porterminal Comparison

### Feature Matrix

| Aspect | Porterminal | Parawork |
|--------|-------------|----------|
| **Purpose** | Web terminal access | AI agent orchestration |
| **Backend** | Python + FastAPI + asyncio | Node.js + Express + SQLite |
| **Frontend** | TypeScript + Vite | React + TypeScript + Vite |
| **Core Function** | Remote shell access | Manage/monitor AI agent sessions |
| **Remote Access** | ✅ Built-in (Cloudflare Tunnel + QR) | ❌ Needs manual setup |
| **Session Persistence** | ✅ Multi-device, survives disconnects | ⚠️ Basic (database-backed) |
| **Real-time Comm** | WebSocket (binary + JSON) | WebSocket (JSON only) |
| **Process Management** | PTY lifecycle | Child process monitoring |
| **Target User** | "Code from bed" | Parallel AI agent management |

### Architectural Comparison

```
┌─────────────────────────────────────────────────────────────┐
│                    Use Case Similarity                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Porterminal:  Mobile Browser → Cloudflare → Server → PTY  │
│                                     ↑                         │
│                              Automatic Tunnel                 │
│                                                               │
│  Parawork:     Browser → ??? → Server → Agent Processes      │
│                           ↑                                   │
│                    Need to Add This!                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Shared Challenges**:
1. ✅ Local service needs remote access
2. ✅ Real-time bidirectional communication (WebSocket)
3. ✅ Session/process lifecycle management
4. ✅ Multi-client viewing of same session

---

## 8. Integration Recommendations for Parawork

### High-Value Additions ⭐⭐⭐

#### 1. Cloudflare Tunnel Integration

**Files to Create**:
- `packages/backend/src/utils/cloudflared.ts` - Tunnel installer
- `packages/backend/src/utils/tunnel.ts` - Tunnel manager
- `packages/backend/src/utils/qrcode.ts` - QR code generator

**Implementation Steps**:

```typescript
// packages/backend/src/utils/cloudflared.ts
import { spawn } from 'child_process';
import which from 'which';

export class CloudflaredManager {
  static async isInstalled(): Promise<boolean> {
    try {
      await which('cloudflared');
      return true;
    } catch {
      return false;
    }
  }

  static async install(): Promise<boolean> {
    if (process.platform === 'darwin') {
      return this.installMacOS();
    } else if (process.platform === 'linux') {
      return this.installLinux();
    } else if (process.platform === 'win32') {
      return this.installWindows();
    }
    return false;
  }

  private static async installMacOS(): Promise<boolean> {
    // Try Homebrew first
    try {
      await which('brew');
      const proc = spawn('brew', ['install', 'cloudflared']);
      return await this.waitForProcess(proc);
    } catch {
      // Fallback: download binary
      return this.downloadBinary('darwin');
    }
  }
}
```

```typescript
// packages/backend/src/utils/tunnel.ts
export interface TunnelOptions {
  port: number;
  verbose?: boolean;
}

export class TunnelManager {
  private process: ChildProcess | null = null;
  private url: string | null = null;

  async start(options: TunnelOptions): Promise<string> {
    const proc = spawn('cloudflared', [
      'tunnel',
      '--no-autoupdate',
      '--protocol', 'http2',
      '--url', `http://127.0.0.1:${options.port}`,
    ], {
      env: {
        ...process.env,
        TUNNEL_ORIGIN_CERT: '',
        NO_AUTOUPDATE: 'true',
      },
    });

    this.process = proc;

    // Parse URL from output
    return new Promise((resolve, reject) => {
      proc.stdout?.on('data', (data) => {
        const output = data.toString();
        const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
          this.url = match[0];
          resolve(this.url);
        }
      });

      setTimeout(() => reject(new Error('Tunnel startup timeout')), 30000);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.url = null;
    }
  }
}
```

**Update `packages/backend/src/index.ts`**:

```typescript
import { TunnelManager } from './utils/tunnel';
import { CloudflaredManager } from './utils/cloudflared';
import { generateQRCode } from './utils/qrcode';

async function main() {
  const config = await loadConfig();

  // Initialize database
  await initDatabase();

  // Start server
  const server = app.listen(config.server.port, config.server.host);
  logger.info(`Server running on http://${config.server.host}:${config.server.port}`);

  // Start tunnel if enabled
  if (config.tunnel?.enabled) {
    if (!await CloudflaredManager.isInstalled()) {
      logger.info('cloudflared not found, installing...');
      await CloudflaredManager.install();
    }

    const tunnel = new TunnelManager();
    const url = await tunnel.start({ port: config.server.port });

    logger.info(`\nTunnel URL: ${url}`);
    console.log('\nScan QR code to access from mobile:\n');
    generateQRCode(url);
  }
}
```

**Add to `packages/backend/config.json`**:

```json
{
  "tunnel": {
    "enabled": true,
    "autoInstall": true
  }
}
```

#### 2. Enhanced Session Persistence

**Current**: Parawork stores sessions in SQLite but doesn't handle reconnection gracefully.

**Recommendation**: Implement reconnection logic inspired by porterminal.

```typescript
// packages/backend/src/api/routes/sessions.ts

// Add reconnect endpoint
router.post('/sessions/:id/reconnect', async (req, res) => {
  const { id } = req.params;
  const session = await db.getSession(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Check if process still alive
  const isAlive = await isProcessAlive(session.pid);
  if (!isAlive) {
    // Clean up dead session
    await db.updateSession(id, { status: 'failed' });
    return res.status(410).json({ error: 'Session process died' });
  }

  // Restore session
  await db.updateSession(id, {
    status: 'running',
    lastActivity: new Date(),
  });

  // Send buffered logs to client
  const logs = await db.getAgentLogs(id, { limit: 100 });

  res.json({ session, logs });
});
```

#### 3. Mobile-Optimized UI

**Add responsive design improvements**:

```typescript
// packages/frontend/src/components/WorkspaceView/MobileToolbar.tsx

export function MobileToolbar({ workspace }: { workspace: Workspace }) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (!isMobile) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-2 flex gap-2">
      <button onClick={() => sendCommand('Ctrl+C')}>
        ^C
      </button>
      <button onClick={() => sendCommand('Ctrl+Z')}>
        ^Z
      </button>
      <button onClick={() => toggleKeyboard()}>
        ⌨️
      </button>
    </div>
  );
}
```

#### 4. Password Protection

```typescript
// packages/backend/src/middleware/tunnel-auth.ts

export function tunnelAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = getConfig();

  // Only enforce on tunnel connections
  if (!req.headers['cf-connecting-ip']) {
    return next();
  }

  if (!config.tunnel?.requirePassword) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !validatePassword(authHeader)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
```

### Medium-Value Additions ⭐⭐

#### 5. Multi-Tab Session Management

Porterminal supports multiple terminal tabs within a session. Parawork could adopt this:

```typescript
// packages/shared/src/types.ts

export interface Workspace {
  id: string;
  name: string;
  path: string;
  tabs: WorkspaceTab[];  // New!
  focusedTabId: string;  // New!
}

export interface WorkspaceTab {
  id: string;
  sessionId: string;
  name: string;
  createdAt: Date;
}
```

#### 6. Output Buffering

Store recent output for reconnection:

```typescript
// packages/backend/src/agents/monitor.ts

class AgentProcess {
  private outputBuffer: Buffer[] = [];
  private readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

  private handleStdout(data: Buffer) {
    // Store in buffer
    this.outputBuffer.push(data);

    // Trim if exceeds limit
    const totalSize = this.outputBuffer.reduce((sum, buf) => sum + buf.length, 0);
    if (totalSize > this.MAX_BUFFER_SIZE) {
      this.outputBuffer = this.outputBuffer.slice(-50); // Keep last 50 chunks
    }

    // Broadcast to WebSocket
    this.broadcast({ type: 'agent_log', data: data.toString() });
  }

  getBufferedOutput(): string {
    return Buffer.concat(this.outputBuffer).toString();
  }
}
```

### Low-Value Additions ⭐

These are specific to terminal UX and not applicable to Parawork:
- ❌ PTY implementation (Parawork doesn't need this)
- ❌ Terminal emulator UI (xterm.js, etc.)
- ❌ Shell detection logic

---

## 9. Implementation Roadmap

### Phase 1: Core Tunnel Integration (Week 1-2)

**Priority**: 🔥 Critical for remote access

**Tasks**:
- [ ] Create `utils/cloudflared.ts` with installer
- [ ] Create `utils/tunnel.ts` with manager
- [ ] Add tunnel config to `config.json`
- [ ] Update `index.ts` to start tunnel on launch
- [ ] Add QR code generation utility
- [ ] Test on macOS, Linux, Windows

**Acceptance Criteria**:
- ✅ Run `pnpm dev` → tunnel starts automatically
- ✅ QR code displayed in terminal
- ✅ Mobile browser can access via tunnel URL
- ✅ Tunnel survives server restarts

### Phase 2: Enhanced Session Persistence (Week 3)

**Priority**: ⭐⭐ Important for reliability

**Tasks**:
- [ ] Add `/sessions/:id/reconnect` endpoint
- [ ] Implement process liveness check
- [ ] Add output buffering to `AgentProcess`
- [ ] Update WebSocket to send buffered logs on reconnect
- [ ] Add cleanup job for dead sessions

**Acceptance Criteria**:
- ✅ Close browser → reopen → session restored with history
- ✅ Dead agent processes auto-cleanup after 5min
- ✅ Last 1MB of output buffered per session

### Phase 3: Mobile UX Improvements (Week 4)

**Priority**: ⭐ Nice-to-have

**Tasks**:
- [ ] Add mobile toolbar with common actions
- [ ] Improve responsive layout for <768px screens
- [ ] Add touch-friendly buttons (Stop, Restart, etc.)
- [ ] Test on iOS Safari, Android Chrome

**Acceptance Criteria**:
- ✅ Usable on mobile without keyboard
- ✅ No horizontal scrolling on small screens
- ✅ Quick actions accessible via touch

### Phase 4: Security & Polish (Week 5)

**Priority**: ⭐⭐ Important for production

**Tasks**:
- [ ] Add password protection for tunnel connections
- [ ] Implement rate limiting on WebSocket
- [ ] Add session timeout config
- [ ] Add audit logging for sensitive actions

**Acceptance Criteria**:
- ✅ Password prompt on first tunnel access
- ✅ Configurable session timeout (default: 30min idle)
- ✅ No more than 100 WebSocket msgs/sec per client

---

## 10. Code Examples & Recipes

### Recipe 1: Add Tunnel Support in 10 Minutes

```bash
# 1. Install dependencies
cd packages/backend
pnpm add which qrcode-terminal

# 2. Create tunnel utility
cat > src/utils/tunnel.ts << 'EOF'
import { spawn, ChildProcess } from 'child_process';
import qrcode from 'qrcode-terminal';

export async function startTunnel(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', [
      'tunnel', '--url', `http://127.0.0.1:${port}`
    ]);

    proc.stdout?.on('data', (data) => {
      const match = data.toString().match(/https:\/\/[^\s]+/);
      if (match) {
        const url = match[0];
        console.log('\n🌐 Tunnel URL:', url);
        qrcode.generate(url, { small: true });
        resolve(url);
      }
    });

    setTimeout(() => reject(new Error('Timeout')), 30000);
  });
}
EOF

# 3. Update index.ts
# Add: await startTunnel(config.server.port);
```

### Recipe 2: Session Reconnection Logic

```typescript
// WebSocket handler
wsServer.on('connection', async (ws, req) => {
  const sessionId = new URL(req.url!, 'ws://localhost').searchParams.get('sessionId');

  if (sessionId) {
    // Reconnect to existing session
    const session = await db.getSession(sessionId);

    if (session && await isProcessAlive(session.pid)) {
      // Send buffered output
      const buffered = agentProcesses.get(sessionId)?.getBufferedOutput();
      if (buffered) {
        ws.send(JSON.stringify({ type: 'buffered_output', data: buffered }));
      }

      // Subscribe to new output
      ws.send(JSON.stringify({ type: 'reconnected', sessionId }));
      return;
    }
  }

  // Create new session
  // ...
});
```

---

## Conclusion

### Key Takeaways

1. **Porterminal's hexagonal architecture** provides excellent separation of concerns—Parawork can adopt this for better testability and maintainability.

2. **Cloudflare Tunnel integration** is straightforward and eliminates the need for ngrok, port forwarding, or manual SSL setup.

3. **Session persistence** is achieved through:
   - Decoupling session state from WebSocket connections
   - Keeping processes alive when clients disconnect
   - Buffering output for replay on reconnect

4. **Cross-platform consistency** requires careful handling of platform differences (especially Windows vs Unix).

### Immediate Action Items

**High Priority** (Do This Week):
- ✅ Add Cloudflare Tunnel support with auto-install
- ✅ Generate QR codes for mobile access
- ✅ Implement session reconnection endpoint

**Medium Priority** (Do This Month):
- ⭐ Add output buffering for session replay
- ⭐ Improve mobile responsive design
- ⭐ Add password protection option

**Low Priority** (Nice to Have):
- Multi-tab workspace support
- Custom action buttons (like porterminal's config)
- Background mode flag (`-b`)

### Resources

- **Porterminal GitHub**: https://github.com/lyehe/porterminal
- **Cloudflare Tunnel Docs**: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- **Python `pty` module**: https://docs.python.org/3/library/pty.html
- **pywinpty**: https://github.com/spyder-ide/pywinpty

---

*Document Version: 2.0 (2026-01-04)*
*Analysis based on porterminal commit: latest*
*Parawork Version: 0.1.0*
