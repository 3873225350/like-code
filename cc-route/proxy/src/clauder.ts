#!/usr/bin/env node
/**
 * clauder — Claude Code wrapper with auto-managed cc-route proxy
 *
 * Usage: clauder [all claude arguments...]
 *
 * Examples:
 *   clauder                          # Interactive mode
 *   clauder "refactor this code"     # One-shot query
 *   clauder config set theme dark    # Pass through to claude config
 *   clauder --help                   # Show claude help
 *
 * Behavior:
 *   1. Checks if cc-route proxy is already running
 *   2. If not, starts it in the background
 *   3. Sets ANTHROPIC_BASE_URL to proxy address
 *   4. Execs 'claude' with all original arguments
 *   5. On exit, stops proxy if we started it
 */

import { spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const DEFAULT_PORT = 3456
const DEFAULT_HOST = '127.0.0.1'
const PID_FILE = join(homedir(), '.cc-route', 'proxy.pid')

interface ProxyStatus {
  running: boolean
  pid?: number
  external?: boolean
  port: number
  host: string
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Allow override via environment
  const port = parseInt(process.env.CC_ROUTE_PORT ?? String(DEFAULT_PORT), 10)
  const host = process.env.CC_ROUTE_HOST ?? DEFAULT_HOST
  const proxyUrl = `http://${host}:${port}`

  // Special: clauder --proxy-only (start proxy without launching claude)
  if (args.includes('--proxy-only')) {
    const proxy = await startProxy(port, host)
    console.log(`[clauder] Proxy running on ${proxyUrl} (pid ${proxy.pid})`)
    console.log('[clauder] Press Ctrl+C to stop')
    process.on('SIGINT', () => {
      console.log('\n[clauder] Stopping proxy...')
      stopProxy()
      process.exit(0)
    })
    return
  }

  // Special: clauder --proxy-stop
  if (args.includes('--proxy-stop')) {
    stopProxy()
    return
  }

  // Special: clauder --proxy-status
  if (args.includes('--proxy-status')) {
    const status = await checkProxyStatus(port, host)
    if (status.running) {
      if (status.external) {
        console.log(`[clauder] Proxy running at ${proxyUrl} (external, not managed by clauder)`)
      } else {
        console.log(`[clauder] Proxy running at ${proxyUrl} (pid ${status.pid})`)
      }
    } else {
      console.log(`[clauder] Proxy not running at ${proxyUrl}`)
    }
    return
  }

  // Check auth conflict
  checkAuthConflict()

  // Ensure proxy is running
  let weStartedProxy = false
  const status = await checkProxyStatus(port, host)

  if (!status.running) {
    console.log('[clauder] Starting cc-route proxy...')
    const proxy = await startProxy(port, host)
    weStartedProxy = true
    console.log(`[clauder] Proxy ready at ${proxyUrl} (pid ${proxy.pid})`)
  } else {
    console.log(`[clauder] Using existing proxy at ${proxyUrl} (pid ${status.pid})`)
  }

  // Prepare environment
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ANTHROPIC_BASE_URL: proxyUrl,
  }

  // Only set dummy key if no auth is configured
  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) {
    env.ANTHROPIC_API_KEY = 'cc-route-dummy-key'
  }

  // Find claude binary
  const claudeBinary = findClaudeBinary()
  if (!claudeBinary) {
    console.error('[clauder] Error: claude command not found in PATH')
    console.error('[clauder] Install Claude Code: npm install -g @anthropic-ai/claude-code')
    if (weStartedProxy) stopProxy()
    process.exit(1)
  }

  console.log(`[clauder] Launching: ${claudeBinary} ${args.join(' ')}`)

  // Spawn claude with inherited stdio
  const child = spawn(claudeBinary, args, {
    stdio: 'inherit',
    env,
    shell: false,
  })

  // Forward signals to child
  const forwardSignal = (signal: NodeJS.Signals) => {
    child.kill(signal)
  }
  process.on('SIGINT', forwardSignal)
  process.on('SIGTERM', forwardSignal)

  // Wait for claude to exit
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('close', (code) => resolve(code))
    child.on('error', (err) => {
      console.error('[clauder] Failed to start claude:', err.message)
      resolve(1)
    })
  })

  // Cleanup
  process.off('SIGINT', forwardSignal)
  process.off('SIGTERM', forwardSignal)

  if (weStartedProxy) {
    console.log('[clauder] Stopping proxy...')
    stopProxy()
  }

  process.exit(exitCode ?? 0)
}

