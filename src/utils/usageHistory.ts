import type { BetaUsage as Usage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'fs'
import { dirname, join } from 'path'
import { getCwd } from './cwd.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { sanitizePath } from './path.js'

type UsageHistoryRecord = {
  timestamp: number
  date: string
  sessionId: string
  cwd: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
}

type UsageWithServerToolUse = Usage & {
  server_tool_use?: {
    web_search_requests?: number
  }
}

type ProjectJsonlUsage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  server_tool_use?: {
    web_search_requests?: number
  }
}

export type UsageAggregate = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
}

const EMPTY_AGGREGATE: UsageAggregate = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  webSearchRequests: 0,
  costUSD: 0,
}

let cachedSignature = ''
let cachedExcludeSessionId: string | undefined
let cachedCheckedAt = 0
let cachedSummary: { today: UsageAggregate; all: UsageAggregate } = {
  today: { ...EMPTY_AGGREGATE },
  all: { ...EMPTY_AGGREGATE },
}

function getUsageHistoryPath(): string {
  return join(getClaudeConfigHomeDir(), 'likecode_usage.jsonl')
}

function getProjectHistoryDir(): string {
  return join(getClaudeConfigHomeDir(), 'projects', sanitizePath(getCwd()))
}

function getLocalDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addAggregate(target: UsageAggregate, record: UsageHistoryRecord): void {
  target.inputTokens += record.inputTokens
  target.outputTokens += record.outputTokens
  target.cacheReadInputTokens += record.cacheReadInputTokens
  target.cacheCreationInputTokens += record.cacheCreationInputTokens
  target.webSearchRequests += record.webSearchRequests
  target.costUSD += record.costUSD
}

function getJsonlFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const result: string[] = []
  const visit = (dir: string) => {
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        result.push(fullPath)
      }
    }
  }
  visit(root)
  return result.sort()
}

