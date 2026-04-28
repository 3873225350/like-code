#!/usr/bin/env bash
set -euo pipefail

# cc-route launcher
# Usage: cc-route [command]
#   launch    Start proxy + launch Claude Code (default)
#   proxy     Start proxy only
#   status    Show current proxy status
#   stop      Stop running proxy
#   install   Install Claude Code plugin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROXY_DIR="$PROJECT_ROOT/proxy"
RELEASE_DIR="$PROJECT_ROOT/release"

# Default configuration
CC_ROUTE_PORT="${CC_ROUTE_PORT:-3456}"
CC_ROUTE_HOST="${CC_ROUTE_HOST:-127.0.0.1}"
CC_ROUTE_CONFIG="${CC_ROUTE_CONFIG:-$HOME/.claude/settings.cc-route.json}"

# PID file for proxy
PID_FILE="${TMPDIR:-/tmp}/cc-route-proxy.pid"

# Detect platform for binary selection
_detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$arch" in
    x86_64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
  esac
  echo "${os}-${arch}"
}

_find_proxy_binary() {
  local platform="$(_detect_platform)"
  local binary="$RELEASE_DIR/cc-route-proxy-${platform}"

  # Try compiled binary first
  if [ -x "$binary" ]; then
    echo "$binary"
    return 0
  fi

  # Fall back to Node.js
  if [ -f "$PROXY_DIR/dist/index.js" ]; then
    echo "node $PROXY_DIR/dist/index.js"
    return 0
  fi

  return 1
}

show_help() {
  cat <<EOF
cc-route — Multi-provider model routing wrapper for Claude Code

Usage:
  cc-route launch          Start proxy and launch Claude Code
  cc-route claude          Alias: same as launch
  cc-route clauder         Alias: same as launch (auto-managed proxy)
  cc-route proxy           Start proxy only
  cc-route status          Show proxy status
  cc-route stop            Stop running proxy
  cc-route install         Install Claude Code plugin
  cc-route help            Show this message

Environment Variables:
  CC_ROUTE_PORT            Proxy port (default: 3456)
  CC_ROUTE_HOST            Proxy host (default: 127.0.0.1)
  CC_ROUTE_CONFIG          Path to config file
  ANTHROPIC_BASE_URL       Set automatically by launch
  ANTHROPIC_API_KEY        Claude Code auth (cc-route sets dummy if missing)

Config File:
  ~/.claude/settings.cc-route.json
  {
    "modelRoutes": {
      "MiniMax-M2.5": {
        "alias": "mm25",
        "baseURL": "https://api.minimaxi.com/anthropic",
        "authToken": "sk-..."
      }
    }
  }

Plugin Commands (after install & restart Claude Code):
  /model mm25              Switch to MiniMax model
  /mmodel mm25:写代码 g5:测试  Multi-model orchestration
EOF
}

check_auth_conflict() {
  if [ -n "${ANTHROPIC_AUTH_TOKEN:-}" ] && [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    echo "[cc-route] ⚠️  Auth conflict detected!"
    echo "[cc-route] Both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY are set."
    echo "[cc-route] When using cc-route proxy, you should use API key mode."
    echo "[cc-route] Fix: unset ANTHROPIC_AUTH_TOKEN"
    echo ""
  fi
}

start_proxy() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "[cc-route] Proxy already running on pid $(cat "$PID_FILE")"
    return 0
  fi

  local proxy_cmd
  proxy_cmd="$(_find_proxy_binary)"

  if [ -z "$proxy_cmd" ]; then
    echo "[cc-route] Building proxy..."
    (cd "$PROXY_DIR" && npm install && npm run build)
    proxy_cmd="$(_find_proxy_binary)"
  fi

  echo "[cc-route] Starting proxy on $CC_ROUTE_HOST:$CC_ROUTE_PORT..."
  echo "[cc-route] Binary: $proxy_cmd"

  (
    cd "$PROXY_DIR"
    CC_ROUTE_PORT="$CC_ROUTE_PORT" \
    CC_ROUTE_HOST="$CC_ROUTE_HOST" \
    CC_ROUTE_CONFIG="$CC_ROUTE_CONFIG" \
    $proxy_cmd &
    echo $! > "$PID_FILE"
  )

  # Wait for proxy to be ready
  for i in {1..10}; do
    if curl -sf "http://$CC_ROUTE_HOST:$CC_ROUTE_PORT/v1/models" >/dev/null 2>&1; then
      echo "[cc-route] ✓ Proxy ready"
      return 0
    fi
    sleep 0.3
  done

  echo "[cc-route] ⚠️  Warning: Proxy did not respond in time"
}

stop_proxy() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "[cc-route] Stopping proxy (pid $pid)..."
      kill "$pid" 2>/dev/null || true
      rm -f "$PID_FILE"
    else
      echo "[cc-route] Proxy not running"
      rm -f "$PID_FILE"
    fi
  else
    echo "[cc-route] No proxy pid file found"
  fi
}

show_status() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "[cc-route] Proxy running on pid $(cat "$PID_FILE")"
    curl -sf "http://$CC_ROUTE_HOST:$CC_ROUTE_PORT/v1/models" 2>/dev/null | head -c 200 || echo "[cc-route] Proxy not responding"
    echo ""
    echo "[cc-route] Usage dashboard: http://$CC_ROUTE_HOST:$CC_ROUTE_PORT/v1/admin/usage"
  else
    echo "[cc-route] Proxy not running"
  fi
}

install_plugin() {
  echo "[cc-route] Installing Claude Code plugin..."
  node "$PROJECT_ROOT/scripts/install-plugin.js"
}

launch_claude() {
  check_auth_conflict
  start_proxy

  echo "[cc-route] Launching Claude Code with cc-route proxy..."
  echo "[cc-route] ANTHROPIC_BASE_URL=http://$CC_ROUTE_HOST:$CC_ROUTE_PORT"

  export ANTHROPIC_BASE_URL="http://$CC_ROUTE_HOST:$CC_ROUTE_PORT"

  # Only set dummy key if none provided
  if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
    export ANTHROPIC_API_KEY="cc-route-dummy-key"
    echo "[cc-route] Set ANTHROPIC_API_KEY=cc-route-dummy-key (proxy handles real auth)"
  fi

  if command -v claude >/dev/null 2>&1; then
    exec claude "$@"
  else
    echo "[cc-route] Error: 'claude' command not found in PATH"
    echo "[cc-route] Install Claude Code first: https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview"
    exit 1
  fi
}

# Main dispatch
case "${1:-launch}" in
  launch)
    shift || true
    launch_claude "$@"
    ;;
  proxy)
    start_proxy
    ;;
  status)
    show_status
    ;;
  stop)
    stop_proxy
    ;;
  install)
    install_plugin
    ;;
  claude|clauder)
    shift || true
    check_auth_conflict
    start_proxy
    export ANTHROPIC_BASE_URL="http://$CC_ROUTE_HOST:$CC_ROUTE_PORT"
    if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
      export ANTHROPIC_API_KEY="cc-route-dummy-key"
    fi
    if command -v claude >/dev/null 2>&1; then
      exec claude "$@"
    else
      echo "[cc-route] Error: 'claude' command not found in PATH"
      exit 1
    fi
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo "[cc-route] Unknown command: $1"
    show_help
    exit 1
    ;;
esac
