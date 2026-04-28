interface UsageEntry {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requests: number
  lastUsed: Date
}

export class CostTracker {
  private stats: Map<string, UsageEntry> = new Map()

  record(provider: string, model: string, usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined): void {
    const key = `${provider}:${model}`
    const existing = this.stats.get(key)
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

    if (existing) {
      existing.inputTokens += inputTokens
      existing.outputTokens += outputTokens
      existing.totalTokens += totalTokens
      existing.requests += 1
      existing.lastUsed = new Date()
    } else {
      this.stats.set(key, {
        provider,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        requests: 1,
        lastUsed: new Date(),
      })
    }
  }

  getStats(): UsageEntry[] {
    return Array.from(this.stats.values()).sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
  }

  getSummary(): { totalInput: number; totalOutput: number; totalRequests: number } {
    let totalInput = 0
    let totalOutput = 0
    let totalRequests = 0
    for (const entry of this.stats.values()) {
      totalInput += entry.inputTokens
      totalOutput += entry.outputTokens
      totalRequests += entry.requests
    }
    return { totalInput, totalOutput, totalRequests }
  }

  extractUsage(body: string): { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined {
    try {
      const parsed = JSON.parse(body)
      if (parsed.usage) {
        return {
          input_tokens: parsed.usage.input_tokens,
          output_tokens: parsed.usage.output_tokens,
          total_tokens: parsed.usage.total_tokens,
        }
      }
      if (typeof parsed.input_tokens === 'number') {
        return {
          input_tokens: parsed.input_tokens,
          output_tokens: parsed.output_tokens,
          total_tokens: parsed.total_tokens,
        }
      }
    } catch {
      // Not JSON or incomplete — skip
    }
    return undefined
  }
}
