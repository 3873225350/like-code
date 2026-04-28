---
description: Multi-model orchestration with structured DSL (alias:role assignment)
argument-hint: '[alias:role ...] [--readonly=alias1,alias2] [task description]'
allowed-tools: Agent, Read, Bash
---

The user has invoked `/mmodel` to coordinate a task across multiple configured model providers.

## Step 1: Read Available Routes

Use the Read tool to load `~/.claude/settings.cc-route.json` (or `./.claude/settings.cc-route.json`). Extract the `modelRoutes` section to confirm which aliases are available and their base URLs.

## Step 2: Parse DSL from User Input

Parse the user's argument string for:
- **Alias:Role assignments** in the form `alias:role`, `alias=role`, or `alias：role` (支持中文冒号)
  - Example: `mm25:实现核心算法`, `g5:写单元测试`, `kimi:代码审查`
- **Read-only flags**: `--readonly=alias1,alias2` or `--read-only=alias1`
- **Free-form task description**: any text not matching the above patterns

For each alias found:
1. Resolve it to the canonical model name via the config.
2. Classify the role into one of:
   - **worker** (implementation, writing code) — default
   - **reviewer** (audit, test, verify) — triggered by keywords: review, verify, check, test, 审查, 审核, 复查, 检查, 测试
   - **monitor** (watch progress, observe) — triggered by keywords: monitor, watch, observe, 监视, 监控, 观察
3. Determine `readonly` status:
   - Explicit `--readonly` flag → readonly = true
   - Role contains "review", "monitor", "check", "readonly", "只读", "不改" → readonly = true

## Step 3: Validate and Report

Before spawning agents, report to the user:
- Which aliases were detected and their resolved models
- What role each alias was assigned
- Which aliases are marked read-only
- The inferred free-form task description

Ask for confirmation if the assignment seems ambiguous.

## Step 4: Spawn Parallel Subagents

For each validated alias assignment, spawn one Agent tool call:

- `model`: the exact alias (e.g., `"mm25"`, `"g5"`, `"kimi"`)
- `message`: a structured prompt containing:
  - The alias and resolved model name
  - The assigned role and responsibilities
  - The free-form task description
  - For **reviewer/monitor**: explicit instruction to inspect and report only, do not modify files unless explicitly asked
  - For **worker**: explicit file/module boundaries to avoid overlap with other workers

Example worker prompt:
```
You are mm25 (MiniMax-M2.5) acting as the primary implementer.
Task: Implement the core algorithm for [description].
Scope: You own src/core/ only. Do not touch tests/ or docs/.
Other agents: g5 will write tests, kimi will review.
```

Example reviewer prompt:
```
You are kimi (kimi-k2) acting as code quality reviewer.
Task: Review the implementation produced by mm25 and g5.
Constraints: Read-only. Inspect code correctness, edge cases, and style.
Do not modify any files. Report findings as a structured summary.
```

## Step 5: Coordinate Completion

After all spawned agents complete:
1. Collect their outputs.
2. Synthesize a concise final status report that names each alias/model and summarizes its contribution.
3. If reviewers found issues, propose a follow-up plan (which may involve re-assigning a worker).

## Safety Rules

- Never spawn more than 6 concurrent subagents.
- Always give workers non-overlapping file responsibilities.
- Reviewers/monitors must never overwrite another agent's output by default.
- If the user did not mention any valid alias, explain the available aliases from the config and ask them to restate.
