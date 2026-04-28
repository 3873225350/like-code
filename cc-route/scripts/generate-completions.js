#!/usr/bin/env node
/**
 * Generate shell completion scripts for clauder.
 *
 * Usage:
 *   node scripts/generate-completions.js bash  > clauder.bash
 *   node scripts/generate-completions.js zsh   > _clauder
 *   node scripts/generate-completions.js fish  > clauder.fish
 *
 * Install:
 *   bash:  sudo mv clauder.bash /etc/bash_completion.d/
 *   zsh:   sudo mv _clauder /usr/share/zsh/site-functions/
 *   fish:  mv clauder.fish ~/.config/fish/completions/
 */

const SHELL = process.argv[2] ?? 'bash'

const CLAUDER_FLAGS = [
  '--proxy-only',
  '--proxy-stop',
  '--proxy-status',
  '--help',
  '-h',
]

const CLAUDE_COMMON_COMMANDS = [
  'config',
  'doctor',
  'login',
  'logout',
  '--help',
  '-v',
  '--version',
]

function generateBash() {
  return `#!/bin/bash
# clauder bash completion

_clauder() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # clauder-specific flags (only at position 1)
    if [[ COMP_CWORD -eq 1 ]]; then
        opts="${CLAUDER_FLAGS.join(' ')} ${CLAUDE_COMMON_COMMANDS.join(' ')}"
        COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
        return 0
    fi

    # If first arg is a clauder flag, no further completion
    case "\${COMP_WORDS[1]}" in
        --proxy-only|--proxy-stop|--proxy-status)
            return 0
            ;;
    esac

    # Delegate to claude completion if available
    if command -v _claude >/dev/null 2>&1; then
        _claude
    fi
}

complete -F _clauder clauder
`
}

function generateZsh() {
  return `#compdef clauder

# clauder zsh completion

_clauder_proxy_flags() {
    local -a flags
    flags=(
        '--proxy-only:Start proxy without launching Claude'
        '--proxy-stop:Stop the running proxy'
        '--proxy-status:Check proxy status'
        '--help:Show help'
    )
    _describe -t flags 'clauder flags' flags
}

_clauder() {
    local curcontext="$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '(--proxy-only --proxy-stop --proxy-status)--proxy-only[Start proxy only]' \\
        '(--proxy-only --proxy-stop --proxy-status)--proxy-stop[Stop proxy]' \\
        '(--proxy-only --proxy-stop --proxy-status)--proxy-status[Check proxy status]' \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '*::claude arguments:_claude'
}

# Fallback if _claude is not defined
if ! (( $+functions[_claude] )); then
    _claude() {
        _files
    }
fi

compdef _clauder clauder
`
}

function generateFish() {
  const flagLines = CLAUDER_FLAGS.map(f => `complete -c clauder -f -n '__fish_use_subcommand' -l ${f.replace(/^--/, '')} -d 'Clauder option'`).join('\n')

  return `# clauder fish completion

# Clauder-specific flags
complete -c clauder -f -n '__fish_use_subcommand' -l proxy-only -d 'Start proxy without launching Claude'
complete -c clauder -f -n '__fish_use_subcommand' -l proxy-stop -d 'Stop the running proxy'
complete -c clauder -f -n '__fish_use_subcommand' -l proxy-status -d 'Check proxy status'
complete -c clauder -f -n '__fish_use_subcommand' -s h -l help -d 'Show help'

# If claude completions exist, load them
if command -sq claude
    # Fish doesn't have a direct way to inherit completions,
    # but we can suggest common claude commands
    complete -c clauder -f -n '__fish_use_subcommand' -a 'config' -d 'Claude config'
    complete -c clauder -f -n '__fish_use_subcommand' -a 'doctor' -d 'Claude doctor'
    complete -c clauder -f -n '__fish_use_subcommand' -a 'login' -d 'Claude login'
    complete -c clauder -f -n '__fish_use_subcommand' -a 'logout' -d 'Claude logout'
end
`
}

function main() {
  switch (SHELL) {
    case 'bash':
      console.log(generateBash())
      break
    case 'zsh':
      console.log(generateZsh())
      break
    case 'fish':
      console.log(generateFish())
      break
    default:
      console.error(`Unknown shell: ${SHELL}. Use: bash, zsh, or fish`)
      process.exit(1)
  }
}

main()
