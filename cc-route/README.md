# cc-route

> **A decoupled multi-provider model routing wrapper for Claude Code.**
>
> Zero code injection. Zero binary patches. Zero forks.
> Survives every Claude Code update automatically.

---

## Architecture: Wrapper + Skill + Command

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code (official closed-source binary, UNMODIFIED)    │
│  ┌─────────────────┐    ┌────────────────────────────────┐ │
│  │ Skill (routing) │    │ Command (/mmodel)              │ │
│  │ Always active   │    │ On-demand DSL trigger          │ │
│  └─────────────────┘    └────────────────────────────────┘ │
│                         ┌────────────────────────────────┐ │
│                         │ ANTHROPIC_BASE_URL → Proxy     │ │
│                         └────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │Anthropic│ │ MiniMax │ │  GLM    │
        │   API   │ │   API   │ │  API    │
        └─────────┘ └─────────┘ └─────────┘
```

### Three Layers

| Layer | Component | What It Does |
|-------|-----------|-------------|
| **Wrapper** | `cc-route proxy` | HTTP interceptor. Reads `model` from request body, routes to correct provider. |
| **Skill** | `skills/cc-route-routing/SKILL.md` | Injected into Claude's system context. Teaches Claude about aliases and when to spawn multi-model agents. |
| **Command** | `commands/mmodel.md` | Slash command `/mmodel`. Parses DSL (`alias:role`) into deterministic Agent tool calls. |

---

## Quick Start

### 1. Install the Proxy

**Option A: npm (Node.js required)**
```bash
git clone https://github.com/3873225350/cc-route.git
cd cc-route
npm run install:proxy
npm run build
npm link        # or: npm install -g
```

**Option B: Pre-built binary (no Node.js required)**
```bash
# Download from GitHub Releases
curl -L -o cc-route-proxy https://github.com/3873225350/cc-route/releases/latest/download/cc-route-proxy-linux-x64
chmod +x cc-route-proxy
sudo mv cc-route-proxy /usr/local/bin/
```

**Option C: Docker**
```bash
docker run -p 3456:3456 \
  -v ~/.claude/settings.cc-route.json:/app/config.json:ro \
  -e CC_ROUTE_CONFIG=/app/config.json \
  ghcr.io/3873225350/cc-route-proxy:latest
```

### 2. Configure Routes

Create `~/.claude/settings.cc-route.json`:

```json
{
  "modelRoutes": {
    "MiniMax-M2.5": {
      "alias": "mm25",
      "baseURL": "https://api.minimaxi.com/anthropic",
      "authToken": "sk-your-minimax-key"
    },
    "glm-5": {
      "alias": "g5",
      "baseURL": "https://mydamoxing.cn",
      "authToken": "sk-your-glm-key"
    },
    "deepseek-v4-flash": {
      "alias": "d4f",
      "baseURL": "https://api.deepseek.com/anthropic",
      "authToken": "sk-your-deepseek-key"
    }
  }
}
```

**Preset shorthand** (no need to remember URLs):
```json
{
  "modelRoutes": {
    "gpt-4o": {
      "alias": "gpt4",
      "preset": "openrouter",
      "authToken": "sk-or-v1-..."
    },
    "deepseek-v3": {
      "alias": "ds3",
      "preset": "siliconflow",
      "authToken": "sk-sf-..."
    }
  }
}
```

### 3. Install the Plugin

```bash
cd cc-route
npm run install:plugin
# Or manually:
# ln -s $(pwd)/plugin ~/.claude/plugins/cc-route
```

Then **restart Claude Code** to load the plugin.

### 4. Launch via Wrapper

**Option A: `clauder` command (recommended)**

`clauder` is a drop-in replacement for `claude` that auto-manages the proxy:

```bash
# Install globally
npm install -g cc-route-proxy

