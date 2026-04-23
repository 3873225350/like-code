#!/usr/bin/env bash
#================================================================
# Codex Loop Dispatcher (Standalone - No Shared Templates)
#================================================================

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-}"
LOOP_NAME="${2:-DEFAULT_CODEX_ROADMAP}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

export WORKSPACE LOOP_NAME MODE

STATE_DIR="${WORKSPACE}/.codex-loop/state/${LOOP_NAME}"
LOG_DIR="${STATE_DIR}/dispatch_logs"
mkdir -p "${STATE_DIR}" "${LOG_DIR}"

dispatch_log="${LOG_DIR}/codex-dispatch_${LOOP_NAME}_$(date +%Y%m%d_%H%M%S).log"

log_dispatch() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [PROVIDER:codex] $1" | tee -a "${dispatch_log}"
}

#================================================================
# Reflective Loop Prompt Builder
# - optimize: Forward Pass (implementation)
# - check: Backward Signal (audit + local patches)
#================================================================

build_prompt() {
    local mode="$1"
    local role
    case "$mode" in
        optimize) role="implementation" ;;
        check)    role="checker" ;;
    esac

    if [[ "$mode" == "optimize" ]]; then
        cat <<EOF
You are the AgentHUD ${role} agent for Codex.
Workspace: ${WORKSPACE}

BEFORE Optimize:
1. Read .codex-loop/state/${LOOP_NAME}/failure_bank.json to avoid past errors.
2. Apply local_patches from .codex-loop/state/${LOOP_NAME}/active_task.json.

Task: Follow .codex-loop/state/${LOOP_NAME}/${LOOP_NAME}.md and update .codex-loop/state/${LOOP_NAME}/sub-tasks/*.json.

CRITICAL INSTRUCTIONS:
1. Complete precisely one verifiable slice of work.
2. Do not run git add or git commit. Leave changes in the worktree for the user/main agent to inspect.
3. Update .codex-loop/state/${LOOP_NAME}/${LOOP_NAME}.md and active_task.json with the latest status.
4. Run the narrowest useful verification command for the slice you changed.
EOF
    else
        cat <<EOF
You are the AgentHUD ${role} agent for Codex.
Workspace: ${WORKSPACE}

DURING Check:
If the task isn't perfect, write a specific local_patch into active_task.json.
Compute the "loss" between target and actual state.

Task: Inspect recent changes and update .codex-loop/state/${LOOP_NAME}/${LOOP_NAME}.md.

CRITICAL INSTRUCTIONS:
1. Review implementation for alignment with the roadmap.
2. Provide a 'Local Patch' in active_task.json if corrections are needed:
   - prompt_patch: Behavioral hints for next optimize pass.
   - scope_patch: Adjust editing radius.
   - verification_patch: Extra validation steps.
3. If task passes, clear local_patches and mark task complete.
EOF
    fi
}

#================================================================
# Codex Agent Invocation with Thread Persistence
#================================================================

invoke_agent() {
    local model="$1"
    local prompt_file="$2"
    local mode="$3"
    local model_args=()
    if [[ "${model}" != "default" ]]; then
        model_args=(-m "${model}")
    fi

    # Codex per-mode thread persistence
    local THREAD_FILE="${STATE_DIR}/thread_id_${mode}.txt"

    if [[ -f "$THREAD_FILE" ]] && [[ -s "$THREAD_FILE" ]]; then
        log_dispatch "Resuming thread: $(cat "$THREAD_FILE")"
        codex exec resume "$(cat "$THREAD_FILE")" "${model_args[@]}" --dangerously-bypass-approvals-and-sandbox -C "${WORKSPACE}" "$(cat "${prompt_file}")" 2>&1 | tee -a "${dispatch_log}"
    else
        log_dispatch "Starting new thread for mode: ${mode}"
        codex exec "${model_args[@]}" --dangerously-bypass-approvals-and-sandbox -C "${WORKSPACE}" "$(cat "${prompt_file}")" 2>&1 | tee -a "${dispatch_log}"
    fi
    return ${PIPESTATUS[0]}
}

#================================================================
# Multi-Model Fallback (Ordered by availability/throughput)
#================================================================

get_models() {
    echo "default
o3
o4-mini
gpt-4.1
gpt-4.1-mini
gpt-4.1-nano"
}

#================================================================
# Main Dispatch Logic
#================================================================

main() {
    local mode="${1:-optimize}"
    local loop="${2:-DEFAULT_CODEX_ROADMAP}"

    log_dispatch "=== Codex Dispatch Start ==="
    log_dispatch "Mode: ${mode}, Loop: ${loop}"

    local prompt_file="${STATE_DIR}/prompt_${mode}.txt"
    build_prompt "${mode}" > "${prompt_file}"
    log_dispatch "Prompt written to: ${prompt_file}"

    local success=false
    for model in $(get_models); do
        log_dispatch "Trying model: ${model}"
        if invoke_agent "${model}" "${prompt_file}" "${mode}"; then
            success=true
            log_dispatch "Model ${model} succeeded"
            break
        else
            local exit_code=$?
            log_dispatch "Model ${model} failed (exit=${exit_code}), trying next..."
        fi
    done

    if $success; then
        log_dispatch "Dispatch completed successfully"
    else
        log_dispatch "ERROR: All models failed"
        exit 1
    fi
}

main "$@"
