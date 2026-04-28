export interface ModelRouteConfig {
  alias?: string | string[]
  baseURL?: string
  apiKey?: string
  authToken?: string
  headers?: Record<string, string>
  providerModelId?: string
  /** Reference to a named provider preset (e.g., "openrouter", "siliconflow") */
  preset?: string
}

export interface ResolvedRoute {
  model: string
  baseURL: string
  apiKey: string
  headers: Record<string, string>
  providerModelId?: string
}

export interface ProxyConfig {
  port: number
  host: string
  configPath: string
  configFiles: string[]
}

export interface RequestContext {
  method: string
  path: string
  body: unknown
  headers: Record<string, string>
}
