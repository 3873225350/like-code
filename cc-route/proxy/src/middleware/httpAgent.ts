/**
 * Shared HTTP agent with connection pooling and keep-alive.
 *
 * Node.js 22's fetch() uses undici under the hood. We configure a custom
 * dispatcher to enable HTTP/2 (experimental) and connection pooling for
 * better throughput when proxying to multiple providers.
 */

import { Agent, Pool } from 'undici'

// Per-origin connection pools to avoid recreating connections
const pools = new Map<string, Pool>()

/** Get or create a connection pool for a given origin */
export function getPool(origin: string): Pool {
  const existing = pools.get(origin)
  if (existing) return existing

  const pool = new Pool(origin, {
    connections: 128,           // Max concurrent connections per origin
    keepAliveTimeout: 30000,    // Keep-alive idle timeout (ms)
    keepAliveMaxTimeout: 600000, // Max keep-alive duration (ms)
    connect: {
      rejectUnauthorized: true,
    },
  })

  pools.set(origin, pool)
  return pool
}

/** Global undici Agent for fetch() — enables HTTP/2 and pooling */
export const globalDispatcher = new Agent({
  connect: {
    rejectUnauthorized: true,
  },
  // Enable HTTP/2 (Node.js 22+ experimental)
  allowH2: true,
})

/** Fetch wrapper that uses pooled connections */
export async function pooledFetch(url: string, init?: RequestInit): Promise<Response> {
  const parsed = new URL(url)
  const origin = `${parsed.protocol}//${parsed.host}`
  const pool = getPool(origin)

  // undici's fetch accepts a dispatcher option
  return fetch(url, {
    ...init,
    dispatcher: pool,
  } as RequestInit)
}

/** Close all pools gracefully */
export function closeAllPools(): void {
  for (const [origin, pool] of pools) {
    pool.close().catch((err: Error) => {
      console.error(`[cc-route] Error closing pool ${origin}:`, err.message)
    })
  }
  pools.clear()
}