# Use exactly like claude — all arguments pass through
clauder                          # Interactive mode
clauder "refactor this code"     # One-shot query
clauder config set theme dark    # Claude config commands
clauder --help                   # Claude help (proxy auto-starts)
```

`clauder` automatically:
1. Starts cc-route proxy (if not already running)
2. Sets `ANTHROPIC_BASE_URL`
3. Launches `claude` with all your arguments
4. Stops proxy on exit (only if it started it)

**Option B: `cc-route` wrapper script**

```bash
cc-route launch
# or manually:
export ANTHROPIC_BASE_URL=http://localhost:3456
export ANTHROPIC_API_KEY=cc-route-dummy-key
cc-route proxy &
claude
```

---

## Usage

### Switch Model

```
/model mm25          # Switch to MiniMax-M2.5
/model g5            # Switch to GLM-5
/model d4f           # Switch to DeepSeek v4 Flash
/model claude-sonnet-4-6  # Back to Anthropic (through proxy)
```

> **Note:** Custom aliases (`mm25`, `g5`, `d4f`) do **not** appear in Claude Code's `/model` picker UI. Type them directly.

### Natural Language (Skill-driven)

Just talk to Claude:

> "用 mm25 写核心算法，g5 写单元测试，d4f 审查代码质量"

Claude recognizes the aliases from the Skill context and spawns parallel agents automatically.

### Structured DSL (Command-driven)

For precise control:

```
/mmodel mm25:实现核心算法 g5:写单元测试 d4f:代码审查 --readonly=d4f
```

### Check Usage Dashboard

```bash
curl http://localhost:3456/v1/admin/usage
```

Response:
```json
{
  "summary": { "totalInput": 5000, "totalOutput": 12000, "totalRequests": 42 },
  "details": [
    { "provider": "https://api.deepseek.com/anthropic", "model": "deepseek-v4-flash", "requests": 20 }
  ]
}
```

### Prometheus Metrics

cc-route exposes a native Prometheus `/metrics` endpoint:

```bash
curl http://localhost:3456/metrics
```

Available metrics:

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | `method`, `path`, `provider`, `model`, `status` |
| `http_request_duration_ms` | Histogram | `method`, `path`, `provider`, `model`, `status` |
| `proxy_tokens_total` | Counter | `provider`, `model`, `direction` (input/output) |
| `proxy_active_requests` | Gauge | — |
| `proxy_retries_total` | Counter | `provider`, `model` |
| `proxy_fallbacks_total` | Counter | `from_model`, `to_model` |
| `process_*` | Various | Node.js default metrics (memory, CPU, GC) |

**Grafana dashboard** example (`docker-compose.yml` included):
```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

### WebSocket Gateway

For browser/mobile clients that prefer WebSocket over HTTP/SSE:

```javascript
const ws = new WebSocket('ws://localhost:3456/v1/stream');

ws.onopen = () => {
  ws.send(JSON.stringify({
    model: 'mm25',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello' }]
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.delta?.text);
};
```

Protocol: same request format as `/v1/messages`, but events arrive as WebSocket text frames.

---

### clauder CLI Options

```bash
clauder --proxy-only     # Start proxy without launching Claude
clauder --proxy-stop     # Stop the running proxy
clauder --proxy-status   # Check if proxy is running
```

---

## Supported Providers

### Anthropic-Compatible (native messages format)

| Provider | Preset | Endpoint |
|----------|--------|----------|
| Anthropic | `anthropic` | `api.anthropic.com` |
| MiniMax | `minimax` | `api.minimaxi.com/anthropic` |
| DeepSeek | `deepseek` | `api.deepseek.com/anthropic` |

### OpenAI-Compatible

| Provider | Preset | Endpoint |
|----------|--------|----------|
| OpenRouter | `openrouter` | `openrouter.ai/api/v1` |
| SiliconFlow | `siliconflow` | `api.siliconflow.cn/v1` |
| OpenAI | `openai` | `api.openai.com/v1` |
| Groq | `groq` | `api.groq.com/openai/v1` |
| Together AI | `together` | `api.together.xyz/v1` |
| Fireworks | `fireworks` | `api.fireworks.ai/inference/v1` |
| Perplexity | `perplexity` | `api.perplexity.ai` |
| Moonshot (Kimi) | `kimi` | `api.moonshot.cn/v1` |
| GLM (Zhipu) | `glm` | `open.bigmodel.cn/api/paas/v4` |
| Azure OpenAI | `azure_openai` | Custom (required) |

### Custom Provider

