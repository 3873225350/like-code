export type HudMode = 'full' | 'compact' | 'off'

let hudMode: HudMode = 'full'

export function getHudMode(): HudMode {
  return hudMode
}

export function setHudMode(mode: HudMode): HudMode {
  hudMode = mode
  return hudMode
}

export function parseHudMode(input: string): HudMode | undefined {
  const value = input.trim().toLowerCase()
  if (!value || value === 'status') {
    return undefined
  }
  if (['on', 'full', 'show', 'open'].includes(value)) {
    return 'full'
  }
  if (['compact', 'mini', 'small'].includes(value)) {
    return 'compact'
  }
  if (['off', 'hide', 'close', 'disable'].includes(value)) {
    return 'off'
  }
  return undefined
}
