import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ModelRouteConfig } from './types/index.js'
import { expandPreset } from './providers/presets.js'

const CONFIG_FILENAMES = [
  'settings.cc-route.json',
  'settings.likecode.json',
]

export class ConfigManager {
  routes: Record<string, ModelRouteConfig> = {}
  aliases: Record<string, string> = {}
  private configPaths: string[] = []

  constructor(customPaths?: string[]) {
    this.configPaths = customPaths ?? this.defaultConfigPaths()
    this.load()
  }

  private defaultConfigPaths(): string[] {
    const paths: string[] = []
    const home = homedir()
    for (const name of CONFIG_FILENAMES) {
      paths.push(join(home, '.claude', name))
    }
    // Project-level config
    try {
      const cwd = process.cwd()
      for (const name of CONFIG_FILENAMES) {
        paths.push(join(cwd, '.claude', name))
      }
    } catch { /* ignore */ }
    return paths
  }

  load(): void {
    this.routes = {}
    this.aliases = {}

    for (const path of this.configPaths) {
      if (!existsSync(path)) continue
      try {
        const raw = readFileSync(path, 'utf-8')
        const parsed = JSON.parse(raw)
        const routes = parsed?.modelRoutes
        if (routes && typeof routes === 'object' && !Array.isArray(routes)) {
          for (const [model, route] of Object.entries(routes)) {
            if (route && typeof route === 'object' && !Array.isArray(route)) {
              // Validate it looks like a route config
              const r = route as ModelRouteConfig
              if (r.preset) {
                // Expand preset into full config
                const expanded = expandPreset(r.preset, r.authToken ?? r.apiKey, r.baseURL)
                if (expanded) {
                  this.routes[model] = {
                    ...r,
                    baseURL: expanded.baseURL,
                    headers: { ...expanded.defaultHeaders, ...r.headers },
                  }
                  continue
                }
                console.error(`[cc-route] Unknown preset "${r.preset}" for model "${model}"`)
              }
              if (r.baseURL || r.alias || r.apiKey || r.authToken) {
                this.routes[model] = r
              }
            }
          }
        }
      } catch (err) {
        console.error(`[cc-route] Failed to load config ${path}:`, (err as Error).message)
      }
    }

    // Build alias map
    for (const [model, route] of Object.entries(this.routes)) {
      const aliases = Array.isArray(route.alias)
        ? route.alias
        : route.alias
          ? [route.alias]
          : []
      for (const alias of aliases) {
        this.aliases[alias.toLowerCase()] = model
      }
    }

    console.log(`[cc-route] Loaded ${Object.keys(this.routes).length} routes, ${Object.keys(this.aliases).length} aliases`)
  }

  resolveAlias(input: string): string | undefined {
    const base = input.replace(/\[(\d+[mk])\]$/i, '').trim()
    const lower = base.toLowerCase()
    return this.aliases[lower]
  }

  getRoute(model: string): ModelRouteConfig | null {
    // Exact match
    if (this.routes[model]) return this.routes[model]

    // Case-insensitive match
    const lowerModel = model.toLowerCase()
    for (const [key, value] of Object.entries(this.routes)) {
      if (key.toLowerCase() === lowerModel) return value
    }

    // Wildcard prefix match
    for (const [key, value] of Object.entries(this.routes)) {
      const normalized = key.toLowerCase()
      if (normalized.endsWith('*')) {
        const prefix = normalized.slice(0, -1)
        if (lowerModel.startsWith(prefix)) return value
      }
    }

    return null
  }

  listModels(): Array<{ id: string; object: string }> {
    return Object.keys(this.routes).map((id) => ({
      id,
      object: 'model',
    }))
  }
}
