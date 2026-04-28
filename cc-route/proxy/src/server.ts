import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import type { ConfigManager } from './config.js'
import { Router } from './router.js'
import { CostTracker } from './middleware/costTracker.js'
import { FallbackRouter } from './middleware/fallback.js'
import { withRetry, shouldRetry, DEFAULT_RETRY_CONFIG } from './middleware/retry.js'
import { pooledFetch, closeAllPools } from './middleware/httpAgent.js'
import {
  register,
  proxyActiveRequests,
  proxyRetriesTotal,
  proxyFallbacksTotal,
  recordTokenUsage,
  trackRequest,
} from './middleware/metrics.js'
import { attachWebSocket } from './middleware/websocket.js'
import type { RequestContext, ResolvedRoute } from './types/index.js'

export function startServer(config: ConfigManager, port: number, host: string): void {
  const router = new Router(config)
  const costTracker = new CostTracker()
  const fallbackRouter = FallbackRouter.fromConfig(config.routes)

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = req.url ?? '/'
    const method = req.method ?? 'GET'

    console.log(`[cc-route] ${method} ${path}`)

    // Prometheus metrics endpoint
    if (path === '/metrics' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': register.contentType })
      res.end(await register.metrics())
      return
    }

    // Admin endpoint: usage stats
    if (path === '/v1/admin/usage' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        summary: costTracker.getSummary(),
        details: costTracker.getStats(),
      }))
      return
    }

    // Handle model list endpoint
    if (path === '/v1/models' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        object: 'list',
        data: config.listModels(),
      }))
      return
    }

    // Collect body
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const bodyRaw = Buffer.concat(chunks).toString('utf-8')
    let body: unknown
    try {
      body = bodyRaw ? JSON.parse(bodyRaw) : {}
    } catch {
      body = {}
    }

    const context: RequestContext = {
      method,
      path,
      body,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([, v]) => typeof v === 'string') as [string, string][]
      ),
    }

    const route = router.resolve(context)

    if (!route) {
      const targetBase = process.env.ANTHROPIC_BASE_URL_FALLBACK ?? 'https://api.anthropic.com'
      await proxyRequest(req, res, bodyRaw, targetBase, {}, costTracker, null, 'anthropic')
      return
    }

    const rewrittenBody = typeof body === 'object' && body !== null
      ? router.rewriteBody(body as Record<string, unknown>, route)
      : bodyRaw

    const forwardHeaders = buildForwardHeaders(context, route)
    const targetUrl = `${route.baseURL}${path}`

    console.log(`[cc-route] → ${targetUrl} (model: ${route.model})`)

    // Attempt primary route with retry
    const provider = extractProviderName(route.baseURL)
    const primaryResult = await trackRequest(
      () => tryRoute(req, res, rewrittenBody, targetUrl, forwardHeaders, costTracker, route, provider),
      { method, path, provider, model: route.model },
    )

    if (!primaryResult.success && primaryResult.status && shouldRetry(primaryResult.status)) {
      const fallbackModel = fallbackRouter.getFallback(route.model)
      if (fallbackModel) {
        proxyFallbacksTotal.inc({ from_model: route.model, to_model: fallbackModel })
        const fallbackRoute = config.getRoute(fallbackModel)
        if (fallbackRoute?.baseURL) {
          console.log(`[cc-route] Fallback: ${route.model} → ${fallbackModel}`)
          const fbProvider = extractProviderName(fallbackRoute.baseURL)
          const fbHeaders = buildForwardHeaders(context, {
            model: fallbackModel,
            baseURL: fallbackRoute.baseURL,
            apiKey: fallbackRoute.authToken ?? fallbackRoute.apiKey ?? '',
            headers: {},
          })
          const fbBody = typeof body === 'object' && body !== null
            ? JSON.stringify({ ...(body as Record<string, unknown>), model: fallbackModel })
            : bodyRaw
          await trackRequest(
            () => proxyRequest(req, res, fbBody, `${fallbackRoute.baseURL}${path}`, fbHeaders, costTracker, {
              provider: fallbackRoute.baseURL ?? '',
              model: fallbackModel,
            }, fbProvider),
            { method, path, provider: fbProvider, model: fallbackModel },
          )
          return
        }
      }
    }

    // If primary failed and no fallback, return the primary error response
    if (!primaryResult.success && primaryResult.responseBody) {
      res.writeHead(primaryResult.status ?? 502, { 'Content-Type': 'application/json' })
      res.end(primaryResult.responseBody)
      return
    }
  })

  server.listen(port, host, () => {
    console.log(`[cc-route] Proxy listening on http://${host}:${port}`)
    console.log(`[cc-route] Routes: ${Object.keys(config.routes).join(', ') || '(none)'}`)
    console.log(`[cc-route] Usage dashboard: http://${host}:${port}/v1/admin/usage`)
    console.log(`[cc-route] Metrics: http://${host}:${port}/metrics`)
    console.log(`[cc-route] WebSocket: ws://${host}:${port}/v1/stream`)
    console.log(`[cc-route] HTTP/2 + connection pooling enabled`)
  })

  // Attach WebSocket gateway
  attachWebSocket(server, config, costTracker)

  // Graceful shutdown
  const shutdown = () => {
    console.log('[cc-route] Shutting down gracefully...')
    closeAllPools()
    server.close(() => {
      process.exit(0)
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

function buildForwardHeaders(context: RequestContext, route: ResolvedRoute | { model: string; baseURL: string; apiKey: string; headers: Record<string, string> }): Record<string, string> {
  const forwardHeaders: Record<string, string> = {}

  for (const [key, value] of Object.entries(context.headers)) {
    const lower = key.toLowerCase()
    if (lower === 'authorization' || lower === 'content-type' || lower === 'content-length' || lower === 'host' || lower === 'connection') {
      continue
    }
    forwardHeaders[key] = value
  }

  for (const [key, value] of Object.entries(route.headers)) {
    forwardHeaders[key] = value
  }

  // Use apiKey only if route headers didn't already provide Authorization
  if (!forwardHeaders['Authorization'] && !forwardHeaders['authorization']) {
    const authToken = 'apiKey' in route ? route.apiKey : undefined
    if (authToken) {
      forwardHeaders['Authorization'] = `Bearer ${authToken}`
    }
  }

  return forwardHeaders
}

function extractProviderName(baseURL: string): string {
  try {
    return new URL(baseURL).host
  } catch {
    return baseURL
  }
}

interface RouteResult {
  success: boolean
  status?: number
  responseBody?: string
}

async function tryRoute(
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
  targetUrl: string,
  headers: Record<string, string>,
  costTracker: CostTracker,
  route: ResolvedRoute | null,
  provider: string,
): Promise<RouteResult> {
  let retryCount = 0

  try {
    const response = await withRetry(
      async () => {
        const fetchInit: RequestInit = {
          method: req.method,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
          },
          body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
        }
        return pooledFetch(targetUrl, fetchInit)
      },
      (response) => {
        const should = shouldRetry(response.status)
        if (should && route) {
          retryCount++
          proxyRetriesTotal.inc({ provider, model: route.model })
        }
        return should
      },
      DEFAULT_RETRY_CONFIG,
    )

    // Stream response back
    res.writeHead(response.status, response.statusText, Object.fromEntries(response.headers))

    const responseChunks: Buffer[] = []
    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
        responseChunks.push(Buffer.from(value))
      }
    }
    res.end()

    // Track cost if possible
    const fullBody = Buffer.concat(responseChunks).toString('utf-8')
    const usage = costTracker.extractUsage(fullBody)
    if (route && usage) {
      costTracker.record(route.baseURL, route.model, usage)
      recordTokenUsage(provider, route.model, usage)
    }

    return { success: response.status < 400, status: response.status }
  } catch (err) {
    const msg = (err as Error).message
    console.error('[cc-route] Route error:', msg)
    return { success: false, status: 502, responseBody: JSON.stringify({ error: { type: 'proxy_error', message: msg } }) }
  }
}

async function proxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
  targetUrl: string,
  headers: Record<string, string>,
  costTracker: CostTracker,
  route: { provider: string; model: string } | null,
  provider: string,
): Promise<void> {
  try {
    const fetchInit: RequestInit = {
      method: req.method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    }

    const response = await pooledFetch(targetUrl, fetchInit)

    res.writeHead(response.status, response.statusText, Object.fromEntries(response.headers))

    const responseChunks: Buffer[] = []
    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
        responseChunks.push(Buffer.from(value))
      }
    }
    res.end()

    const fullBody = Buffer.concat(responseChunks).toString('utf-8')
    const usage = costTracker.extractUsage(fullBody)
    if (route && usage) {
      costTracker.record(route.provider, route.model, usage)
      recordTokenUsage(provider, route.model, usage)
    }
  } catch (err) {
    const msg = (err as Error).message + '\n' + ((err as Error).stack ?? '')
    console.error('[cc-route] Proxy error:', msg)
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: {
        type: 'proxy_error',
        message: (err as Error).message,
        target_url: targetUrl,
      },
    }))
  }
}