function getHistorySignature(files: string[]): string {
  return files
    .map(file => {
      try {
        const stats = statSync(file)
        return `${file}:${stats.size}:${stats.mtimeMs}`
      } catch {
        return `${file}:missing`
      }
    })
    .join('|')
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function usageHasTokens(usage: ProjectJsonlUsage): boolean {
  return (
    toNumber(usage.input_tokens) +
      toNumber(usage.output_tokens) +
      toNumber(usage.cache_read_input_tokens) +
      toNumber(usage.cache_creation_input_tokens) >
    0
  )
}

function readProjectUsageRecord(line: string): UsageHistoryRecord | undefined {
  try {
    const entry = JSON.parse(line) as {
      timestamp?: string
      sessionId?: string
      cwd?: string
      message?: {
        role?: string
        model?: string
        usage?: ProjectJsonlUsage
      }
    }
    const usage = entry.message?.usage
    if (entry.message?.role !== 'assistant' || !usage || !usageHasTokens(usage)) {
      return undefined
    }
    const timestamp = Date.parse(entry.timestamp ?? '')
    const normalizedTimestamp = Number.isFinite(timestamp) ? timestamp : 0
    return {
      timestamp: normalizedTimestamp,
      date: getLocalDateKey(normalizedTimestamp || Date.now()),
      sessionId: String(entry.sessionId ?? ''),
      cwd: String(entry.cwd ?? ''),
      model: String(entry.message.model ?? ''),
      inputTokens: toNumber(usage.input_tokens),
      outputTokens: toNumber(usage.output_tokens),
      cacheReadInputTokens: toNumber(usage.cache_read_input_tokens),
      cacheCreationInputTokens: toNumber(usage.cache_creation_input_tokens),
      webSearchRequests: toNumber(usage.server_tool_use?.web_search_requests),
      costUSD: 0,
    }
  } catch {
    return undefined
  }
}

function readLikecodeUsageRecord(line: string): UsageHistoryRecord | undefined {
  try {
    const record = JSON.parse(line) as Partial<UsageHistoryRecord>
    if (
      typeof record.inputTokens !== 'number' ||
      typeof record.outputTokens !== 'number' ||
      typeof record.costUSD !== 'number'
    ) {
      return undefined
    }
    return {
      timestamp: Number(record.timestamp ?? 0),
      date: String(record.date ?? ''),
      sessionId: String(record.sessionId ?? ''),
      cwd: String(record.cwd ?? ''),
      model: String(record.model ?? ''),
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadInputTokens: Number(record.cacheReadInputTokens ?? 0),
      cacheCreationInputTokens: Number(record.cacheCreationInputTokens ?? 0),
      webSearchRequests: Number(record.webSearchRequests ?? 0),
      costUSD: record.costUSD,
    }
  } catch {
    return undefined
  }
}

export function recordUsageHistory(
  costUSD: number,
  usage: Usage,
  model: string,
  sessionId: string,
): void {
  const timestamp = Date.now()
  const serverToolUse = (usage as UsageWithServerToolUse).server_tool_use
  const record: UsageHistoryRecord = {
    timestamp,
    date: getLocalDateKey(timestamp),
    sessionId,
    cwd: getCwd(),
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    webSearchRequests: serverToolUse?.web_search_requests ?? 0,
    costUSD,
  }

  try {
    const filePath = getUsageHistoryPath()
    mkdirSync(dirname(filePath), { recursive: true })
    appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8')
  } catch {
    // Usage history is HUD-only; API accounting must never fail because of it.
  }
}

export function getUsageHistorySummary(options?: {
  excludeSessionId?: string
}): {
  today: UsageAggregate
  all: UsageAggregate
} {
  const projectFiles = getJsonlFiles(getProjectHistoryDir())
  const likecodeUsagePath = getUsageHistoryPath()
  const files = existsSync(likecodeUsagePath)
    ? [...projectFiles, likecodeUsagePath]
    : projectFiles

  if (files.length === 0) {
    cachedSignature = ''
    cachedExcludeSessionId = options?.excludeSessionId
    cachedSummary = {
      today: { ...EMPTY_AGGREGATE },
      all: { ...EMPTY_AGGREGATE },
    }
    return cachedSummary
  }

  const now = Date.now()
  if (
    cachedExcludeSessionId === options?.excludeSessionId &&
    now - cachedCheckedAt < 5000
  ) {
    return cachedSummary
  }

  const signature = getHistorySignature(files)
  if (
    signature === cachedSignature &&
    cachedExcludeSessionId === options?.excludeSessionId
  ) {
    cachedCheckedAt = now
    return cachedSummary
  }

  const todayKey = getLocalDateKey()
  const today = { ...EMPTY_AGGREGATE }
  const all = { ...EMPTY_AGGREGATE }
  const projectSessionIds = new Set<string>()

  for (const filePath of projectFiles) {
    for (const line of readFileSync(filePath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      const record = readProjectUsageRecord(line)
      if (!record) continue
      if (record.sessionId) projectSessionIds.add(record.sessionId)
      if (
        options?.excludeSessionId &&
        record.sessionId === options.excludeSessionId
      ) {
        continue
      }
      addAggregate(all, record)
      if (record.date === todayKey) {
        addAggregate(today, record)
      }
    }
  }

  if (existsSync(likecodeUsagePath)) {
    for (const line of readFileSync(likecodeUsagePath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      const record = readLikecodeUsageRecord(line)
      if (!record || projectSessionIds.has(record.sessionId)) continue
      if (
        options?.excludeSessionId &&
        record.sessionId === options.excludeSessionId
      ) {
        continue
      }
      addAggregate(all, record)
      if (record.date === todayKey) {
        addAggregate(today, record)
      }
    }
  }

  cachedSignature = signature
  cachedExcludeSessionId = options?.excludeSessionId
  cachedCheckedAt = now
  cachedSummary = { today, all }
  return cachedSummary
}
