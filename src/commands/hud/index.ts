import type { Command } from '../../commands.js'

const hud = {
  type: 'local',
  name: 'hud',
  description: 'Toggle the likecode HUD panel',
  argumentHint: '[on|off|compact]',
  immediate: true,
  supportsNonInteractive: false,
  load: () => import('./hud.js'),
} satisfies Command

export default hud
