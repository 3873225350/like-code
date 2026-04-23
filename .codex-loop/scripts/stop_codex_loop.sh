#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${CODEX_LOOP_WORKSPACE:-$PWD}"
STATE_DIR="${CODEX_LOOP_STATE_DIR:-${WORKSPACE}/.codex-loop/state}"
LOOP_NAME="${1:-${CODEX_LOOP_LOOP_NAME:-OPTIMIZE_ROADMAP}}"
PID_FILE="${STATE_DIR}/${LOOP_NAME}/daemon.pid"

echo "=== Stopping Codex Loop: ${LOOP_NAME} ==="

if [[ ! -f "${PID_FILE}" ]]; then
    echo "codex-loop daemon is not running (no PID file)"
    exit 0
fi

PID="$(cat "${PID_FILE}")"

if kill -0 "${PID}" 2>/dev/null; then
    kill "${PID}"
    echo "Sent SIGTERM to PID ${PID}"
    # Wait briefly for graceful shutdown
    for i in $(seq 1 5); do
        if ! kill -0 "${PID}" 2>/dev/null; then
            break
        fi
        sleep 1
    done
    if kill -0 "${PID}" 2>/dev/null; then
        kill -9 "${PID}" 2>/dev/null || true
        echo "Force killed PID ${PID}"
    fi
else
    echo "Stale PID file found, cleaning up"
fi

rm -f "${PID_FILE}"
echo "Daemon stopped"
