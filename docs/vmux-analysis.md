# vmux Analysis & Parawork Improvement Ideas

**Date**: 2026-01-02
**Purpose**: Research on vmux and potential feature ideas for parawork

---

## Table of Contents

1. [What is vmux?](#what-is-vmux)
2. [vmux vs tmux Comparison](#vmux-vs-tmux-comparison)
3. [Cloudflare Containers: Pricing & Limitations](#cloudflare-containers-pricing--limitations)
4. [What Parawork Can Learn from vmux](#what-parawork-can-learn-from-vmux)
5. [Recommended Implementation Roadmap](#recommended-implementation-roadmap)

---

## What is vmux?

**vmux** is a cloud code execution platform that enables running code in remote containers with persistent access.

### Core Concept
- "Run anything in the cloud" with code bundling and containerization
- Attach/detach from running sessions (like tmux, but cloud-based)
- Detached execution allowing jobs to continue after closing your local machine

### Key Features

- **Auto-bundling**: Automatically detects dependencies and bundles only necessary code
- **Port exposure**: Get preview URLs for web apps, with WebSocket support
- **Fast performance**: ~4 second cold starts, ~500ms detached starts
- **Pre-configured environment**: Comes with PyTorch, transformers, FastAPI pre-installed
- **CLI-based management**: Manage containers with commands like `vmux ps`, `vmux logs`, `vmux attach`

### Technical Specifications

**Resources per job:**
- 0.25 vCPU
- 1GB RAM
- 2GB ephemeral storage
- Max 7-day runtime
- Runs on Cloudflare's container infrastructure

**Status**: Currently in beta (free during holidays, $2/month planned pricing)

**Target use case**: Development workflows and prototyping, not production deployments

---

## vmux vs tmux Comparison

### Where Code Runs

- **tmux**: Runs locally on your machine (or a server you SSH into)
- **vmux**: Runs in cloud containers managed by Cloudflare

### Persistence Model

- **tmux**: Sessions persist on that specific machine - requires SSH access to reconnect
- **vmux**: Sessions persist in the cloud - access from anywhere with just the CLI

### Resource Source

- **tmux**: Uses your local CPU/RAM/disk (unlimited by design)
- **vmux**: Uses cloud resources (0.25 vCPU, 1GB RAM per job)

### Primary Use Cases

- **tmux**: Managing multiple terminal sessions on one machine, keeping processes alive during SSH disconnects
- **vmux**: Running code without local infrastructure, offloading compute to the cloud, sharing environments

### Setup & Dependencies

- **tmux**: Just window/session management - you handle all dependencies
- **vmux**: Auto-detects dependencies, bundles code, pre-installs common packages

### Similarity

Both let you **detach and reattach** to running sessions. The name "vmux" is a play on "virtual tmux" - same workflow, different execution environment.

### Summary

- **tmux** = Terminal multiplexer for local/SSH sessions
- **vmux** = Cloud code runner with tmux-like attach/detach UX

---

## Cloudflare Containers: Pricing & Limitations

### Pricing Structure

**Base Plan**: $5/month (Workers Paid plan)

**Included monthly usage:**
- 25 GiB-hours of memory
- 375 vCPU-minutes
- 200 GB-hours of disk
- 1 TB egress (North America/Europe)

**Pay-per-use rates (beyond included usage):**
- **Memory**: $0.0000025 per GiB-second
- **CPU**: $0.000020 per vCPU-second
- **Disk**: $0.00000007 per GB-second
- **Egress**: $0.025-0.050 per GB (region-dependent)

**Instance types (in beta):**
- Dev: 256 MiB RAM
- Basic: 1 GiB RAM
- Standard: 4 GiB RAM, 0.5 vCPU

### Limitations & Cons vs tmux

#### 1. Resource Limits
- **Cloudflare**: Max 4 GiB RAM, 0.5 vCPU per instance, 40 GiB total memory per account
- **tmux**: Uses your full machine resources (no artificial limits)

#### 2. Runtime Constraints
- **Cloudflare**: Host can restart anytime (15 min SIGTERM warning), ephemeral disk (data lost on sleep)
- **tmux**: Runs until machine reboots, persistent local filesystem

#### 3. Cold Starts
- **Cloudflare**: 2-3 second cold starts when containers wake
- **tmux**: Instant - sessions already running locally

#### 4. Cost
- **Cloudflare**: $5/month minimum + usage fees
- **tmux**: Free (just uses your existing hardware)

#### 5. Architecture Lock-in
- **Cloudflare**: Linux/amd64 only
- **tmux**: Runs on any OS/architecture your machine supports

#### 6. Beta Limitations
- **Cloudflare**: Still in beta, limits may change, 40 vCPU account limit
- **tmux**: Mature, stable tool (released 2007)

#### 7. Data Persistence
- **Cloudflare**: Ephemeral disk - all data lost when container sleeps/restarts
- **tmux**: Full persistent local storage

### When to Use Each

**Use Cloudflare/vmux when:**
- You need cloud compute without managing servers
- Running from low-power devices (Chromebook, tablet)
- Want to access from multiple locations
- Don't need heavy resources (< 4 GiB RAM)

**Use tmux when:**
- You have a server/VPS already
- Need more resources or persistent storage
- Want zero recurring costs
- Need full control over environment
- Running resource-intensive workloads

### References

- [Cloudflare Containers Pricing](https://developers.cloudflare.com/containers/pricing/)
- [Cloudflare Containers Limits and Instance Types](https://developers.cloudflare.com/containers/platform-details/limits/)
- [Cloudflare Containers Public Beta Announcement](https://blog.cloudflare.com/containers-are-available-in-public-beta-for-simple-global-and-programmable/)
- [Workers & Pages Pricing](https://www.cloudflare.com/plans/developer-platform-pricing/)

---

## What Parawork Can Learn from vmux

### 1. Port Exposure & Preview URLs ⭐ **HIGH VALUE**

**vmux approach**: Automatically exposes container ports and provides preview URLs for web apps

**Parawork opportunity:**
- When agents run dev servers (Next.js, Vite, Flask, etc.), auto-detect exposed ports
- Provide clickable preview URLs in the workspace UI
- Show real-time port status (which ports are active)
- Enable WebSocket tunneling for hot-reload to work across network

**Why it matters**: Agents often build web apps - making them instantly accessible improves UX

**Implementation considerations:**
- Parse agent logs for common patterns: "Server running on http://localhost:3000"
- Use port scanning to detect newly opened ports
- Add WebSocket event type: `port_opened` with URL
- Add UI component in workspace view showing active ports as clickable badges

---

### 2. Dependency Auto-Detection ⭐ **MEDIUM VALUE**

**vmux approach**: Analyzes code with AST parsing to detect imports and bundle dependencies

**Parawork opportunity:**
- Before starting an agent session, scan for `package.json`, `requirements.txt`, `go.mod`, etc.
- Show dependency status in UI ("Dependencies installed ✓" or "Run `pnpm install` first")
- Optional: Auto-run installation commands before agent starts
- Warn if critical tools are missing (git, node, python)

**Why it matters**: Prevents agents from failing due to missing dependencies

**Implementation considerations:**
- Add pre-flight checks before spawning agent process
- Scan workspace directory for dependency manifests
- Check for lock files to verify installation
- Add configuration option: `autoInstallDependencies` (default: false)
- Display dependency status in workspace card badges

---

### 3. Resource Monitoring & Limits ⭐ **MEDIUM VALUE**

**vmux approach**: Clear resource limits (0.25 vCPU, 1GB RAM, 2GB disk)

**Parawork opportunity:**
- Show real-time CPU/RAM usage per agent process
- Add configurable resource limits in `config.json` (max memory, CPU %, timeout)
- Kill runaway processes automatically
- Display resource usage in workspace cards

**Why it matters**: Prevents one agent from hogging all system resources

**Implementation considerations:**
- Use Node.js `process.cpuUsage()` and `process.memoryUsage()` for monitoring
- Poll every 5-10 seconds, broadcast via WebSocket
- Add `resourceLimits` section to config:
  ```json
  {
    "resourceLimits": {
      "maxMemoryMB": 2048,
      "maxCpuPercent": 80,
      "maxRuntimeMinutes": 120
    }
  }
  ```
- Add database fields: `peak_memory_mb`, `peak_cpu_percent` to sessions table
- Show resource graphs in workspace detail view

---

### 4. Multi-Machine Access ⭐ **LOWER PRIORITY** (Big Lift)

**vmux approach**: Access sessions from anywhere via cloud infrastructure

**Parawork opportunity:**
- Currently local-only. Could add:
  - Remote backend mode (parawork server on VPS, access from anywhere)
  - WebSocket authentication for multi-user access
  - Session persistence across local restarts

**Why it matters**: Work from laptop, continue on desktop. But adds significant complexity.

**Implementation considerations:**
- Would require complete architecture refactoring
- Security concerns: exposing workspaces over internet
- Session state synchronization challenges
- May conflict with local-first design philosophy
- **Recommendation**: Defer unless strong user demand

---

### 5. Fast Startup Optimization ⭐ **MEDIUM VALUE**

**vmux approach**: ~4s cold starts, ~500ms detached starts

**Parawork opportunity:**
- Profile agent startup time (measure time from spawn to first output)
- Display startup time in UI/logs
- Optimize workspace initialization (parallel git operations, lazy-load UI)
- Keep agent processes warm (pre-spawn idle agents)

**Why it matters**: Faster iteration = better developer experience

**Implementation considerations:**
- Add timing metrics to session lifecycle
- Log `session_start_time`, `first_output_time`, `ready_time`
- Optimize git worktree creation (currently synchronous)
- Consider agent pooling for instant starts
- Display startup metrics in session logs: "Agent ready in 2.3s"

---

### 6. Better CLI Integration ⭐ **LOW VALUE** (Already Web-First)

**vmux approach**: Pure CLI tool (`vmux ps`, `vmux attach`, `vmux logs`)

**Parawork**: Already has web UI, but could add:
- Optional CLI for power users: `parawork start <workspace>`, `parawork logs <id>`
- Would complement the web UI for automation/scripting

**Why it matters**: Some users prefer CLI for speed and scriptability

**Implementation considerations:**
- Create `packages/cli` package
- Use existing backend API endpoints
- Commands: `create`, `start`, `stop`, `logs`, `list`, `delete`
- Would need to handle WebSocket connections for real-time logs
- **Recommendation**: Low priority - web UI is core value prop

---

## Recommended Implementation Roadmap

### Phase 1: Quick Wins 🚀

**Target**: High impact, moderate effort

1. **Port Exposure & Preview URLs** (Estimated: 2-3 days)
   - Add port detection to agent monitor
   - Create `port_opened` WebSocket event
   - Add UI component for clickable port badges
   - Test with Next.js, Vite, Flask dev servers

2. **Resource Monitoring** (Estimated: 1-2 days)
   - Add CPU/RAM tracking to agent processes
   - Broadcast metrics via WebSocket
   - Display in workspace UI
   - Store peak usage in database

### Phase 2: Quality of Life ⚙️

**Target**: Prevent common failures

3. **Dependency Detection** (Estimated: 2-3 days)
   - Add pre-flight dependency scanner
   - Detect `package.json`, `requirements.txt`, etc.
   - Show status in workspace cards
   - Optional auto-install configuration

4. **Startup Time Tracking** (Estimated: 1 day)
   - Measure agent startup metrics
   - Display in logs and UI
   - Identify optimization opportunities

### Phase 3: Advanced Features 🔧

**Target**: Consider if user demand exists

5. **Resource Limits** (Estimated: 2-3 days)
   - Add configurable max memory/CPU
   - Automatic process termination on limits
   - User warnings before killing processes

6. **Multi-Machine Access** (Estimated: 2+ weeks)
   - Remote backend mode
   - Enhanced authentication
   - Session persistence layer
   - **Note**: Only if strong user demand

---

## Key Architectural Principle to Preserve

### vmux vs parawork Philosophy

**vmux** = Cloud-first, disposable containers, pay-per-use
**parawork** = Local-first, persistent workspaces, free

### Don't Make Parawork Cloud-Native

The **local execution model is a core strength**:
- ✅ No recurring costs
- ✅ Full resource access
- ✅ Works offline
- ✅ No data leaves your machine
- ✅ No vendor lock-in

### Instead: Borrow UX Patterns

Adopt vmux's **user experience patterns** while keeping parawork local:
- Port exposure for instant web app access
- Dependency detection for smoother starts
- Resource monitoring for system health
- Fast startup optimizations

Keep the local-first architecture, enhance the developer experience.

---

## Conclusion

vmux demonstrates that **cloud-based agent execution with attach/detach UX** is viable and valuable. However, parawork's **local-first approach** is a differentiator that should be preserved.

**Best path forward**: Adopt vmux's UX innovations (port exposure, dependency detection, resource monitoring) while maintaining parawork's free, local, and privacy-preserving architecture.

**Recommended first feature**: Port exposure & preview URLs - highest impact on daily workflow with reasonable implementation effort.

---

**Document prepared**: 2026-01-02
**Research source**: https://vmux.sdan.io/
**For project**: Parawork (https://github.com/slowfastai/parawork)
