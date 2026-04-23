import mergeWith from 'lodash-es/mergeWith.js'
import { join } from 'path'
import { getOriginalCwd } from '../../bootstrap/state.js'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { readFileSync } from '../fileRead.js'
import { safeParseJSON } from '../json.js'

export const LIKECODE_SETTINGS_FILENAME = 'settings.likecode.json'

/**
 * Get the path to the likecode project-level settings file.
 * Placed in .claude/ to avoid conflicts with Claude Code's settings schema.
 */
export function getLikeCodeProjectSettingsPath(): string {
  return join(getOriginalCwd(), '.claude', 'settings.likecode.local.json')
}

/**
 * Get the path to the likecode user-level settings file.
 */
export function getLikeCodeUserSettingsPath(): string {
  return join(getClaudeConfigHomeDir(), LIKECODE_SETTINGS_FILENAME)
}

/**
 * Read and parse a single likecode settings file.
 */
function readOneLikeCodeSettings(path: string): Record<string, unknown> {
  try {
    const content = readFileSync(path)
    if (!content.trim()) {
      return {}
    }
    const parsed = safeParseJSON(content, false)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

/**
 * Get merged likecode settings from two levels:
 * 1. Project-level: .claude/settings.likecode.local.json (higher priority)
 * 2. User-level: ~/.claude/likecode.settings.local.json (lower priority / fallback)
 *
 * For nested objects like modelRoutes, values are deep-merged (keys combined).
 * For top-level scalar values, project-level overrides user-level.
 */
export function getLikeCodeSettings(): Record<string, unknown> {
  const userSettings = readOneLikeCodeSettings(getLikeCodeUserSettingsPath())
  const projectSettings = readOneLikeCodeSettings(getLikeCodeProjectSettingsPath())

  // Deep merge: project-level nested objects extend user-level, not replace
  return mergeWith({}, userSettings, projectSettings, (_obj, src) => {
    // For arrays (e.g., modelRoutes), merge by concatenating unique keys
    if (Array.isArray(src)) {
      return src
    }
    // Return undefined to let lodash merge handle it normally
    return undefined
  })
}

export function getLikeCodeSettingsWithSources(): Array<{
  source: string
  settings: Record<string, unknown>
}> {
  return [getLikeCodeUserSettingsPath(), getLikeCodeProjectSettingsPath()]
    .map(path => ({ source: path, settings: readOneLikeCodeSettings(path) }))
    .filter(({ settings }) => Object.keys(settings).length > 0)
}
