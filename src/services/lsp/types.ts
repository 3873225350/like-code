/**
 * LSP types stub - not implemented
 */

type LspTransport = 'stdio' | 'socket'

type LspServerScope = 'local' | 'user' | 'project' | 'dynamic'

export interface LSPServer {
  name: string
  command: string
  args: string[]
}

export interface LSPClient {
  id: string
  server: LSPServer
  status: 'starting' | 'running' | 'stopped'
}

export interface LSPCompletion {
  label: string
  kind: number
  detail?: string
}

export interface LSPDiagnostic {
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  severity: number
  message: string
}

export type LspServerStatus =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'not_initialized'

// LspServerState can be a string status or an object with status.
export type LspServerState =
  | LspServerStatus
  | {
      status: LspServerStatus
      pid?: number
      error?: string
    }

export interface LspServerConfig {
  command: string
  args?: string[]
  extensionToLanguage: Record<string, string>
  transport?: LspTransport
  env?: Record<string, string>
  initializationOptions?: unknown
  settings?: unknown
  workspaceFolder?: string
  restartOnCrash?: boolean
  shutdownTimeout?: number
  startupTimeout?: number
  maxRestarts?: number
}

export interface ScopedLspServerConfig extends LspServerConfig {
  scope: LspServerScope
  source?: string
}
