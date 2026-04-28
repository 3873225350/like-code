/**
 * Prometheus metrics collection for cc-route-proxy.
 *
 * Exposes /metrics endpoint with:
 *   - http_requests_total        (counter, labeled by method, path, provider, model, status)
 *   - http_request_duration_ms   (histogram, same labels)
 *   - proxy_tokens_total         (counter, labeled by provider, model, direction)
 *   - proxy_active_requests      (gauge)
 *   - proxy_retries_total        (counter, labeled by provider, model)
 *   - proxy_fallbacks_total      (counter, labeled by from_model, to_model)
 *   - proxy_pool_connections     (gauge, labeled by origin)
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'

export const register = new Registry()

// Enable Node.js default metrics (GC, memory, event loop, etc.)
collectDefaultMetrics({ register })

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests processed by the proxy',
  labelNames: ['method', 'path', 'provider', 'model', 'status'],
  registers: [register],
})

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'path', 'provider', 'model', 'status'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [register],
})

export const proxyTokensTotal = new Counter({
  name: 'proxy_tokens_total',
  help: 'Total tokens processed through the proxy',
  labelNames: ['provider', 'model', 'direction'], // direction: input | output
  registers: [register],
})

export const proxyActiveRequests = new Gauge({
  name: 'proxy_active_requests',
  help: 'Number of requests currently being processed',
  registers: [register],
})

export const proxyRetriesTotal = new Counter({
  name: 'proxy_retries_total',
  help: 'Total retry attempts',
  labelNames: ['provider', 'model'],
  registers: [register],
})

export const proxyFallbacksTotal = new Counter({
  name: 'proxy_fallbacks_total',
  help: 'Total fallback routing events',
  labelNames: ['from_model', 'to_model'],
  registers: [register],
})

export const proxyPoolConnections = new Gauge({
  name: 'proxy_pool_connections',
  help: 'Active connections in the HTTP agent pool',
  labelNames: ['origin', 'state'], // state: active | idle | pending
  registers: [register],
})

/** Record token usage from a response body */
export function recordTokenUsage(
  provider: string,
  model: string,
  usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined,
): void {
  if (!usage) return
  if (usage.input_tokens) {
    proxyTokensTotal.inc({ provider, model, direction: 'input' }, usage.input_tokens)
  }
  if (usage.output_tokens) {
    proxyTokensTotal.inc({ provider, model, direction: 'output' }, usage.output_tokens)
  }
  if (usage.total_tokens && !usage.input_tokens && !usage.output_tokens) {
    // Fallback: split total 50/50 if breakdown not available
    proxyTokensTotal.inc({ provider, model, direction: 'input' }, Math.floor(usage.total_tokens / 2))
    proxyTokensTotal.inc({ provider, model, direction: 'output' }, Math.ceil(usage.total_tokens / 2))
  }
}

/** Helper to track request lifecycle */
export function trackRequest<T>(
  fn: () => Promise<T>,
  labels: { method: string; path: string; provider: string; model: string },
): Promise<T> {
  const start = Date.now()
  proxyActiveRequests.inc()

  const finish = (status: string) => {
    const duration = Date.now() - start
    proxyActiveRequests.dec()
    httpRequestsTotal.inc({ ...labels, status })
    httpRequestDuration.observe({ ...labels, status }, duration)
  }

  return fn()
    .then((result) => {
      finish('success')
      return result
    })
    .catch((err) => {
      finish('error')
      throw err
    })
}
