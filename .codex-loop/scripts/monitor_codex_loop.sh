#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${CODEX_LOOP_WORKSPACE:-$PWD}"
STATE_DIR="${CODEX_LOOP_STATE_DIR:-${WORKSPACE}/.codex-loop/state}"
LOOP_NAME="${CODEX_LOOP_LOOP_NAME:-OPTIMIZE_ROADMAP}"
WATCH=0
INTERVAL_SECONDS=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch)
      WATCH=1
      shift
      ;;
    --interval)
      INTERVAL_SECONDS="$2"
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

PID_FILE="${STATE_DIR}/${LOOP_NAME}/daemon.pid"
ACTIVE_LOG="${STATE_DIR}/${LOOP_NAME}/active.log"
LAST_MODE_FILE="${STATE_DIR}/${LOOP_NAME}/last_mode.txt"
ACTIVE_TASK="${STATE_DIR}/${LOOP_NAME}/active_task.json"
FAILURE_BANK="${STATE_DIR}/${LOOP_NAME}/failure_bank.json"

render() {
  echo "Codex Loop Monitor"
  echo "=================="
  echo "loop_name      : ${LOOP_NAME}"
  echo "workspace      : ${WORKSPACE}"
  echo "time           : $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  # Daemon status
  if [[ -f "${PID_FILE}" ]]; then
    PID=$(cat "${PID_FILE}")
    if kill -0 "${PID}" 2>/dev/null; then
      echo "daemon_running : ✅ YES (PID ${PID})"
    else
      echo "daemon_running : ❌ DEAD (stale PID ${PID})"
    fi
  else
    echo "daemon_running : ⚠️  NOT STARTED"
  fi

  # Last mode
  if [[ -f "${LAST_MODE_FILE}" ]]; then
    echo "last_mode      : $(cat "${LAST_MODE_FILE}")"
  fi

  # Active task
  if [[ -f "${ACTIVE_TASK}" ]]; then
    echo ""
    echo "--- active_task.json ---"
    cat "${ACTIVE_TASK}" | head -20
  fi

  # Failure count
  if [[ -f "${FAILURE_BANK}" ]]; then
    FAILURE_COUNT=$(grep -c '"pattern"' "${FAILURE_BANK}" 2>/dev/null || echo "0")
    echo ""
    echo "failure_bank   : ${FAILURE_COUNT} entries"
  fi

  # Recent logs
  if [[ -L "${ACTIVE_LOG}" ]] || [[ -f "${ACTIVE_LOG}" ]]; then
    echo ""
    echo "--- recent activity ---"
    tail -15 "${ACTIVE_LOG}" 2>/dev/null || true
  fi

  echo ""
  echo "--- helpful commands ---"
  echo "start  : bash ${SCRIPT_DIR:-.}/start_codex_loop.sh"
  echo "stop   : bash ${SCRIPT_DIR:-.}/stop_codex_loop.sh"
  echo "status : bash ${SCRIPT_DIR:-.}/status_codex_loop.sh"
  echo "logs   : tail -f ${ACTIVE_LOG}"
}

if [[ "${WATCH}" == "1" ]]; then
  while true; do
    clear
    render
    sleep "${INTERVAL_SECONDS}"
  done
else
  render
fi
