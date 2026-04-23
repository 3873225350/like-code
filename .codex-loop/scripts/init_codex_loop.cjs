const fs = require('fs');
const path = require('path');

async function run() {
  const workspace = process.cwd();
  const loopName = process.argv[2] || 'DEFAULT_ROADMAP';
  console.log(`[Codex-Loop] Initializing Reflective Loop environment in: ${workspace} for loop: ${loopName}`);

  const stateDir = path.join(workspace, '.codex-loop', 'state', loopName);
  const taskDir = path.join(stateDir, 'sub-tasks');

  // 1. Create directory structure
  [stateDir, taskDir, path.join(stateDir, 'logs'), path.join(stateDir, 'dispatch_logs')].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 2. Create Initial Roadmap
  const roadmapPath = path.join(stateDir, `${loopName}.md`);
  if (!fs.existsSync(roadmapPath)) {
    fs.writeFileSync(roadmapPath, `# Codex-Loop Integration Roadmap (${loopName})

**Plan ID**: \`${loopName}-${Date.now()}\`
**Status**: \`M1: Initializing\`
**Active Task**: \`INIT-001\`

## Milestones
- [ ] **INIT-001**: Define project goals.
`);
  }

  // 3. Create Failure Bank
  const failureBankPath = path.join(stateDir, 'failure_bank.json');
  if (!fs.existsSync(failureBankPath)) {
    fs.writeFileSync(failureBankPath, JSON.stringify({ schema_version: 1, failures: [] }, null, 2));
  }

  // 4. Create Active Task Adapter (PEFT/LoRA metaphor)
  const activeTaskPath = path.join(stateDir, 'active_task.json');
  if (!fs.existsSync(activeTaskPath)) {
    fs.writeFileSync(activeTaskPath, JSON.stringify({
      active_task_id: "INIT-001",
      status: "planned",
      local_patches: [],
      scope_patch: null,
      prompt_patch: null,
      verification_patch: null
    }, null, 2));
  }

  // 5. Create last_mode.txt (optimize/check alternation)
  const lastModePath = path.join(stateDir, 'last_mode.txt');
  if (!fs.existsSync(lastModePath)) {
    fs.writeFileSync(lastModePath, 'check'); // start with optimize on first tick
  }

  // 6. Create prompt.md if not exists at workspace level
  const promptPath = path.join(workspace, '.codex-loop', 'prompt.md');
  if (!fs.existsSync(promptPath)) {
    fs.writeFileSync(promptPath, `You are the Codex Loop Scheduler (Reflective Edition).

Your goal is to apply "Backward Signal" logic to refine implementation:
1. BEFORE Optimize: Read \`failure_bank.json\` to avoid past errors and apply \`local_patches\` from \`active_task.json\`.
2. DURING Check: If the task isn't perfect, do not just fail it. Write a specific \`local_patch\` (prompt or scope) into \`active_task.json\`.
3. AFTER Success: Clear \`local_patches\` and move to the next roadmap item.
`);
  }

  console.log(`[Codex-Loop] Done. You can now start the daemon: bash .codex-loop/scripts/run_daemon.sh ${loopName}`);
}

run().catch(console.error);
