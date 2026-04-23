import type { LocalCommandCall } from '../../types/command.js'
import { getHudMode, parseHudMode, setHudMode } from '../../utils/hud.js'

export const call: LocalCommandCall = async args => {
  const trimmed = args.trim()
  if (!trimmed || trimmed.toLowerCase() === 'status') {
    return {
      type: 'text',
      value: `HUD is ${getHudMode()}. Use /hud on, /hud compact, or /hud off.`,
    }
  }

  const mode = parseHudMode(trimmed)
  if (!mode) {
    return {
      type: 'text',
      value: `Unknown HUD mode "${trimmed}". Use /hud on, /hud compact, or /hud off.`,
    }
  }

  setHudMode(mode)
  return {
    type: 'text',
    value:
      mode === 'off'
        ? 'HUD hidden. Use /hud on or /hud compact to show it again.'
        : `HUD set to ${mode}.`,
  }
}
