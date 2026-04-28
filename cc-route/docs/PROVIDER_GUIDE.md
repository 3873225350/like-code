# Provider Contribution Guide

Thank you for contributing a new provider preset to cc-route! This guide walks you through adding support for a new API service.

---

## What is a Preset?

A **preset** is a named configuration template that expands into a full `baseURL` + `defaultHeaders` combination. Users write:

```json
{ "preset": "myprovider", "authToken": "sk-..." }
```

Instead of:

```json
{ "baseURL": "https://api.myprovider.com/v1", "authToken": "sk-...", "headers": { "X-Special": "value" } }
```

---

## Quick Checklist

- [ ] Provider has a public API endpoint
- [ ] Supports either **OpenAI-compatible** or **Anthropic-compatible** request/response format
- [ ] You have tested at least one successful request through cc-route
- [ ] You have added the preset to `proxy/src/providers/presets.ts`
- [ ] You have added an example to this guide

---

## Step-by-Step: Adding a New Preset

### 1. Identify the Provider's API Format

cc-route proxies requests in two formats:

| Format | Request Body | Streaming Response |
|--------|-------------|-------------------|
| **Anthropic** | `{ model, messages, max_tokens }` | SSE with `data: {...}` events |
| **OpenAI** | `{ model, messages, max_tokens }` | SSE with `data: {...}` events |

Most modern providers offer an OpenAI-compatible endpoint. If the provider supports Anthropic's messages API natively, set `supportsAnthropicFormat: true`.

### 2. Gather Required Information

| Field | Example | Required? |
|-------|---------|-----------|
| Name | `"MyProvider"` | ✅ |
| baseURL | `"https://api.myprovider.com/v1"` | ✅ |
| Description | `"Fast inference for Llama models"` | ✅ |
| docsURL | `"https://docs.myprovider.com"` | ❌ (nice to have) |
| defaultHeaders | `{ "X-Title": "cc-route" }` | ❌ (only if provider requires) |
| supportsAnthropicFormat | `true` / `false` | ✅ |

### 3. Edit `proxy/src/providers/presets.ts`

Add your preset to the `PROVIDER_PRESETS` object:

```typescript
myprovider: {
  name: 'MyProvider',
  baseURL: 'https://api.myprovider.com/v1',
  description: 'Fast inference for Llama and Mistral models.',
  docsURL: 'https://docs.myprovider.com',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/3873225350/cc-route',
  },
  supportsAnthropicFormat: false,
},
```

**Special cases:**

- **Custom baseURL required** (like Azure): leave `baseURL: ''` and the user must provide it:
  ```typescript
  azure_openai: {
    name: 'Azure OpenAI',
    baseURL: '',
    description: 'Requires custom resource URL.',
    supportsAnthropicFormat: false,
  }
  ```

- **Non-standard auth header** (like Azure's `api-key`):
  ```typescript
  defaultHeaders: {
    'api-key': '${apiKey}', // replaced at runtime with the user's authToken
  },
  ```

### 4. Test the Preset

Create a temporary config:

```bash
# /tmp/test-myprovider.json
{
  "modelRoutes": {
    "llama-3-70b": {
      "alias": "llama",
      "preset": "myprovider",
      "authToken": "sk-your-real-key"
    }
  }
}
```

Run the proxy:

```bash
CC_ROUTE_CONFIG=/tmp/test-myprovider.json CC_ROUTE_PORT=3456 npm run dev
```

Test the endpoint:

```bash
curl http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"llama","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
```

You should see a valid response (200 with JSON or SSE stream).

### 5. Update Documentation

Add your provider to the Supported Providers table in `README.md`:

```markdown
| Provider | Preset | Endpoint | Format |
|----------|--------|----------|--------|
| MyProvider | `myprovider` | `api.myprovider.com/v1` | OpenAI |
```

### 6. Submit PR

```bash
git checkout -b feat/provider-myprovider
git add proxy/src/providers/presets.ts README.md
git commit -m "feat: add MyProvider preset"
git push origin feat/provider-myprovider
```

In your PR description, include:
- Provider name and website
- API documentation link
- Test result (curl output showing successful request)
- Pricing page (optional but helpful)

---

## Preset Design Decisions

### When to use `supportsAnthropicFormat: true`?

Set to `true` **only if** the provider exposes a `/v1/messages` endpoint that accepts the exact Anthropic messages schema and returns Anthropic-style SSE events. Examples:

- ✅ MiniMax (`api.minimaxi.com/anthropic`) — native compatibility
- ✅ DeepSeek (`api.deepseek.com/anthropic`) — native compatibility
- ❌ OpenRouter (`openrouter.ai/api/v1`) — OpenAI-compatible, not Anthropic

### When to add `defaultHeaders`?

Add default headers only when the provider **requires** them for all requests:

- **OpenRouter** requires `HTTP-Referer` and `X-Title` for ranking
- **Azure** requires `api-key` instead of `Authorization`
- Most providers need nothing extra

### Preset naming convention

- Lowercase, underscore for spaces: `siliconflow`, `azure_openai`
- Match the provider's CLI tool name if one exists: `groq`, `together`
- Avoid trademark conflicts when possible

---

## Reference: Existing Presets

See `proxy/src/providers/presets.ts` for the full list. Study these examples:

| Preset | Complexity | Notable Feature |
|--------|-----------|-----------------|
| `openrouter` | Low | `defaultHeaders` for referer tracking |
| `azure_openai` | Medium | Empty `baseURL`, custom `api-key` header |
| `deepseek` | Low | `supportsAnthropicFormat: true` |
| `siliconflow` | Low | Simple OpenAI-compatible endpoint |

---

## FAQ

**Q: My provider uses a custom auth scheme (not Bearer).**

A: Use `defaultHeaders` with a special marker:
```typescript
defaultHeaders: {
  'X-API-Key': '${apiKey}', // replaced at runtime
}
```

**Q: My provider requires signing requests (AWS SigV4, etc.).**

A: Presets currently don't support request signing. For now, users must use the full config with `headers`. Open an issue to discuss adding a signing hook.

**Q: Can I add a preset that maps multiple models to one endpoint?**

A: Yes. The preset only defines the `baseURL`. Users configure individual models separately:
```json
{
  "gpt-4o": { "preset": "openrouter", "authToken": "sk-..." },
  "claude-sonnet": { "preset": "openrouter", "authToken": "sk-..." }
}
```

**Q: What if the provider has regional endpoints?**

A: Let users override `baseURL` in their config:
```json
{ "preset": "siliconflow", "baseURL": "https://api.siliconflow.cn/v1" }
```

---

## Need Help?

Open an issue with:
- Provider name and API docs link
- Sample curl request/response
- Error message (if any)

We'd love to help you get it working!
