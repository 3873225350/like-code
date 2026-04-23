import type { Command } from '../../commands.js'

export default {
  type: 'prompt',
  name: 'mmodel',
  description: 'Coordinate a task across configured model route aliases',
  argumentHint: '<instructions>',
  allowedTools: ['Agent', 'Task'],
  contentLength: 0,
  progressMessage: 'coordinating models',
  source: 'builtin',
  async getPromptForCommand(args, context) {
    const real = await import('./usemodel.js')
    return real.getPromptForCommand(args, context)
  },
} satisfies Command