function findClaudeBinary(): string | null {
  // Check if 'claude' is in PATH
  try {
    const { execSync } = require('child_process')
    const result = execSync('which claude || where claude 2>/dev/null', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] })
    const path = result.trim().split('\n')[0]
    if (path) return path
  } catch { /* ignore */ }

  // Common locations
  const candidates = [
    join(homedir(), '.npm-global', 'bin', 'claude'),
    join(homedir(), '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/usr/bin/claude',
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return null
}

async function checkProxyStatus(port: number, host: string): Promise<ProxyStatus> {
  const hasPidFile = existsSync(PID_FILE)

  // Try to connect
  try {
    const response = await fetch(`http://${host}:${port}/v1/models`, { signal: AbortSignal.timeout(500) })
    if (response.ok) {
      let pid: number | undefined
      let external = false
      if (hasPidFile) {
        try {
          pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
        } catch { /* ignore */ }
      }
      if (!pid) {
        external = true
      }
      return { running: true, pid, external, port, host }
    }
  } catch { /* not running */ }

  // Check PID file even if HTTP fails
  if (hasPidFile) {
    try {
      const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
      if (pid && isProcessRunning(pid)) {
        return { running: true, pid, external: false, port, host }
      }
      // Stale PID file — clean it up
      unlinkSync(PID_FILE)
    } catch { /* ignore */ }
  }

  return { running: false, port, host }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function startProxy(port: number, host: string): Promise<{ pid: number }> {
  // Ensure ~/.cc-route exists
  const pidDir = join(homedir(), '.cc-route')
  try {
    const { mkdirSync } = require('fs')
    if (!existsSync(pidDir)) mkdirSync(pidDir, { recursive: true })
  } catch { /* ignore */ }

  // Find proxy binary
  const proxyBinary = findProxyBinary()
  if (!proxyBinary) {
    throw new Error('cc-route-proxy binary not found. Run: npm install -g cc-route-proxy')
  }

  // Start proxy
  const proxy = spawn(proxyBinary, [], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CC_ROUTE_PORT: String(port),
      CC_ROUTE_HOST: host,
    },
  })

  proxy.unref()

  if (!proxy.pid) {
    throw new Error('Failed to start proxy process')
  }

  // Write PID file
  writeFileSync(PID_FILE, String(proxy.pid))

  // Wait for proxy to be ready
  for (let i = 0; i < 20; i++) {
    await sleep(200)
    try {
      const response = await fetch(`http://${host}:${port}/v1/models`, { signal: AbortSignal.timeout(500) })
      if (response.ok) {
        return { pid: proxy.pid }
      }
    } catch { /* not ready yet */ }
  }

  throw new Error('Proxy did not become ready within 4 seconds')
}

function stopProxy(): void {
  if (!existsSync(PID_FILE)) {
    console.log('[clauder] No PID file found. Proxy may be running externally.')
    console.log('[clauder] To stop an external proxy, find the process and kill it manually.')
    return
  }
  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
    if (pid && isProcessRunning(pid)) {
      console.log(`[clauder] Stopping proxy (pid ${pid})...`)
      process.kill(pid, 'SIGTERM')
      // Wait a bit then force kill if needed
      setTimeout(() => {
        try {
          if (isProcessRunning(pid)) {
            console.log(`[clauder] Force killing proxy (pid ${pid})...`)
            process.kill(pid, 'SIGKILL')
          }
        } catch { /* ignore */ }
      }, 2000)
    } else {
      console.log('[clauder] Proxy process not found (may have already exited)')
    }
    unlinkSync(PID_FILE)
  } catch (err) {
    console.error('[clauder] Error stopping proxy:', (err as Error).message)
  }
}

function checkAuthConflict(): void {
  if (process.env.ANTHROPIC_AUTH_TOKEN && process.env.ANTHROPIC_API_KEY) {
    console.warn('[clauder] ⚠️  Both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY are set.')
    console.warn('[clauder]    When using cc-route, unset ANTHROPIC_AUTH_TOKEN:')
    console.warn('[clauder]    export ANTHROPIC_AUTH_TOKEN=""')
    console.warn('')
  }
}

function findProxyBinary(): string | null {
  // 1. Check if cc-route-proxy is in PATH
  try {
    const { execSync } = require('child_process')
    const result = execSync('which cc-route-proxy 2>/dev/null', { encoding: 'utf-8' })
    const path = result.trim().split('\n')[0]
    if (path) return path
  } catch { /* ignore */ }

  // 2. Check compiled binary relative to this script
  const scriptDir = __dirname
  const compiled = join(scriptDir, '..', '..', 'release', 'cc-route-proxy-linux-x64')
  if (existsSync(compiled)) return compiled

  // 3. Check npm global
  const candidates = [
    join(homedir(), '.npm-global', 'bin', 'cc-route-proxy'),
    join(homedir(), '.local', 'bin', 'cc-route-proxy'),
    '/usr/local/bin/cc-route-proxy',
    '/usr/bin/cc-route-proxy',
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  // 4. Check if we can run from source
  const srcPath = join(scriptDir, 'index.js')
  if (existsSync(srcPath)) return `node ${srcPath}`

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error('[clauder] Fatal error:', err)
  process.exit(1)
})
