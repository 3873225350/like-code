/**
 * WebSocket gateway for cc-route-proxy.
 *
 * Provides an alternative real-time streaming interface:
 *   ws://host:port/v1/stream
 *
 * Protocol:
 *   Client sends JSON: { "model": "mm25", "messages": [...], "max_tokens": 1024 }
 *   Server streams back SSE-style events as WebSocket text frames:
 *     { "type": "content_block_delta", "delta": { "type": "text_delta", "text": "..." } }
 *     { "type": "message_stop" }
 *
 * This is useful for:
 *   - Browser-based clients that prefer WebSocket over EventSource
 *   - Mobile apps with poor HTTP/1.1 keep-alive behavior
 *   - Load balancers that terminate SSE poorly but handle WS well
 */

import { type Server } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import type { ConfigManager } from '../config.js'
import { Router } from '../router.js'
import { pooledFetch } from './httpAgent.js'
import { CostTracker } from './costTracker.js'
import { recordTokenUsage } from './metrics.js'

interface WSMessage {
  model: string
  messages: Array<{ role: string; content: string }>
  max_tokens?: number
  stream?: boolean
  [key: string]: unknown
}

export function attachWebSocket(
  httpServer: Server,
  config: ConfigManager,
  costTracker: CostTracker,
): void {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/v1/stream',
  })

  const router = new Router(config)

  wss.on('connection', (ws: WebSocket, req) => {
    console.log(`[cc-route] WebSocket connection from ${req.socket.remoteAddress}`)

    ws.on('message', async (data) => {
      let requestBody: WSMessage
      try {
        requestBody = JSON.parse(data.toString()) as WSMessage
      } catch {
        sendError(ws, 'Invalid JSON in request body')
        return
      }

      if (!requestBody.model) {
        sendError(ws, 'Missing "model" field')
        return
      }

      const route = router.resolve({
        method: 'POST',
        path: '/v1/messages',
        body: requestBody,
        headers: {},
      })

      if (!route) {
        sendError(ws, `No route found for model "${requestBody.model}"`)
        return
      }

      const rewrittenBody = router.rewriteBody(requestBody as Record<string, unknown>, route)
      const targetUrl = `${route.baseURL}/v1/messages`

      try {
        const response = await pooledFetch(targetUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${route.apiKey}`,
            'Content-Type': 'application/json',
            ...route.headers,
          },
          body: rewrittenBody,
        })

        if (!response.ok) {
          const errBody = await response.text().catch(() => 'Unknown error')
          sendError(ws, `Upstream error ${response.status}: ${errBody}`)
          return
        }

        if (!response.body) {
          sendError(ws, 'Empty response body from upstream')
          return
        }

        // Stream response through WebSocket
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let usageData: Record<string, unknown> | undefined

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue

              // SSE format: "data: {...}"
              if (trimmed.startsWith('data: ')) {
                const payload = trimmed.slice(6)
                if (payload === '[DONE]') {
                  ws.send(JSON.stringify({ type: 'message_stop' }))
                  continue
                }

                try {
                  const parsed = JSON.parse(payload)
                  // Extract usage from final message if present
                  if (parsed.usage) {
                    usageData = parsed.usage as Record<string, unknown>
                  }
                  ws.send(payload)
                } catch {
                  // Non-JSON SSE line — forward as-is
                  ws.send(JSON.stringify({ type: 'raw', data: payload }))
                }
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const trimmed = buffer.trim()
            if (trimmed.startsWith('data: ')) {
              const payload = trimmed.slice(6)
              if (payload !== '[DONE]') {
                ws.send(payload)
              }
            }
          }

          // Track usage
          if (usageData) {
            recordTokenUsage(route.baseURL, route.model, {
              input_tokens: typeof usageData.input_tokens === 'number' ? usageData.input_tokens : undefined,
              output_tokens: typeof usageData.output_tokens === 'number' ? usageData.output_tokens : undefined,
              total_tokens: typeof usageData.total_tokens === 'number' ? usageData.total_tokens : undefined,
            })
          }

          ws.send(JSON.stringify({ type: 'message_stop' }))
        } finally {
          reader.releaseLock()
        }
      } catch (err) {
        const msg = (err as Error).message
        console.error('[cc-route] WebSocket proxy error:', msg)
        sendError(ws, `Proxy error: ${msg}`)
      }
    })

    ws.on('close', () => {
      console.log('[cc-route] WebSocket connection closed')
    })

    ws.on('error', (err) => {
      console.error('[cc-route] WebSocket error:', err.message)
    })
  })

  console.log('[cc-route] WebSocket gateway enabled at ws://host:port/v1/stream')
}

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'error', error: { message } }))
  }
}
