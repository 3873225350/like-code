/**
 * Token-bucket rate limiter per provider/model for cc-route-proxy.
 *
 * Configurable via environment variables:
 *   CC_RATE_LIMIT_RPS=10          # Default requests per second
 *   CC_RATE_LIMIT_BURST=20        # Default burst capacity
 *   CC_RATE_LIMIT_PROVIDER_*      # Per-provider overrides
 *
 * Examples:
 *   CC_RATE_LIMIT_PROVIDER_OPENROUTER_RPS=60
 *   CC_RATE_LIMIT_PROVIDER_OPENROUTER_BURST=100
 *   CC_RATE_LIMIT_PROVIDER_DEEPSEEK_RPS=5
 */

interface Bucket {
  tokens: number
  lastRefill: number
}

interface RateLimitConfig {
  rps: number
  burst: number
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private configs = new Map<string, RateLimitConfig>()
  private defaultConfig: RateLimitConfig

  constructor() {
    this.defaultConfig = {
      rps: parseFloat(process.env.CC_RATE_LIMIT_RPS ?? '10'),
      burst: parseFloat(process.env.CC_RATE_LIMIT_BURST ?? '20'),
    }

    // Parse per-provider overrides from environment
    for (const [key, value] of Object.entries(process.env)) {
      const match = key.match(/^CC_RATE_LIMIT_PROVIDER_(.+)_RPS$/i)
      if (match && value) {
        const provider = match[1].toLowerCase()
        const burstKey = `CC_RATE_LIMIT_PROVIDER_${match[1]}_BURST`
        const burst = parseFloat(process.env[burstKey] ?? String(this.defaultConfig.burst))
        this.configs.set(provider, { rps: parseFloat(value), burst })
        console.log(`[cc-route] Rate limit for ${provider}: ${value} rps, burst ${burst}`)
      }
    }
  }

  /** Check if a request is allowed. Returns { allowed, retryAfterMs } */
  check(provider: string, model?: string): { allowed: boolean; retryAfterMs?: number } {
    const key = model ? `${provider}:${model}` : provider
    const config = this.configs.get(provider.toLowerCase()) ?? this.defaultConfig

    const now = Date.now()
    let bucket = this.buckets.get(key)

    if (!bucket) {
      bucket = { tokens: config.burst - 1, lastRefill: now }
      this.buckets.set(key, bucket)
      return { allowed: true }
    }

    // Refill tokens based on elapsed time
    const elapsedMs = now - bucket.lastRefill
    const tokensToAdd = (elapsedMs / 1000) * config.rps
    bucket.tokens = Math.min(config.burst, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true }
    }

    // Calculate retry-after
    const deficit = 1 - bucket.tokens
    const retryAfterMs = Math.ceil((deficit / config.rps) * 1000)

    return { allowed: false, retryAfterMs }
  }

  /** Convenience: check and return HTTP status code if limited */
  checkHTTP(provider: string, model?: string): { limited: boolean; status?: number; headers?: Record<string, string>; body?: string } {
    const result = this.check(provider, model)
    if (result.allowed) {
      return { limited: false }
    }

    const retryAfterSeconds = Math.ceil((result.retryAfterMs ?? 1000) / 1000)
    return {
      limited: true,
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
      body: JSON.stringify({
        error: {
          type: 'rate_limit_error',
          message: `Rate limit exceeded for ${provider}. Retry after ${retryAfterSeconds}s.`,
          retry_after: retryAfterSeconds,
        },
      }),
    }
  }

  getStats(): Array<{ key: string; tokens: number; rps: number; burst: number }> {
    const result: Array<{ key: string; tokens: number; rps: number; burst: number }> = []
    for (const [key, bucket] of this.buckets) {
      const provider = key.split(':')[0] ?? key
      const config = this.configs.get(provider.toLowerCase()) ?? this.defaultConfig
      result.push({ key, tokens: Math.round(bucket.tokens * 100) / 100, rps: config.rps, burst: config.burst })
    }
    return result
  }
}
