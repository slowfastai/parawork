# 前端终端集成方案

## 需求背景

Parawork 需要在前端页面嵌入交互式终端，以支持 Claude Code 等 AI Agent 的交互式使用。

**当前问题**:
- Agent 进程需要 TTY (伪终端) 才能以交互模式运行
- 直接使用 `child_process.spawn` 缺少 TTY，进程会立即退出
- `node-pty` 原生模块在某些环境编译困难

## 方案对比

### 方案 A: xterm.js + node-pty + WebSocket (推荐)

| 维度 | 详情 |
|------|------|
| **前端** | xterm.js - 业界标准的 Web 终端库 |
| **后端** | node-pty - 提供完整的 PTY 支持 |
| **通信** | WebSocket - 实时双向数据传输 |
| **复杂度** | 中等 |

**优点**:
- 完全自控，可定制性强
- xterm.js 功能丰富（复制粘贴、主题、全屏等）
- 与现有 WebSocket 架构兼容

**缺点**:
- node-pty 需要原生编译（macOS ARM 可能需要额外处理）
- 需要处理 resize 事件

---

### 方案 B: ttyd

| 维度 | 详情 |
|------|------|
| **前端** | 使用 ttyd 提供的 Web UI 或 iframe 嵌入 |
| **后端** | ttyd 独立进程管理 PTY |
| **通信** | HTTP/WebSocket (ttyd 内置) |
| **复杂度** | 低 |

**优点**:
- 开箱即用，无需自己处理 PTY
- 成熟稳定，被 many CLI 工具使用

**缺点**:
- 需要单独部署 ttyd 服务
- 嵌入前端灵活性较低（iframe 样式难统一）
- 增加基础设施复杂度

---

### 方案 C: wetty

| 维度 | 详情 |
|------|------|
| **前端** | wetty 内置前端 |
| **后端** | Node.js + node-pty |
| **通信** | HTTP/WebSocket |
| **复杂度** | 中等 |

**优点**:
- 完整的终端解决方案
- 支持 SSH 和 HTTP 两种模式

**缺点**:
- 需要单独运行 wetty 服务
- 样式定制受限于 wetty 本身

---

### 方案对比总结

| 特性 | 方案 A (xterm.js) | 方案 B (ttyd) | 方案 C (wetty) |
|------|-------------------|---------------|----------------|
| 自控程度 | 高 | 低 | 中 |
| 集成复杂度 | 中 | 低 | 中 |
| 前端定制 | 灵活 | 困难 | 受限 |
| 额外依赖 | node-pty | ttyd 二进制 | wetty |
| 实时性 | ✅ 优秀 | ✅ 优秀 | ✅ 优秀 |

## 推荐方案: 方案 A

**理由**:
1. **完全自控** - 可以深度集成到 Parawork UI 中
2. **技术栈一致** - 全部使用 Node.js
3. **可扩展性强** - 未来可添加自定义功能（命令提示、自动补全等）
4. **社区活跃** - xterm.js 和 node-pty 都是成熟库

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Browser)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    xterm.js                             ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────────┐ ││
│  │  │ Terminal │◄─┤ Fit     │◄─┤ WebSocket (Binary)     │ ││
│  │  │ View     │  │ Adapter │  │ - keystrokes → backend │ ││
│  │  └─────────┘  └─────────┘  │ - output ← backend     │ ││
│  │                           └─────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Node.js)                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    server.ts                            ││
│  │  ┌───────────────┐  ┌─────────────────────────────────┐ ││
│  │  │ WebSocket     │◄─┤ PTY Manager                     │ ││
│  │  │ Handler       │  │  - spawn PTY with node-pty      │ ││
│  │  └───────────────┘  │  - forward: stdin → PTY         │ ││
│  │                     │  - forward: PTY → WebSocket      │ ││
│  │                     │  - handle resize events         │ ││
│  │                     └─────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 前端集成: xterm.js

```bash
# 安装依赖
pnpm add xterm xterm-addon-fit
```

```tsx
// 前端组件示例
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

class TerminalComponent {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private ws: WebSocket;

  constructor(container: HTMLElement, wsUrl: string) {
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(container);
    this.fitAddon.fit();

    // WebSocket 连接
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (event) => {
      this.terminal.write(event.data);
    };

    // 发送按键到后端
    this.terminal.onData((data) => {
      this.ws.send(JSON.stringify({ type: 'input', data }));
    });

    // 处理 resize
    window.addEventListener('resize', () => this.fitAddon.fit());
  }
}
```

## 后端集成: node-pty

```typescript
// agent-session.ts
import * as pty from 'node-pty';
import { WebSocket } from 'ws';

interface PtySession {
  id: string;
  process: IPty;
  ws: WebSocket;
}

class PtyManager {
  private sessions = new Map<string, PtySession>();

  createSession(ws: WebSocket, command: string, args: string[], cwd: string) {
    const sessionId = crypto.randomUUID();

    const ptyProcess = pty.spawn(command, args, {
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
      cols: 80,
      rows: 24,
    });

    this.sessions.set(sessionId, { id: sessionId, process: ptyProcess, ws });

    // PTY 输出 → WebSocket
    ptyProcess.onData((data) => {
      ws.send(JSON.stringify({ type: 'output', data }));
    });

    // WebSocket → PTY 输入
    ws.on('message', (message) => {
      const { type, data } = JSON.parse(message.toString());
      if (type === 'input') {
        ptyProcess.write(data);
      } else if (type === 'resize') {
        ptyProcess.resize(data.cols, data.rows);
      }
    });

    return sessionId;
  }
}
```

## 依赖处理

### macOS ARM (Apple Silicon) 编译问题

node-pty 在 Apple Silicon 上可能需要特殊处理：

```bash
# 方案 1: 使用 Rosetta 运行
arch -x86_64 pnpm install

# 方案 2: 确保 Xcode 命令行工具已安装
xcode-select --install

# 方案 3: 使用 prebuild 预编译二进制
npm install @node-pty/prebuild -g
npx @node-pty/prebuild -t 0.12.3 --download
```

### 备选方案: 使用 `xterm-for-react` 或 `@xterm/xterm-react`

如果项目使用 React，可以考虑使用 React 封装库简化集成。

## 实施步骤

### Phase 1: 基础设施
- [ ] 安装 xterm.js 依赖
- [ ] 创建 Terminal 组件
- [ ] 实现 WebSocket 终端隧道

### Phase 2: 核心集成
- [ ] 修复 node-pty 编译问题
- [ ] 实现 PtyManager 类
- [ ] 集成到现有 agent 启动流程

### Phase 3: 用户体验
- [ ] 添加主题支持
- [ ] 实现 copy/paste
- [ ] 添加命令历史（可选）

### Phase 4: 优化
- [ ] 处理窗口 resize
- [ ] 添加终端快照/恢复（可选）
- [ ] 性能优化

## 风险与缓解

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| node-pty 编译失败 | 中 | 准备 Rosetta 方案，预编译二进制 |
| WebSocket 二进制传输 | 低 | 使用 base64 或直接 Buffer 传输 |
| 终端性能 | 低 | xterm.js 已优化，仅需注意大输出 |
| 安全性 | 中 | 验证命令白名单，隔离 workspace |

## 相关资源

- **xterm.js**: https://xtermjs.org/
- **xterm-addon-fit**: https://www.npmjs.com/package/xterm-addon-fit
- **node-pty**: https://www.npmjs.com/package/node-pty
- **ttyd**: https://github.com/tsl0922/ttyd
- **wetty**: https://github.com/butlerx/wetty
