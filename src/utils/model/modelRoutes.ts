import { logForDebugging } from '../debug.js'
import {
  getLikeCodeSettings,
  getLikeCodeSettingsWithSources,
} from '../settings/likecodeSettings.js'
import {
  getSettings_DEPRECATED,
  getSettingsFilePathForSource,
  getSettingsWithSources,
} from '../settings/settings.js'

export type ModelRouteConfig = {
  alias?: string | string[]
  baseURL?: string
  apiKey?: string
  authToken?: string
  headers?: Record<string, string>
  pricing?: {
    inputTokens?: number
    outputTokens?: number
    promptCacheWriteTokens?: number
    promptCacheReadTokens?: number
    webSearchRequests?: number
  }
}

export type ResolvedModelRouteConfig = ModelRouteConfig & {
  source?: string
}

function normalizeModelRoutes(
  routes: unknown,
  source?: string,
): Record<string, ResolvedModelRouteConfig> {
  if (!routes || typeof routes !== 'object' || Array.isArray(routes)) {
    return {}
  }

  const normalized: Record<string, ResolvedModelRouteConfig> = {}
  for (const [model, route] of Object.entries(routes)) {
    if (
      !model.trim() ||
      !route ||
      typeof route !== 'object' ||
      Array.isArray(route)
    ) {
      continue
    }
    normalized[model] = {
      ...(route as ModelRouteConfig),
      ...(source ? { source } : {}),
    }
  }
  return normalized
}

function parseEnvModelRoutes(): Record<string, ResolvedModelRouteConfig> {
  const raw =
    process.env.CLAUDE_CODE_MODEL_ROUTES_JSON ??
    process.env.LIKECODE_MODEL_ROUTES_JSON
  const source = process.env.CLAUDE_CODE_MODEL_ROUTES_JSON
    ? 'CLAUDE_CODE_MODEL_ROUTES_JSON'
    : 'LIKECODE_MODEL_ROUTES_JSON'

  if (!raw?.trim()) {
    return {}
  }

  try {
    return normalizeModelRoutes(JSON.parse(raw), source)
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

function getRouteAliases(route: ModelRouteConfig): string[] {
  const aliases = Array.isArray(route.alias)
    ? route.alias
    : route.alias
      ? [route.alias]
      : []
  return aliases.map(alias => alias.trim()).filter(Boolean)
}

function stripContextTag(model: string): {
  base: string
  suffix: string
} {
  const match = model.match(/(\[(1|2)m\])$/i)
  if (!match) {
    return { base: model.trim(), suffix: '' }
  }
  return {
    base: model.slice(0, -match[1].length).trim(),
    suffix: match[1],
  }
}

export function getModelRouteAliases(): Record<string, string> {
  const aliases: Record<string, string> = {}
  for (const [model, route] of Object.entries(getConfiguredModelRoutes())) {
    for (const alias of getRouteAliases(route)) {
      aliases[alias.toLowerCase()] = model
    }
  }
  return aliases
}

export function resolveModelRouteAlias(input: string): string | undefined {
  const { base, suffix } = stripContextTag(input)
  if (!base) return undefined

  const routes = getConfiguredModelRoutes()
  if (routes[input] || routes[base]) {
    return undefined
  }

  const lowerBase = base.toLowerCase()
  for (const routeModel of Object.keys(routes)) {
    if (routeModel.toLowerCase() === lowerBase) {
      return undefined
    }
  }

  const model = getModelRouteAliases()[lowerBase]
  return model ? `${model}${suffix}` : undefined
}

export function getConfiguredModelRouteDetails(): Record<
  string,
  ResolvedModelRouteConfig
> {
  const settingsRoutes = Object.assign(
    {},
    ...getSettingsWithSources().sources.map(({ source, settings }) =>
      normalizeModelRoutes(
        settings.modelRoutes,
        getSettingsFilePathForSource(source) ?? source,
      ),
    ),
  )
  const likeCodeRoutes = Object.assign(
    {},
    ...getLikeCodeSettingsWithSources().map(({ source, settings }) =>
      normalizeModelRoutes(settings.modelRoutes, source),
    ),
  )

  return {
    ...parseEnvModelRoutes(),
    ...settingsRoutes,
    ...likeCodeRoutes,
  }
}

export function getRouteForModel(model?: string): ModelRouteConfig | null {
  if (!model) return null

  const routes = getConfiguredModelRoutes()
  const routedModel = resolveModelRouteAlias(model) ?? model
  const modelWithoutContextTag = routedModel.replace(/\[(1|2)m\]$/i, '').trim()
  const exact = routes[routedModel] ?? routes[modelWithoutContextTag]
  if (exact) return exact

  const lowerModel = routedModel.toLowerCase()
  const lowerModelWithoutContextTag = modelWithoutContextTag.toLowerCase()
  for (const [key, value] of Object.entries(routes)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === lowerModel || lowerKey === lowerModelWithoutContextTag) {
      return value
    }
  }

  for (const [key, value] of Object.entries(routes)) {
    const normalizedKey = key.toLowerCase()
    if (!normalizedKey.endsWith('*')) {
      continue
    }

    const prefix = normalizedKey.slice(0, -1)
    if (
      lowerModel.startsWith(prefix) ||
      lowerModelWithoutContextTag.startsWith(prefix)
    ) {
      return value
    }
  }

  return null
}
