#!/usr/bin/env node
/**
 * Cross-platform build script for cc-route-proxy
 * Uses bun --compile to produce single-file executables.
 *
 * Platforms:
 *   - linux-x64   (default on Linux)
 *   - linux-arm64 (Raspberry Pi, ARM servers)
 *   - darwin-x64  (Intel Mac)
 *   - darwin-arm64 (Apple Silicon)
 *   - windows-x64 (Windows)
 *
 * Usage:
 *   node scripts/build-all.js              # build current platform only
 *   node scripts/build-all.js --all        # build all platforms
 *   node scripts/build-all.js --target linux-x64,darwin-arm64
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROXY_DIR = path.join(__dirname, '..', 'proxy')
const DIST_DIR = path.join(__dirname, '..', 'release')

const TARGETS = [
  { platform: 'linux',   arch: 'x64',   suffix: 'linux-x64' },
  { platform: 'linux',   arch: 'arm64', suffix: 'linux-arm64' },
  { platform: 'darwin',  arch: 'x64',   suffix: 'macos-x64' },
  { platform: 'darwin',  arch: 'arm64', suffix: 'macos-arm64' },
  { platform: 'windows', arch: 'x64',   suffix: 'windows-x64.exe' },
]

function banner(msg) {
  console.log(`\n  === ${msg} ===`)
}

function exec(cmd, opts = {}) {
  console.log(`  $ ${cmd}`)
  return execSync(cmd, { cwd: PROXY_DIR, stdio: 'inherit', ...opts })
}

function buildTarget(target) {
  const outName = `cc-route-proxy-${target.suffix}`
  const outPath = path.join(DIST_DIR, outName)

  banner(`Building ${target.platform}-${target.arch}`)

  const env = {
    ...process.env,
    GOOS: target.platform,
    GOARCH: target.arch,
  }

  // bun compile with cross-compilation
  const cmd = [
    'bun', 'build',
    '--compile',
    '--target', `bun-${target.platform}-${target.arch}`,
    '--outfile', outPath,
    'src/index.ts',
  ].join(' ')

  try {
    exec(cmd, { env })
    const stats = fs.statSync(outPath)
    console.log(`  ✓ ${outName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`)
    return true
  } catch (err) {
    console.error(`  ✗ Failed to build ${outName}:`, err.message)
    return false
  }
}

function main() {
  const args = process.argv.slice(2)
  const buildAll = args.includes('--all')
  const targetArg = args.find(a => a.startsWith('--target='))
  const targets = targetArg
    ? targetArg.replace('--target=', '').split(',').map(t => t.trim())
    : null

  // Ensure dist dir exists
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true })

  banner('Installing proxy dependencies')
  exec('npm install')

  banner('Compiling TypeScript')
  exec('npm run build')

  let selectedTargets
  if (buildAll) {
    selectedTargets = TARGETS
  } else if (targets) {
    selectedTargets = TARGETS.filter(t => targets.includes(`${t.platform}-${t.arch}`))
    if (selectedTargets.length === 0) {
      console.error('No matching targets. Available:', TARGETS.map(t => `${t.platform}-${t.arch}`).join(', '))
      process.exit(1)
    }
  } else {
    // Current platform only
    const current = `${process.platform}-${process.arch}`
    selectedTargets = TARGETS.filter(t => `${t.platform}-${t.arch}` === current)
    if (selectedTargets.length === 0) {
      console.warn(`Current platform ${current} not in target list. Building linux-x64 as fallback.`)
      selectedTargets = [TARGETS[0]]
    }
  }

  const results = selectedTargets.map(buildTarget)
  const success = results.filter(Boolean).length
  const total = results.length

  banner(`Build complete: ${success}/${total} succeeded`)

  if (success > 0) {
    console.log('\n  Binaries:')
    fs.readdirSync(DIST_DIR)
      .filter(f => f.startsWith('cc-route-proxy-'))
      .forEach(f => {
        const s = fs.statSync(path.join(DIST_DIR, f))
        console.log(`    ${f.padEnd(25)} ${(s.size / 1024 / 1024).toFixed(1)} MB`)
      })
  }

  process.exit(success === total ? 0 : 1)
}

main()
