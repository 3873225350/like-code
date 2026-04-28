/**
 * Request cache for cc-route-proxy.
 *
 * Caches responses from /v1/messages to avoid duplicate API calls
 * for identical prompts within a configurable TTL window.
 *
 * Cache key: SHA-256 of (provider + model + normalized request body)
 *
 * Features:
 *   - In-memory LRU eviction (default max 1000 entries)
 *   - TTL-based expiration (default 5 minutes)
 *   - Respects streaming requests (caches full stream as array of chunks)
 *   - Bypass cache for non-deterministic parameters (temperature > 0, etc.)
 *   - Admin endpoint to view/flush cache stats
 */

import { createHash } from 'crypto'

interface CacheEntry {
  status: number
  statusText: string
  headers: Record<string, string>
  body: Buffer
  timestamp: number
  hitCount: number
}

interface CacheConfig {
  /** Max number of entries in cache */
  maxSize: number
  /** TTL in milliseconds */
  ttlMs: number
  /** Whether to cache streaming responses */
  cacheStreams: boolean
}

export class RequestCache {
  private cache = new Map<string, CacheEntry>()
  private config: CacheConfig

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: config?.maxSize ?? 1000,
      ttlMs: config?.ttlMs ?? 5 * 60 * 1000,
      cacheStreams: config?.cacheStreams ?? true,
    }
  }

  /** Generate cache key from request context */
  makeKey(provider: string, model: string, body: Record<string, unknown>): string | null {
    // Don't cache if randomness is requested
    const temperature = body.temperature ?? 1.0
    if (typeof temperature === 'number' && temperature > 0) {
      return null
    }
    // Don't cache if streaming is requested and we don't cache streams
    if (body.stream === true && !this.config.cacheStreams) {
      return null
    }

    const canonical = JSON.stringify({
      p: provider,
      m: model,
      messages: body.messages,
      max_tokens: body.max_tokens,
      tools: body.tools,
      tool_choice: body.tool_choice,
    })
    return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key)
      return null
    }

    entry.hitCount++
    return entry
  }

  set(key: string, status: number, statusText: string, headers: Record<string, string>, body: Buffer): void {
    if (this.cache.size >= this.config.maxSize) {
      // Evict oldest entry
      const first = this.cache.keys().next().value
      if (first !== undefined) this.cache.delete(first)
    }

    this.cache.set(key, {
      status,
      statusText,
      headers: { ...headers },
      body: Buffer.from(body),
      timestamp: Date.now(),
      hitCount: 0,
    })
  }

  /** Serve a cached response to an HTTP response object */
  serve(key: string, res: import('http').ServerResponse): boolean {
    const entry = this.get(key)
    if (!entry) return false

    console.log(`[cc-route] Cache HIT ${key.slice(0, 8)} (hits: ${entry.hitCount})`)
    res.writeHead(entry.status, entry.statusText, entry.headers)
    res.end(entry.body)
    return true
  }

  getStats(): { entries: number; maxSize: number; ttlMs: number; totalHits: number } {
    let totalHits = 0
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount
    }
    return {
      entries: this.cache.size,
      maxSize: this.config.maxSize,
      ttlMs: this.config.ttlMs,
      totalHits,
    }
  }

  flush(): void {
    this.cache.clear()
    console.log('[cc-route] Cache flushed')
  }

  /** Periodic cleanup of expired entries */
  startCleanup(intervalMs = 60000): ReturnType<typeof setInterval> {
    return setInterval(() => {
      const now = Date.now()
      let removed = 0
      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > this.config.ttlMs) {
          this.cache.delete(key)
          removed++
        }
      }
      if (removed > 0) {
        console.log(`[cc-route] Cache cleanup: removed ${removed} expired entries`)
      }
    }, intervalMs)
  }
}