Any provider with an OpenAI-compatible or Anthropic-compatible API:
```json
{
  "my-custom-model": {
    "alias": "custom",
    "baseURL": "https://api.example.com/v1",
    "authToken": "sk-..."
  }
}
```

---

## Cross-Platform Builds

cc-route uses `bun --compile` to produce single-file executables for all major platforms.

### Build Current Platform
```bash
cd cc-route
npm run compile
# → release/cc-route-proxy
```

### Build All Platforms
```bash
npm run compile:all
# → release/cc-route-proxy-linux-x64
# → release/cc-route-proxy-linux-arm64
# → release/cc-route-proxy-macos-x64
# → release/cc-route-proxy-macos-arm64
# → release/cc-route-proxy-windows-x64.exe
```

### Build Specific Platform
```bash
node scripts/build-all.js --target=linux-x64,darwin-arm64
```

---

## Desktop Application

A native desktop GUI is available for Windows, macOS, and Linux (built with Tauri + React).

### Features

- **System tray / menu bar** — Start/stop proxy, open settings, launch Claude Code
- **Settings window** — Configure ports, hosts, and model routes through a visual interface
- **One-click launch** — Opens your terminal with `ANTHROPIC_BASE_URL` pre-configured
- **Console logs** — View proxy output in real-time

### Install

