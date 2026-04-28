# cc-route Architecture

## Design Principles

1. **Zero Intrusion**: Claude Code binary is never modified, patched, or hooked.
2. **Update Invariance**: The architecture survives any Claude Code version update.
3. **Functional Parity**: Recover ≥90% of like-code's core routing capabilities.
4. **Layered Decoupling**: Proxy handles API routing, Skill handles context, Command handles precise control.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER                                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────────────┐   │
│  │ "mm25 写代码"        │    │ /cc-route:mmodel mm25:写代码 g5:写文档 │   │
│  │ (自然语言)           │    │ (结构化 DSL)                            │   │
│  └──────────┬──────────┘    └────────────────────┬────────────────────┘   │
│             │                                      │                        │
│             ▼                                      ▼                        │
│  ┌─────────────────────┐    ┌─────────────────────────────────────────┐   │
│  │   Skill Layer        │    │   Command Layer                         │   │
│  │   (routing.md)       │    │   (mmodel.md)                           │   │
│  │   持续注入系统上下文   │    │   按需触发结构化编排                     │   │
│  │   Claude 自动识别别名 │    │   精确解析 alias:role DSL               │   │
│  │   自动 spawn Agent    │    │   生成确定性 Agent tool 调用序列         │   │
│  └──────────┬──────────┘    └────────────────────┬────────────────────┘   │
│             │                                      │                        │
│             └──────────────────┬───────────────────┘                        │
│                                ▼                                            │
│                   ┌─────────────────────┐                                  │
│                   │   Agent Tool Calls   │                                  │
│                   │   model: "mm25"      │                                  │
│                   │   model: "g5"        │                                  │
│                   │   model: "kimi"      │                                  │
│                   └──────────┬──────────┘                                  │
│                              │                                              │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────────┐
│                              ▼                                              │
│                   ┌─────────────────────┐                                  │
│                   │  Claude Code Binary  │  ← 完全未修改                     │
│                   │  (closed-source)     │                                  │
│                   │                      │                                  │
│                   │  ANTHROPIC_BASE_URL  │                                  │
│                   │  → http://localhost  │                                  │
│                   └──────────┬──────────┘                                  │
│                              │                                              │
│                              ▼                                              │
│                   ┌─────────────────────┐                                  │
│                   │  cc-route-proxy      │                                  │
│                   │  (HTTP interceptor)  │                                  │
│                   │                      │                                  │
│                   │  1. 读取 model 字段   │                                  │
│                   │  2. 解析 alias       │                                  │
│                   │  3. 查路由表         │                                  │
│                   │  4. 转发到 provider  │                                  │
│                   └──────────┬──────────┘                                  │
│                              │                                              │
│              ┌───────────────┼───────────────┐                             │
│              ▼               ▼               ▼                             │
│        ┌─────────┐    ┌─────────┐    ┌─────────┐                         │
│        │Anthropic│    │ MiniMax │    │  GLM    │                         │
│        │   API   │    │   API   │    │  API    │                         │
│        └─────────┘    └─────────┘    └─────────┘                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### Layer 1: Wrapper (cc-route-proxy)

**Responsibility**: Transparent HTTP request routing.

**Why not Hook?**
- Hook requires injecting code into Claude Code's runtime (e.g., `NODE_OPTIONS`, `LD_PRELOAD`).
- Claude Code may be packaged as a standalone binary that ignores `NODE_OPTIONS`.
- Any internal fetch/SDK change breaks the hook.
- Proxy operates at the network layer — the only stable interface.

**Implementation**:
- Node.js HTTP server listening on `localhost:3456`.
- Intercepts `POST /v1/messages`, reads JSON body, extracts `model` field.
- Resolves alias → canonical model → route config (`baseURL`, `apiKey`).
- Rewrites request (auth headers, optional `providerModelId` mapping).
- Streams response back via `fetch()` + `ReadableStream` pipe.
- Also serves `GET /v1/models` so Claude Code's `validateModel()` passes.

**Config Hot-Reload**:
- Watches `~/.claude/settings.cc-route.json` and `./.claude/settings.cc-route.json`.
- Reloads route table without restart.

---

### Layer 2: Skill (routing.md)

**Responsibility**: Teach Claude about aliases and multi-model orchestration rules.

**Why Skill?**
- Skill is injected into Claude's system context for the entire session.
- Claude "knows" about mm25/g5/kimi at all times.
- User can say natural language like "mm25 写代码，g5 写文档" without any slash command.
- Claude will automatically spawn agents with the correct `model` parameter.

