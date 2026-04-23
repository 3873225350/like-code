#!/usr/bin/env bash
#================================================================
# Codex Loop Daemon (Standalone - No Shared Templates)
#================================================================

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOP_NAME="${1:-OPTIMIZE_ROADMAP}"
INTERVAL="${INTERVAL:-60}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

export LOOP_NAME INTERVAL WORKSPACE

# Run Python daemon with per-loop support
python3 "${SKILL_DIR}/run_daemon.py"
