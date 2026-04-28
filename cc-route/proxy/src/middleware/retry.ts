export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  retryableStatusCodes: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
}

export function shouldRetry(status: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  return config.retryableStatusCodes.includes(status)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetryFn: (result: T) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn()
      if (!shouldRetryFn(result)) {
        return result
      }
      // Result indicates retryable condition
      if (attempt === config.maxRetries) {
        return result
      }
    } catch (err) {
      lastError = err as Error
      if (attempt === config.maxRetries) {
        throw lastError
      }
    }

    const delay = Math.min(
      config.baseDelayMs * Math.pow(2, attempt),
      config.maxDelayMs,
    )
    console.log(`[cc-route] Retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`)
    await sleep(delay)
  }

  throw lastError ?? new Error('Max retries exceeded')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
