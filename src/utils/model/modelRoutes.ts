import { logForDebugging } from '../debug.js'
import { getLikeCodeSettings } from '../settings/likecodeSettings.js'
import { getSettings_DEPRECATED } from '../settings/settings.js'

export type ModelRouteConfig = {
  baseURL?: string
  apiKey?: string
  authToken?: string
  headers?: Record<string, string>
}

function normalizeModelRoutes(
  routes: unknown,
): Record<string, ModelRouteConfig> {
  if (!routes || typeof routes !== 'object' || Array.isArray(routes)) {
    return {}
  }

  const normalized: Record<string, ModelRouteConfig> = {}
  for (const [model, route] of Object.entries(routes)) {
    if (
      !model.trim() ||
      !route ||
      typeof route !== 'object' ||
      Array.isArray(route)
    ) {
      continue
    }
    normalized[model] = route as ModelRouteConfig
  }
  return normalized
}

function parseEnvModelRoutes(): Record<string, ModelRouteConfig> {
  const raw =
    process.env.CLAUDE_CODE_MODEL_ROUTES_JSON ??
    process.env.LIKECODE_MODEL_ROUTES_JSON

  if (!raw?.trim()) {
    return {}
  }

  try {
    return normalizeModelRoutes(JSON.parse(raw))
  } catch (error) {
    logForDebugging(
      `[API:route] Failed to parse model routes env JSON: ${error instanceof Error ? error.message : String(error)}`,
      { level: 'error' },
    )
    return {}
  }
}

export function getConfiguredModelRoutes(): Record<string, ModelRouteConfig> {
  return {
    ...parseEnvModelRoutes(),
    ...normalizeModelRoutes(getSettings_DEPRECATED()?.modelRoutes),
    ...normalizeModelRoutes(getLikeCodeSettings().modelRoutes),
  }
}

export function getRouteForModel(model?: string): ModelRouteConfig | null {
  if (!model) return null

  const routes = getConfiguredModelRoutes()
  const exact = routes[model]
  if (exact) return exact

  const lowerModel = model.toLowerCase()
  for (const [key, value] of Object.entries(routes)) {
    if (key.toLowerCase() === lowerModel) {
      return value
    }
  }

  for (const [key, value] of Object.entries(routes)) {
    const normalizedKey = key.toLowerCase()
    if (!normalizedKey.endsWith('*')) {
      continue
    }

    const prefix = normalizedKey.slice(0, -1)
    if (lowerModel.startsWith(prefix)) {
      return value
    }
  }

  return null
}
