import type { ModelRouteConfig } from '../types/index.js'

export interface FallbackRule {
  primary: string
  fallback: string
}

export class FallbackRouter {
  private rules: Map<string, string> = new Map()

  constructor(rules?: FallbackRule[]) {
    if (rules) {
      for (const rule of rules) {
        this.rules.set(rule.primary, rule.fallback)
      }
    }
  }

  getFallback(model: string): string | undefined {
    return this.rules.get(model)
  }

  static fromConfig(routes: Record<string, ModelRouteConfig>): FallbackRouter {
    const rules: FallbackRule[] = []
    // Auto-generate fallback rules based on provider families
    const byProvider = new Map<string, string[]>()
    for (const [model, route] of Object.entries(routes)) {
      if (!route.baseURL) continue
      try {
        const host = new URL(route.baseURL).host
        const existing = byProvider.get(host) ?? []
        existing.push(model)
        byProvider.set(host, existing)
      } catch {
        // Invalid URL — skip
      }
    }
    // Within each provider, if a model fails, try another model from same provider
    for (const models of byProvider.values()) {
      if (models.length > 1) {
        for (let i = 0; i < models.length; i++) {
          const fallback = models[(i + 1) % models.length]
          rules.push({ primary: models[i]!, fallback })
        }
      }
    }
    return new FallbackRouter(rules)
  }
}
