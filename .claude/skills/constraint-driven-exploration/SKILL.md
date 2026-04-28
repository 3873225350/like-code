# Constraint-Driven Multi-Model Exploration

A systematic methodology for solving complex technical problems by discovering hard boundaries through multi-model parallel analysis and reference-repository validation.

## When to Use

Trigger this skill when any of the following conditions are met:

- You have a **non-trivial technical problem** with no obviously viable solution.
- **Existing approaches all have fatal flaws** (too brittle, unmaintainable, or blocked by platform constraints).
- You need to **integrate with a closed-source or rapidly-changing platform** (e.g., Claude Code, Copilot, proprietary APIs).
- You are considering **forking or patching upstream code** and need to evaluate long-term sustainability.
- You have **multiple competing AI-generated proposals** and need a rigorous way to converge on one.

## Core Principle

> **Hard boundaries are not obstacles—they are convergence signals.**
>
> The fastest path to a viable solution is not brainstorming more ideas, but ruthlessly eliminating the impossible until only the locally-optimal remains.

## Workflow: The 6-Phase Convergence Loop

### Phase 1: Scene Anchoring (5 min)

**Goal:** Define the exact problem and identify your core assets + constraints.

**Deliverable:** A 3-sentence problem statement.

**Template:**
```markdown
I need to [ACTION] so that [GOAL].
My core asset is [EXISTING_CODE/CAPABILITY].
My immovable constraint is [PLATFORM/LICENCE/ARCHITECTURE_LIMIT].
```

**Example:**
> I need to extract like-code's multi-provider model routing so that it survives Claude Code updates. My core asset is the `modelRoutes.ts` registry logic. My immovable constraint is that Claude Code is now closed-source and ships minified binaries.

---

### Phase 2: Multi-Model Divergence (10 min)

**Goal:** Collect diverse perspectives by running the same prompt through **at least 2 different models**.

**Why multi-model?** Different models have different biases:
- **Code-centric models** (Codex, Claude) →倾向于给出工程实现路径，可能低估平台限制。
- **Analysis-centric models** (GLM, Kimi) →倾向于分析系统约束和边界条件，可能过于保守。
- **Creative models** (Gemini, Grok) →倾向于提出非传统方案，可能忽略可行性。

**Prompt Template (send to each model):**
```markdown
Problem: [Paste Phase-1 statement]

Analyze from your perspective:
1. Why can't this be solved with a straightforward wrapper/library?
2. What is the most likely hard boundary (technical, legal, or architectural) that everyone misses?
3. If you had to solve this with ZERO modifications to the host binary, what would you try first?
```

**Deliverable:** A comparison table of each model's key insight and blind spot.

| Model | Key Insight | Blind Spot | Confidence |
|-------|-------------|------------|------------|
| Model A | ... | ... | High/Med/Low |
| Model B | ... | ... | High/Med/Low |

---

### Phase 3: Constraint Discovery (iterative, 10-20 min)

**Goal:** Surface the true hard boundaries by feeding back real-world facts.

**This is the most critical phase.** Do not accept a model's first answer. Probe deeper.

**Tactics:**

1. **Challenge assumptions:** If a model says "you can patch the JS," ask "what if the JS is minified and changes every release?"
2. **Feed ground truth:** Introduce concrete constraints one at a time (e.g., "the vendor no longer open-sources code," "the binary is signed," "the API is undocumented").
3. **Watch for pivots:** A good sign that you are near a hard boundary is when the model **fundamentally changes its recommendation** after learning a new constraint.
4. **Ask for failure modes:** "Under what exact condition would your proposed solution break?"

**Deliverable:** A ranked list of constraints, labeled `HARD` (cannot be circumvented) or `SOFT` (can be worked around with effort).

| Constraint | Type | Evidence | Impact |
|------------|------|----------|--------|
| Host binary is closed-source | HARD | No source repo, minified cli.js | Rules out fork |
| Host exposes ENV for baseURL | SOFT | `ANTHROPIC_BASE_URL` documented | Enables proxy |

---

### Phase 4: Reference Repository Validation (15 min)

**Goal:** Avoid reinventing the wheel. Find projects that have faced similar constraints and dissect their implementation.

**Steps:**

1. **Search keywords:** Use the problem's core concepts as search terms on GitHub, not the product name.
   - Bad: "claude code wrapper"
   - Good: "claude code statusline plugin intercept proxy"

2. **Clone 3-5 repos** into a local `reference/` directory.

3. **For each repo, ask the model:**
   ```markdown
   Analyze this repository: [PATH]
   
   1. What is its core capability?
   2. Does it modify the host binary (patch/fork/hook) or use official extension points?
   3. What constraint does it accept that we might also have to accept?
   4. Would its approach work for our specific problem? Why or why not?
   ```

**Red flags to watch for:**
- A repo claims to "modify UI" but actually patches minified code → fragile.
- A repo claims to "intercept traffic" but requires root/DNS changes → high deployment cost.
- A repo uses an official API you didn't know existed → **this is gold.**

**Deliverable:** A decision matrix of all reference repos.

| Repo | Approach | Modifies Host? | Sustainable? | Reusable for us? |
|------|----------|---------------|--------------|-----------------|
| claude-hud | statusLine API | No | Yes | Partial (UI only) |
| claude-code-patches | Regex patch | Yes | No | No |

