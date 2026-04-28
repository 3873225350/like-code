export interface ModelRouteConfig {
  alias?: string | string[];
  baseURL?: string;
  apiKey?: string;
  authToken?: string;
  headers?: Record<string, string>;
  providerModelId?: string;
}

export interface AppConfig {
  modelRoutes: Record<string, ModelRouteConfig>;
  port?: number;
  host?: string;
  autoStart?: boolean;
}
