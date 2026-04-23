import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { ToolUseContext } from '../../Tool.js'
import {
  getConfiguredModelRoutes,
  getModelRouteAliases,
  resolveModelRouteAlias,
} from '../../utils/model/modelRoutes.js'

type DetectedAlias = {
  alias: string
  model: string
}

type ModelAssignment = {
  alias: string
  model: string
  role: string
  mode: 'worker' | 'monitor' | 'reviewer'
  readonly: boolean
}

type ParsedMModelDsl = {
  assignments: ModelAssignment[]
  detectedAliases: DetectedAlias[]
  task?: string
  dir?: string
  readonlyAliases: string[]
  freeform: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function aliasPattern(alias: string): RegExp {
  return new RegExp(
    `(^|[^A-Za-z0-9_.-])(${escapeRegExp(alias)})(?=$|[^A-Za-z0-9_.-])`,
    'i',
  )
}

function getAliasDisplayList(): string {
  const aliases = getModelRouteAliases()
  const entries = Object.entries(aliases).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  if (entries.length === 0) {
    return '(no configured model route aliases)'
  }
  return entries.map(([alias, model]) => `- ${alias}: ${model}`).join('\n')
}

function detectAliases(args: string): DetectedAlias[] {
  const aliases = getModelRouteAliases()
  const detected: DetectedAlias[] = []
  const seen = new Set<string>()

  for (const [alias, model] of Object.entries(aliases)) {
    if (!aliasPattern(alias).test(args)) {
      continue
    }
    const key = alias.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    detected.push({ alias, model })
  }

  return detected.sort((a, b) => a.alias.localeCompare(b.alias))
}

function tokenizeArgs(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | '`' | undefined

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!
    if (quote) {
      if (char === quote) {
        quote = undefined
      } else {
        current += char
      }
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += char
  }

  if (current) {
    tokens.push(current)
  }
  return tokens
}

function splitCommaList(value: string): string[] {
  return value
    .split(/[,\uFF0C]/)
    .map(v => v.trim())
    .filter(Boolean)
}

function normalizeAliasKey(value: string): string {
  return value.trim().toLowerCase()
}

function classifyRole(role: string): ModelAssignment['mode'] {
  const lower = role.toLowerCase()
  if (
    lower.includes('monitor') ||
    lower.includes('watch') ||
    lower.includes('observe') ||
    role.includes('监视') ||
    role.includes('监控') ||
    role.includes('观察')
  ) {
    return 'monitor'
  }
  if (
    lower.includes('review') ||
    lower.includes('verify') ||
    lower.includes('check') ||
    lower.includes('test') ||
    role.includes('审查') ||
    role.includes('审核') ||
    role.includes('复查') ||
    role.includes('检查') ||
    role.includes('测试')
  ) {
    return 'reviewer'
  }
  return 'worker'
}

function roleImpliesReadonly(role: string): boolean {
  const lower = role.toLowerCase()
  return (
    lower.includes('readonly') ||
    lower.includes('read-only') ||
    lower.includes('do not edit') ||
    lower.includes('no edit') ||
    lower.includes('monitor') ||
    lower.includes('review') ||
    role.includes('只读') ||
    role.includes('不改') ||
    role.includes('不要改') ||
    role.includes('监视') ||
    role.includes('监控') ||
    role.includes('审查') ||
    role.includes('审核') ||
    role.includes('复查')
  )
}

function takeFlagValue(
  tokens: string[],
  index: number,
): { value: string; nextIndex: number } {
  const token = tokens[index]!
  const equalIndex = token.indexOf('=')
  if (equalIndex >= 0) {
    return { value: token.slice(equalIndex + 1), nextIndex: index + 1 }
  }

  const values: string[] = []
  let nextIndex = index + 1
  while (nextIndex < tokens.length && !tokens[nextIndex]!.startsWith('--')) {
    values.push(tokens[nextIndex]!)
    nextIndex++
  }
  return { value: values.join(' '), nextIndex }
}

function parseMModelDsl(args: string): ParsedMModelDsl {
  const tokens = tokenizeArgs(args)
  const aliases = getModelRouteAliases()
  const detectedAliases = detectAliases(args)
  const readonlyAliases = new Set<string>()
  const assignmentsByAlias = new Map<string, ModelAssignment>()
  const freeformTokens: string[] = []
  let task: string | undefined
  let dir: string | undefined

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i]!

    if (token.startsWith('--')) {
      const flagName = token.split('=')[0]!.toLowerCase()
      const { value, nextIndex } = takeFlagValue(tokens, i)

      if (flagName === '--task' || flagName === '--goal') {
        task = value || undefined
      } else if (
        flagName === '--dir' ||
        flagName === '--cwd' ||
        flagName === '--path'
      ) {
        dir = value || undefined
      } else if (flagName === '--readonly' || flagName === '--read-only') {
        for (const alias of splitCommaList(value)) {
          readonlyAliases.add(normalizeAliasKey(alias))
        }
      } else {
        freeformTokens.push(token)
        if (value) freeformTokens.push(value)
      }
      i = nextIndex
      continue
    }

    const assignmentMatch = token.match(/^([^:=\uFF1A]+)[:=\uFF1A](.+)$/)
    if (assignmentMatch) {
      const rawAlias = assignmentMatch[1]!.trim()
      const role = assignmentMatch[2]!.trim()
      const canonicalModel = resolveModelRouteAlias(rawAlias)
      const aliasKey = normalizeAliasKey(rawAlias)
      const configuredAlias = Object.keys(aliases).find(
        alias => normalizeAliasKey(alias) === aliasKey,
      )

      if (canonicalModel && configuredAlias && role) {
        assignmentsByAlias.set(aliasKey, {
          alias: configuredAlias,
          model: canonicalModel,
          role,
          mode: classifyRole(role),
          readonly: roleImpliesReadonly(role),
        })
        i++
        continue
      }
    }

    freeformTokens.push(token)
    i++
  }

  for (const readonlyAlias of readonlyAliases) {
    const assignment = assignmentsByAlias.get(readonlyAlias)
    if (assignment) {
      assignment.readonly = true
    }
  }

  return {
    assignments: [...assignmentsByAlias.values()],
    detectedAliases,
    task,
    dir,
    readonlyAliases: [...readonlyAliases],
    freeform: freeformTokens.join(' ').trim(),
  }
}

