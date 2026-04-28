---
name: cc-route-routing
description: Multi-provider model routing context for Claude Code. Knows available aliases and orchestration rules.
user-invocable: false
---

# cc-route: Multi-Provider Model Routing

You are operating with cc-route, a multi-provider model routing layer for Claude Code. All API requests from this session are transparently routed through cc-route-proxy based on the `model` parameter.

## Available Model Route Aliases

The user has configured the following model routes (read from `~/.claude/settings.cc-route.json` or `./.claude/settings.cc-route.json` if needed):

- **mm25** → MiniMax-M2.5 (baseURL: MiniMax API)
  - Strengths: Complex coding, algorithm implementation, deep reasoning
  - Typical role: Worker (primary implementation)

- **g5** → glm-5 (baseURL: GLM / Zhipu AI)
  - Strengths: Documentation, writing, Chinese-language tasks
  - Typical role: Worker (docs/tests) or Reviewer

- **kimi** → kimi-k2 (baseURL: Moonshot AI)
  - Strengths: Long-context review, code quality audit, monitoring
  - Typical role: Reviewer / Monitor (read-only by default)

- **d4f** → deepseek-v4-flash (baseURL: DeepSeek API)
  - Strengths: Fast inference, cost-effective coding tasks
  - Typical role: Worker (quick implementation)

- **anthropic** → claude-sonnet-4-6 (fallback to native Anthropic API)
  - Strengths: General-purpose coding, everyday tasks
  - Typical role: Default worker when no alias is specified

## Multi-Model Orchestration Rules

When the user's request involves multiple model aliases (e.g., "use mm25 for coding and g5 for docs"), follow this protocol:

1. **Identify aliases**: Extract all alias mentions from the user's message.
2. **Assess responsibilities**: Determine what each model should do based on the user's description and the alias's typical strengths.
3. **Spawn parallel subagents**: Use the Agent tool to create one subagent per alias.
   - Set the Agent tool's `model` parameter to the exact alias (e.g., `"mm25"`, `"g5"`).
   - The proxy will automatically route the request to the correct provider.
4. **Divide work explicitly**:
   - **Worker agents** should receive non-overlapping file/module responsibilities.
   - **Reviewer/Monitor agents** should be instructed to inspect, test, and report only. They must not overwrite another agent's work unless the user explicitly requests it.
5. **Coordinate completion**: After all agents finish, synthesize a concise summary naming each alias and what it contributed.

## Important Constraints

- The `/model` picker in Claude Code shows only Anthropic models. Custom aliases (mm25, g5, kimi, d4f) are **not visible in the picker UI**.
- To use a custom model, the user types `/model <alias>` directly (e.g., `/model mm25`).
- Do not attempt to modify Claude Code's built-in model picker — it is a closed UI component.
- If a user asks "what models do I have?", read the cc-route config file and list the aliases.

## Single-Provider Fallback

If the user does not mention any alias, proceed normally with the current model. The proxy will route to Anthropic by default.
