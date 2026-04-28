#!/usr/bin/env node
/**
 * Install cc-route plugin into Claude Code's plugin directory.
 * Creates a symlink from ~/.claude/plugins/cc-route → ./plugin
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const PLUGIN_SRC = path.resolve(__dirname, '..', 'plugin')
const PLUGIN_DST = path.join(os.homedir(), '.claude', 'plugins', 'cc-route')

function main() {
  console.log('Installing cc-route Claude Code plugin...')
  console.log(`  Source: ${PLUGIN_SRC}`)
  console.log(`  Target: ${PLUGIN_DST}`)

  // Check source exists
  if (!fs.existsSync(PLUGIN_SRC)) {
    console.error('✗ Plugin source directory not found:', PLUGIN_SRC)
    process.exit(1)
  }

  // Remove existing destination
  try {
    const stat = fs.lstatSync(PLUGIN_DST)
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(PLUGIN_DST, { recursive: true, force: true })
      console.log('  Removed existing plugin installation')
    }
  } catch (err) {
    // doesn't exist, okay
  }

  // Create symlink
  try {
    fs.symlinkSync(PLUGIN_SRC, PLUGIN_DST, 'dir')
    console.log('✓ Plugin installed successfully')
  } catch (err) {
    console.error('✗ Failed to create symlink:', err.message)
    console.error('  Try running with appropriate permissions, or manually copy the plugin directory.')
    process.exit(1)
  }

  // Verify structure
  const expectedFiles = [
    '.claude-plugin/plugin.json',
    'commands/mmodel.md',
    'skills/cc-route-routing/SKILL.md',
  ]

  let ok = true
  for (const f of expectedFiles) {
    const fullPath = path.join(PLUGIN_DST, f)
    if (fs.existsSync(fullPath)) {
      console.log(`  ✓ ${f}`)
    } else {
      console.log(`  ✗ ${f} MISSING`)
      ok = false
    }
  }

  if (!ok) {
    console.error('\n✗ Plugin structure validation failed')
    process.exit(1)
  }

  console.log('\n✓ Plugin ready. Restart Claude Code to load it.')
  console.log('  Usage:')
  console.log('    /mmodel mm25:写代码 g5:测试    # multi-model orchestration')
  console.log('    /model mm25                    # switch to MiniMax model')
}

main()