---

### Phase 5: Feasible-Region Convergence (10 min)

**Goal:** Eliminate all paths that violate hard constraints; select the locally-optimal remaining path.

**Decision criteria (ranked):**
1. **Invariance to host updates** — Will it break when the vendor ships a new version?
2. **Zero binary modification** — Does it require patching, LD_PRELOAD, or code injection?
3. **Functional parity** — Does it recover ≥80% of the original capability?
4. **Maintenance surface area** — How many lines of code are you now responsible for?
5. **User experience gap** — What features are permanently lost, and can they be mitigated?

**The locally-optimal solution is the one that sits at the intersection of:**
- All `HARD` constraints are respected.
- Maximum functional parity is achieved.
- Minimum maintenance burden is accepted.

**Deliverable:** A single recommended architecture, with an explicit "acceptance list" of what you are giving up.

---

### Phase 6: Artifact Solidification (10 min)

**Goal:** Turn the conclusion into durable assets.

**Required outputs:**
1. **Technical report** (LaTeX or Markdown) documenting:
   - Problem statement
   - Constraints analysis
   - Reference repository evaluation
   - Recommended architecture
   - Feature parity table
2. **Methodology log** (this skill's trace) so the process itself is reusable.
3. **Implementation roadmap** with Phase 1-4 milestones.

---

## Anti-Patterns (What NOT to Do)

| Anti-Pattern | Why It Fails | Symptom |
|--------------|-------------|---------|
| **Single-model analysis** | Every model has blind spots. You will miss a hard boundary. | The chosen solution breaks within 2 weeks of real-world use. |
| **Code-first exploration** | Writing code before understanding constraints produces throwaway work. | You build a beautiful system that violates a `HARD` constraint. |
| **Ignoring reference repos** | "I can figure this out myself" ignores empirical evidence from the ecosystem. | You rediscover a limitation that 3 GitHub repos already documented. |
| **Softening hard constraints** | "Maybe we can convince the vendor to open-source" is wishful thinking. | Months of negotiation delay while competitors ship. |
| **Aiming for 100% parity** | Some features (e.g., closed-source UI injection) are genuinely impossible. | The project never ships because you are chasing an asymptote. |

---

## Case Study: Like-Code Model Routing

**Scene Anchoring:**
- Problem: Extract like-code's multi-provider routing from a frozen Claude Code fork.
- Asset: `modelRoutes.ts` runtime registry + alias resolution.
- Constraint: Claude Code is closed-source; updates ship minified `cli.js`.

**Multi-Model Divergence:**
- Codex → Proposed MCP + Proxy hybrid.
- GLM → Emphasized single-baseURL hard constraint.
- Kimi → Warned about auth header differences across providers.

**Constraint Discovery (iterative):**
- Constraint 1: Claude Code only supports one `baseURL` at a time. (`SOFT` → Proxy can unify.)
- Constraint 2: No plugin can modify the Anthropic SDK client factory. (`HARD` → Rules out all in-process hooks.)
- Constraint 3: Claude Code is fully closed-source; no source merges possible. (`HARD` → Rules out fork.)
- Constraint 4: Minified JS changes symbols every release. (`HARD` → Rules out patch scripts.)
- Constraint 5: `ANTHROPIC_BASE_URL` env var is stable across all known versions. (`SOFT` → Enables proxy interception.)
- Constraint 6: Plugin system supports custom slash commands via markdown prompts. (`SOFT` → Recovers `/mmodel` as prompt command.)

**Reference Validation:**
- `claude-code-patches` → Regex-based JS patching; tracked 27 function-name changes across versions. **Unsustainable.**
- `claude-hud` → Uses official `statusLine` API + plugin commands. **Does not modify binary.** Confirmed that custom slash commands are prompt-driven, not code-driven.
- `oh-my-claudecode` → Plugin-based, but only does prompt orchestration; no API-layer routing.
- `claude-trace` → Transparent HTTP interception via env var. **Validated that proxy approach has no anti-tampering barriers.**

**Convergence:**
- Eliminated: Fork (frozen), Patch (fragile), In-process hook (impossible).
- Selected: **HTTP Proxy** for API routing + **Plugin Command** for UI orchestration + **statusLine** for provider visibility.
- Accepted loss: Custom entries in `/model` picker (closed UI; impossible without binary modification).

**Result:** A decoupled architecture that is invariant to Claude Code version updates, recovers ~90% of original functionality, and reduces maintenance surface area from "entire forked codebase" to "standalone proxy service + markdown prompts."

---

## Quick-Start Checklist

Before starting a new exploration, verify:

- [ ] I have stated the problem in exactly 3 sentences.
- [ ] I have identified at least one asset and one immovable constraint.
- [ ] I have opened at least 2 different AI models/agents for parallel analysis.
- [ ] I have a local `reference/` directory ready for cloned repos.
- [ ] I am prepared to feed back real-world constraints iteratively.
- [ ] I have defined my acceptance criteria: "I am willing to give up X if I gain Y."

---

## Version History

- **v1.0** (2025-04-28) — Initial formulation, derived from the like-code → Proxy+Plugin convergence case study.
