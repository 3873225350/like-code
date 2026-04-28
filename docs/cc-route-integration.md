# cc-route Integration Guide

## Overview

`cc-route` is the **external dependency** that provides multi-provider model routing for Claude Code. It has been extracted into a standalone open-source project at `github.com/3873225350/cc-route`.

like-code consumes cc-route as a **binary dependency** — either via npm global install or pre-built binary download.

---

## Installation

### Option 1: npm (recommended for development)

```bash
npm install -g cc-route-proxy
```

Then use the `clauder` command as a drop-in replacement for `claude`:

```bash
clauder                          # Interactive mode
clauder "refactor this code"     # One-shot query
clauder config set theme dark    # Claude config commands
```

### Option 2: Pre-built Binary (no Node.js required)

```bash
# macOS (Apple Silicon)
curl -L -o clauder https://github.com/3873225350/cc-route/releases/latest/download/clauder-macos-arm64

# Linux (x64)
curl -L -o clauder https://github.com/3873225350/cc-route/releases/latest/download/clauder-linux-x64

chmod +x clauder
sudo mv clauder /usr/local/bin/
```

### Option 3: Docker

```bash
docker run -p 3456:3456 \
  -v ~/.claude/settings.cc-route.json:/app/config.json:ro \
  -e CC_ROUTE_CONFIG=/app/config.json \
  ghcr.io/3873225350/cc-route:latest
```

---

## Configuration

Create `~/.claude/settings.cc-route.json`:

```json
{
  "modelRoutes": {
    "MiniMax-M2.5": {
      "alias": "mm25",
      "baseURL": "https://api.minimaxi.com/anthropic",
      "authToken": "sk-your-minimax-key"
    },
    "deepseek-v4-flash": {
      "alias": "d4f",
      "preset": "deepseek",
      "authToken": "sk-your-deepseek-key"
    }
  }
}
```

See [cc-route README](https://github.com/3873225350/cc-route#supported-providers) for all 12 built-in presets.

---

## How like-code Uses cc-route

like-code previously had cc-route embedded under `src/cc-route/`. This has been removed. like-code now expects cc-route to be installed externally:

1. **Binary on PATH**: `clauder` or `cc-route-proxy` must be available in `$PATH`
2. **Config file**: `~/.claude/settings.cc-route.json` must exist
3. **Plugin**: cc-route plugin is installed separately via `npm run install:plugin` in cc-route repo

No code-level integration is required — like-code simply uses the `clauder` command instead of `claude`.

---

## Updating cc-route

```bash
# npm install
npm update -g cc-route-proxy

# or download latest binary from GitHub Releases
curl -L -o clauder https://github.com/3873225350/cc-route/releases/latest/download/clauder-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)
```

---

## Development: Linking Local cc-route

If you are developing both projects locally:

```bash
# In cc-route repo
cd ~/hzh/item_bo/cc-route-new
npm link

# In like-code repo (if it needs the package directly)
cd ~/hzh/item_bo/like-code
npm link cc-route-proxy
```

---

## Troubleshooting

### "clauder: command not found"

```bash
which clauder || echo "Not in PATH"
# Install via npm or binary download (see Installation above)
```

### "Repository not found" when npm install

The npm package is published. If you see this, check npm registry:

```bash
npm config get registry
npm info cc-route-proxy
```

### Auth Conflict

When using cc-route, `ANTHROPIC_AUTH_TOKEN` must be unset:

```bash
unset ANTHROPIC_AUTH_TOKEN
export ANTHROPIC_API_KEY="cc-route-dummy-key"
```

---

## Related

- [cc-route GitHub Repository](https://github.com/3873225350/cc-route)
- [cc-route README](https://github.com/3873225350/cc-route#readme)
