#!/usr/bin/env node
import { ConfigManager } from './config.js'
import { startServer } from './server.js'

const DEFAULT_PORT = 3456
const DEFAULT_HOST = '127.0.0.1'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const port = parseInt(process.env.CC_ROUTE_PORT ?? String(DEFAULT_PORT), 10)
  const host = process.env.CC_ROUTE_HOST ?? DEFAULT_HOST

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
cc-route-proxy

Usage:
  cc-route-proxy [options]

Environment Variables:
  CC_ROUTE_PORT    Proxy port (default: ${DEFAULT_PORT})
  CC_ROUTE_HOST    Proxy host (default: ${DEFAULT_HOST})

Config Files (checked in order):
  ~/.claude/settings.cc-route.json
  ~/.claude/settings.likecode.json
  ./.claude/settings.cc-route.json
  ./.claude/settings.likecode.json

Options:
  --help, -h    Show this help
`)
    process.exit(0)
  }

  const customConfigPath = process.env.CC_ROUTE_CONFIG
  const config = new ConfigManager(customConfigPath ? [customConfigPath] : undefined)

  // Watch for config changes
  try {
    const { watch } = await import('chokidar')
    const watcher = watch(config['configPaths'] as string[], { ignoreInitial: true })
    watcher.on('change', () => {
      console.log('[cc-route] Config changed, reloading...')
      config.load()
    })
  } catch {
    console.log('[cc-route] File watching not available (install chokidar for hot reload)')
  }

  startServer(config, port, host)
}

void main().catch((err) => {
  console.error('[cc-route] Fatal error:', err)
  process.exit(1)
})
