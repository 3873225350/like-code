import type { ConfigManager } from './config.js'
import type { RequestContext, ResolvedRoute } from './types/index.js'

export class Router {
  constructor(private config: ConfigManager) {}

  resolve(context: RequestContext): ResolvedRoute | null {
    if (context.path === '/v1/models') {
      // Model list endpoint — no routing needed
      return null
    }

    if (context.path !== '/v1/messages' && context.path !== '/v1/messages?') {
      // Unknown endpoint — pass through to Anthropic default
      return null
    }

    const body = context.body as Record<string, unknown> | undefined
    const modelName = (body?.model as string) ?? ''
    if (!modelName) return null

    // Step 1: Resolve alias
    const resolvedModel = this.config.resolveAlias(modelName) ?? modelName

    // Step 2: Lookup route
    const route = this.config.getRoute(resolvedModel)
    if (!route) {
      console.log(`[cc-route] No route for model "${modelName}" (resolved: "${resolvedModel}")`)
      return null
    }

    // Step 3: Build resolved route
    const baseURL = route.baseURL ?? 'https://api.anthropic.com'
    const authToken = route.authToken ?? route.apiKey ?? ''

    const headers: Record<string, string> = { ...route.headers }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    return {
      model: resolvedModel,
      baseURL,
      apiKey: authToken,
      headers,
      providerModelId: route.providerModelId,
    }
  }

  rewriteBody(body: Record<string, unknown>, route: ResolvedRoute): string {
    const rewritten = { ...body }
    // Replace alias with canonical model name for the provider
    rewritten.model = route.providerModelId ?? route.model
    return JSON.stringify(rewritten)
  }
}