Download the latest installer from [GitHub Releases](https://github.com/3873225350/cc-route/releases):

| Platform | Download |
|----------|----------|
| Windows | `.msi` installer or portable `.exe` |
| macOS | `.dmg` (Universal) |
| Linux | `.AppImage` or `.deb` |

### Build from Source

**Prerequisites**
- [Node.js](https://nodejs.org/) 22+
- [Bun](https://bun.sh/)
- [Rust](https://rustup.rs/)
- Linux only: `sudo apt install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libgtk-3-dev libayatana-appindicator3-dev`

**Run in development mode**
```bash
cd cc-route
npm run desktop:dev
```

**Build release artifact**
```bash
cd cc-route
npm run desktop:build
# Artifacts will be in desktop/src-tauri/target/release/bundle/
```

---

## Linux Server Deployment

### systemd Service

```bash
# Install binary
sudo cp release/cc-route-proxy-linux-x64 /usr/local/bin/cc-route-proxy
sudo chmod +x /usr/local/bin/cc-route-proxy

# Install service (replace `ubuntu` with your username)
sudo cp systemd/cc-route.service /etc/systemd/system/cc-route@.service
sudo systemctl enable cc-route@ubuntu
sudo systemctl start cc-route@ubuntu

# Check status
sudo systemctl status cc-route@ubuntu
journalctl -u cc-route@ubuntu -f
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  cc-route:
    image: ghcr.io/3873225350/cc-route-proxy:latest
    ports:
      - "3456:3456"
    volumes:
      - ~/.claude/settings.cc-route.json:/app/config.json:ro
    environment:
      - CC_ROUTE_CONFIG=/app/config.json
      - CC_ROUTE_PORT=3456
      - CC_ROUTE_HOST=0.0.0.0
    restart: unless-stopped
```

---

## Troubleshooting

### Auth Conflict: ANTHROPIC_AUTH_TOKEN vs ANTHROPIC_API_KEY

If you see:
```
Auth conflict: Both a token (ANTHROPIC_AUTH_TOKEN) and an API key (ANTHROPIC_API_KEY) are set.
```

**Fix:** When using cc-route proxy, use API key mode only:
```bash
unset ANTHROPIC_AUTH_TOKEN
export ANTHROPIC_API_KEY="cc-route-dummy-key"
# or your real Anthropic key if routing to Anthropic default
```

### "Unknown skill" Error

If you see:
```
Unknown skill: cc-route:model
```

**Cause:** Wrong command syntax. cc-route commands are registered as top-level commands, not namespaced skills.

**Fix:** Use the correct syntax:
```
/mmodel mm25:写代码       # ✓ Correct
/model mm25                # ✓ Correct (built-in /model + alias)
/cc-route:mmodel mm25      # ✗ Wrong — commands are not namespaced
/cc-route:model mm25       # ✗ Wrong
```

### Plugin Not Loading

1. Verify symlink: `ls -la ~/.claude/plugins/cc-route`
2. Check plugin structure matches [openai-codex plugin format](https://github.com/anthropics/claude-code-plugins)
3. Restart Claude Code completely
4. Check `~/.claude/plugins/` has correct permissions

---

## Production Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Config Hot-Reload** | ✅ | Watches `settings.cc-route.json` for changes without restart |
| **Cost Tracking** | ✅ | Per-provider token usage dashboard at `/v1/admin/usage` |
| **Auto Retry** | ✅ | Exponential backoff on 429/500/502/503 errors |
| **Fallback Routing** | ✅ | Auto-switch to sibling model within same provider on failure |
| **Alias Resolution** | ✅ | Case-insensitive alias matching |
| **Model Validation** | ✅ | Serves `GET /v1/models` so Claude Code accepts custom model names |
| **Cross-Platform** | ✅ | Single-file binaries via `bun --compile` for Linux/macOS/Windows |
| **Docker** | ✅ | Multi-stage Dockerfile for minimal image |
| **systemd** | ✅ | Service template for Linux servers |
| **Provider Presets** | ✅ | 12 built-in presets (OpenRouter, SiliconFlow, Groq, etc.) |
| **HTTP/2 + Keep-Alive** | ✅ | Per-origin connection pooling via undici |
| **Prometheus Metrics** | ✅ | `/metrics` endpoint with request/token/retry/fallback stats |
| **WebSocket Gateway** | ✅ | `ws://host:port/v1/stream` for real-time clients |
| **Hot Reload** | ✅ | Auto-reload config on file change |
| **Desktop App** | ✅ | Native GUI for Windows/macOS/Linux via Tauri |

---

## Why This Survives Updates

| Approach | Survives `claude update`? | Why |
|----------|--------------------------|-----|
| Fork | ❌ No | Upstream is closed-source |
| Patch | ❌ No | Minified symbols change every release |
| Hook | ⚠️ Maybe | Depends on launch mechanism; fragile |
| **Wrapper (this)** | ✅ **Yes** | Uses only stable `ANTHROPIC_BASE_URL` env var |

---

## Directory Structure

```
cc-route/
├── README.md                          # This file
├── LICENSE                            # MIT
├── package.json                       # Root workspace config
├── Dockerfile                         # Docker image
├── .github/
│   └── workflows/
│       └── release.yml                # GitHub Actions: auto-release
├── scripts/
│   ├── build-all.js                   # Cross-platform build script
│   ├── build-desktop.js               # Desktop app build script
│   └── install-plugin.js              # Plugin installer
├── proxy/                             # HTTP routing service
├── desktop/                           # Native desktop GUI (Tauri + React)
│   ├── src/                           # React frontend
│   ├── src-tauri/                     # Rust backend
│   │   ├── src/
│   │   │   ├── main.rs                # Entry point
│   │   │   ├── tray.rs                # System tray / menu bar
│   │   │   ├── commands.rs            # Tauri command handlers
│   │   │   └── proxy_manager.rs       # Sidecar subprocess lifecycle
│   │   └── tauri.conf.json            # Tauri app config
│   └── package.json
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                   # Entry point
│       ├── clauder.ts                 # Drop-in claude wrapper with auto-proxy
│       ├── config.ts                  # Config file watcher + preset expansion
│       ├── router.ts                  # Route resolution logic
│       ├── server.ts                  # HTTP server + middleware
│       ├── types/
│       │   └── index.ts
│       ├── providers/
│       │   └── presets.ts             # 12 built-in provider presets
│       └── middleware/
│           ├── costTracker.ts         # Usage tracking
│           ├── retry.ts               # Exponential backoff retry
│           ├── fallback.ts            # Provider fallback rules
│           ├── httpAgent.ts           # HTTP/2 + connection pooling
│           ├── metrics.ts             # Prometheus metrics collection
│           └── websocket.ts           # WebSocket gateway
├── plugin/                            # Claude Code plugin
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── skills/
│   │   └── cc-route-routing/
│   │       └── SKILL.md               # Skill: alias awareness
│   └── commands/
│       └── mmodel.md                  # Command: /mmodel DSL
├── wrapper/
│   └── cc-route.sh                    # One-shot launcher
└── systemd/
    └── cc-route.service               # systemd service template
```

---

## License

MIT