**Why not just Command?**
- Command is on-demand. If user forgets to type `/cc-route:mmodel`, Claude doesn't know to orchestrate.
- Skill provides passive awareness.

---

### Layer 3: Command (mmodel.md)

**Responsibility**: Structured DSL entry for complex multi-model tasks.

**Why Command?**
- Natural language is ambiguous. "让 mm25 和 g5 一起做这个" 可能分不清楚边界。
- DSL (`mm25:核心代码 g5:单元测试 kimi:审查`) 提供确定性。
- Command parses the DSL and generates precise Agent tool calls with non-overlapping responsibilities.

**Why not just Skill?**
- Skill cannot receive structured parameters. It's static context.
- Command accepts user input text and processes it.

---

## Feature Parity with like-code Fork

| Feature | like-code Fork | cc-route (this) | Method |
|---------|---------------|-----------------|--------|
| Multi-provider registration | ✅ | ✅ | Proxy config |
| Runtime model switching | ✅ | ✅ | `/model <alias>` + Proxy |
| Alias resolution (mm25→MiniMax) | ✅ | ✅ | Proxy `resolveAlias()` |
| Per-request baseURL/auth | ✅ | ✅ | Proxy request rewrite |
| `/model` picker custom UI | ✅ | ❌ | **Impossible** (closed UI) |
| `/mmodel` natural-lang orchestration | ✅ | ✅ | **Skill** (passive) + **Command** (active) |
| Subagent cross-provider dispatch | ✅ | ✅ | Agent tool `model` param → Proxy |
| Model validation probe | ✅ | ✅ | Proxy `GET /v1/models` |
| Independent settings file | ✅ | ✅ | `settings.cc-route.json` |
| Status display | ❌ | ✅ | `statusLine` integration |
| Zero maintenance on updates | ❌ | ✅ | **Core advantage** |

---

## Data Flow: A Single Request

1. **User**: Types `/model mm25`
2. **Claude Code**: Validates `mm25` by calling `GET /v1/models` on `ANTHROPIC_BASE_URL` (localhost:3456).
3. **Proxy**: Returns `mm25` as a valid model in the list.
4. **Claude Code**: Accepts `mm25` as current model.
5. **User**: Sends a message.
6. **Claude Code**: Sends `POST /v1/messages` with `"model": "mm25"`.
7. **Proxy**:
   - Reads body → `model: "mm25"`
   - `resolveAlias("mm25")` → `"MiniMax-M2.5"`
   - `getRoute("MiniMax-M2.5")` → `{ baseURL: "https://api.minimax.chat/v1", apiKey: "sk-..." }`
   - Rewrites headers: `Authorization: Bearer sk-...`
   - Forwards to `https://api.minimax.chat/v1/messages`
8. **MiniMax API**: Processes request, returns SSE stream.
9. **Proxy**: Pipes SSE chunks back to Claude Code.
10. **Claude Code**: Renders response as normal.

---

## Security Considerations

1. **Localhost-only binding**: Proxy binds to `127.0.0.1` by default. Do not expose to network.
2. **API key isolation**: Provider keys live in `~/.claude/settings.cc-route.json`, not in Claude Code's env. Proxy is the only process that reads them.
3. **No MITM**: Proxy does not terminate TLS. It forwards HTTPS requests to providers. (If provider uses HTTP, that's the provider's configuration.)
4. **Request logging**: Optional. Should not log message content by default (only metadata: model, provider, timestamp).

---

## Extensibility

### Adding a New Provider

1. Edit `~/.claude/settings.cc-route.json`:
   ```json
   {
     "modelRoutes": {
       "my-new-model": {
         "alias": "new",
         "baseURL": "https://api.new-provider.com/v1",
         "apiKey": "sk-..."
       }
     }
   }
   ```
2. Proxy auto-reloads. No code changes needed.
3. Optionally update `plugin/skills/routing.md` to teach Claude about the new alias's strengths.

### Adding Custom Headers

```json
{
  "modelRoutes": {
    "custom-model": {
      "baseURL": "...",
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  }
}
```

---

## Future Enhancements

1. **Cost tracking**: Proxy intercepts usage metadata and accumulates per-provider spend.
2. **Fallback routing**: If MiniMax returns 429, auto-fallback to GLM for the same alias.
3. **Streaming transform**: Normalize thinking blocks / tool-call formats across providers.
4. **Web UI**: A simple dashboard showing active routes, recent requests, and cost summary.