function buildNoAliasPrompt(args: string): string {
  return `The user invoked /mmodel, but no configured model route aliases were detected in the request.

Available model route aliases:
${getAliasDisplayList()}

User request:
${args || '(empty)'}

Continue with the current model. Briefly explain that /mmodel expects configured aliases such as "mm7" or "g5", list the available aliases above, and ask the user to restate the multi-model assignment.`
}

function buildDetectedAliasPrompt(
  args: string,
  detectedAliases: DetectedAlias[],
): string {
  const aliasLines = detectedAliases
    .map(({ alias, model }) => `- ${alias}: ${model}`)
    .join('\n')
  const allRoutes = Object.keys(getConfiguredModelRoutes())
    .sort((a, b) => a.localeCompare(b))
    .join(', ')

  return `The user invoked /mmodel to coordinate a task across multiple configured model route aliases.

Detected aliases in the request:
${aliasLines}

All configured route models:
${allRoutes || '(none)'}

Original user request:
${args}

Instructions:
- Use the Agent tool to delegate work to subagents with explicit model values from the detected aliases.
- When creating each agent, set the Agent tool's "model" parameter to the alias the user named, such as "mm7" or "g5"; the runtime will resolve it to the configured route model.
- Assign non-overlapping responsibilities. For example, one model may implement while another monitors, reviews, or verifies.
- Monitoring/reviewer agents should inspect and summarize by default. They must not overwrite another model's work unless the user explicitly asked for that.
- If the user describes a monitor/reviewer role, make that agent focus on progress, correctness, tests, and completion quality.
- Coordinate the agents' outputs and give the user a concise final status that names each alias/model and what it contributed.`
}

function buildDslPrompt(args: string, parsed: ParsedMModelDsl): string {
  const assignmentLines = parsed.assignments
    .map(
      assignment =>
        `- ${assignment.alias}: ${assignment.model} · role="${assignment.role}" · mode=${assignment.mode} · readonly=${assignment.readonly ? 'yes' : 'no'}`,
    )
    .join('\n')
  const detectedOnly = parsed.detectedAliases
    .filter(
      detected =>
        !parsed.assignments.some(
          assignment =>
            normalizeAliasKey(assignment.alias) ===
            normalizeAliasKey(detected.alias),
        ),
    )
    .map(({ alias, model }) => `- ${alias}: ${model}`)
    .join('\n')
  const allRoutes = Object.keys(getConfiguredModelRoutes())
    .sort((a, b) => a.localeCompare(b))
    .join(', ')

  return `The user invoked /mmodel with the lightweight multi-model DSL.

Parsed assignments:
${assignmentLines}

${parsed.task ? `Task flag:\n${parsed.task}\n` : ''}${parsed.dir ? `Working/output directory flag:\n${parsed.dir}\n` : ''}${parsed.freeform ? `Additional free-form instructions:\n${parsed.freeform}\n` : ''}${detectedOnly ? `Aliases mentioned outside DSL assignments:\n${detectedOnly}\n` : ''}
All configured route models:
${allRoutes || '(none)'}

Original user request:
${args}

DSL semantics:
- Each "alias:role", "alias=role", or "alias：role" assignment should become one Agent tool delegation.
- Set each Agent tool "model" parameter exactly to the alias from the assignment, such as "${parsed.assignments[0]?.alias ?? 'mm7'}"; the runtime will resolve it to the configured route model.
- The role text is authoritative. Use it to write the subagent prompt and to split responsibilities.
- Assign non-overlapping write responsibilities. If multiple workers edit code, explicitly divide files/modules/directories.
- For mode=monitor or mode=reviewer, and for readonly=yes, instruct that agent to inspect, monitor, test, and report by default. It must not overwrite another model's work unless the user explicitly asks.
- If a directory flag is present, keep all file reads/writes for this task scoped there unless the user clearly asks otherwise.
- Coordinate the agents' outputs and give the user a concise final status that names each alias/model and what it contributed.`
}

export async function getPromptForCommand(
  args: string,
  _context: ToolUseContext,
): Promise<ContentBlockParam[]> {
  const trimmedArgs = args.trim()
  const parsed = parseMModelDsl(trimmedArgs)

  const prompt =
    parsed.assignments.length > 0
      ? buildDslPrompt(trimmedArgs, parsed)
      : parsed.detectedAliases.length === 0
      ? buildNoAliasPrompt(trimmedArgs)
      : buildDetectedAliasPrompt(trimmedArgs, parsed.detectedAliases)

  return [{ type: 'text', text: prompt }]
}

export function resolveMModelAliasForTesting(alias: string): string | undefined {
  return resolveModelRouteAlias(alias)
}

export function parseMModelDslForTesting(args: string): ParsedMModelDsl {
  return parseMModelDsl(args)
}
