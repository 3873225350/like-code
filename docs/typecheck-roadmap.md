# Typecheck Roadmap

This roadmap tracks the work needed to turn `npm run typecheck` into a useful
signal for this learning fork. The goal is not to silence TypeScript with broad
`any` casts or whole-repo `@ts-nocheck`, but to restore enough type boundaries
that future feature work can rely on `tsc`.

## Current Baseline

The latest baseline observed during routing work was approximately:

- 248 files with TypeScript errors.
- 471 total error lines from `tsc`.
- `npm run build` still passes.

Useful commands:

```bash
npx tsc --noEmit --pretty false --noErrorTruncation > /tmp/likecode-tsc.log 2>&1
perl -ne 'print "$1\n" if /error (TS\d+)/' /tmp/likecode-tsc.log | sort | uniq -c | sort -nr
perl -ne 'print "$1\n" if /^(.*?\.tsx?)\(\d+,\d+\): error /' /tmp/likecode-tsc.log | sort | uniq -c | sort -nr | head -80
npm run build
npm run typecheck
```

## Guardrails

- Do not use broad whole-repo `@ts-nocheck` as a real fix.
- Prefer correcting ambient declarations and local helper return types before
  patching hundreds of call sites.
- Use `unknown` at runtime boundaries, then narrow with local type guards.
- Keep build behavior unchanged, especially Bun `--define` behavior.
- After each stage, record:
  - total error count,
  - top error codes,
  - top files by error count,
  - whether `npm run build` still passes.

## Stage 0: Baseline And Grouping

Purpose: create a stable snapshot before editing.

Tasks:

- Save a full `tsc` log with `--noErrorTruncation`.
- Group errors by root cause, not only by error code.
- Identify errors caused by reconstructed/internal-only code and errors caused
  by real local source drift.
- Add a short progress table to this file after every major pass.

Acceptance:

- A reproducible baseline exists.
- The remaining stages can be prioritized by error family.

## Stage 1: Type Infrastructure

Purpose: remove false errors caused by incomplete or incorrect declarations in
`src/types/*.d.ts` and local package stubs.

Primary targets:

- `src/types/external-modules.d.ts`
- `src/types/sdk-stubs.d.ts`
- `src/types/missing-stubs.d.ts`
- `src/types/bun.d.ts`
- package stubs under `packages/@anthropic-ai/*`

Tasks:

- Clean up or remove local declarations that shadow real installed packages,
  especially `@anthropic-ai/sdk`.
- Fix the `fflate` declaration to include `zipSync`, `unzipSync`, `gzipSync`,
  and `gunzipSync`, or rely on the package's own declarations.
- Extend the `@anthropic-ai/mcpb` stub with:
  - `McpbManifest`,
  - `McpbUserConfigurationOption`,
  - `getMcpConfigForManifest`.
- Extend LSP declarations with:
  - `LspServerConfig`,
  - accurate `ScopedLspServerConfig`,
  - all runtime states used by the source, such as `stopping` and
    `not_initialized`.
- Align SDK generated stubs with local source expectations:
  - `PermissionUpdate`,
  - `SDKMessage`,
  - `SDKToolProgressMessage`,
  - `SdkWorkflowProgress`,
  - MCP server config unions.
- Improve `react/compiler-runtime` typing so `c()` does not poison compiled
  React code with `unknown[]`.
- Add targeted missing internal module declarations for internal-only modules,
  such as:
  - `protectedNamespace.js`,
  - `attributionTrailer.js`,
  - `TerminalCaptureTool/prompt.js`,
  - `VerifyPlanExecutionTool/constants.js`,
  - `peerSessions.js`,
  - `workerAgent.js`.

Acceptance:

- `TS2305`, `TS2307`, `TS2614`, and `TS2459` are near zero or zero.
- SDK-related false errors, such as `Anthropic refers to a value`, are gone.
- Build still passes.

## Stage 2: Environment Constants And Compile-Time Macros

Purpose: remove false `TS2367` errors caused by type-level constants that are
runtime or build-time values in practice.

Tasks:

- Find comparisons such as `"external" === "ant"` and
  `"production" === "test"`.
- Preserve Bun build output behavior while avoiding literal-only type
  narrowing in source checked by `tsc`.
- Add or use helpers such as:
  - `getUserType(): string`,
  - `getBuildEnv(): string`,
  - `isAntBuild()`,
  - `isTestBuild()`.
- Keep `bun:bundle` `feature()` typed as `boolean`.
- Ensure internal-only branches stay type-checkable without requiring internal
  source to exist in this learning fork.

Acceptance:

- `TS2367` is near zero or zero.
- Bun `npm run build` output behavior remains unchanged.

## Stage 3: MessageContent And SDK Content Blocks

Purpose: fix the recurring mismatch where SDK message content can be either a
string or an array of blocks.

Tasks:

- Add shared helpers for content handling:
  - `isContentBlockArray(content)`,
  - `normalizeMessageContent(content)`,
  - `getTextFromMessageContent(content)`.
- Replace direct `.map`, `.find`, `.flatMap`, `last`, or property access on
  `MessageContent` without narrowing first.
- Prioritize:
  - `src/QueryEngine.ts`,
  - `src/utils/queryHelpers.ts`,
  - `src/components/FullscreenLayout.tsx`,
  - `src/utils/sessionRestore.ts`,
  - `src/utils/sessionTitle.ts`,
  - `src/utils/swarm/inProcessRunner.ts`.
- Handle optional `BetaMessage.usage` safely before passing it to functions
  that require usage to be present.

Acceptance:

- `TS2769` related to `MessageContent` is gone.
- String content and block-array content both keep their runtime behavior.

## Stage 4: Unknown Data Narrowing

Purpose: reduce the largest family of errors, usually `TS2339`, `TS2345`, and
`TS2322`, without erasing type safety.

Tasks:

- Add small type guards for JSON, plugin manifests, workspace API payloads,
  telemetry payloads, and storage values.
- Fix `safeParseJSON()` call sites that assume `Record<string, unknown>` from a
  generic `object`.
- Prefer fixing shared boundary helpers before fixing call sites.
- Prioritize:
  - `src/utils/settings/*`,
  - `src/utils/plugins/*`,
  - `src/utils/workspaceApiServer.ts`,
  - `src/components/HighlightedCode/Fallback.tsx`,
  - `src/components/FileEditToolDiff.tsx`,
  - `src/utils/toolSearch.ts`,
  - `src/utils/plans.ts`.

Acceptance:

- Unknown-property access errors fall sharply.
- New guards are reusable and colocated with the boundary they validate.

## Stage 5: Third-Party API Type Drift

Purpose: handle places where installed dependency types differ from source
expectations.

Tasks:

- Bedrock:
  - Verify whether code should read `inferenceProfileSummaries`, `models`, or
    another field for each command output.
- OpenTelemetry:
  - Align exporter imports and versions before using casts.
- QRCode:
  - Confirm whether the current `qrcode` package supports options like
    `small` and `type`; extend option typing only if runtime supports them.
- Anthropic SDK:
  - Decide whether `BetaTool` should be imported from a current SDK path or
    represented by a local compatibility alias.

Acceptance:

- Dependency-related type errors are gone.
- Any package version or lockfile change is documented.

## Stage 6: Business Type Drift

Purpose: resolve the remaining real source-level mismatches after false and
boundary errors are removed.

Areas:

- Compaction:
  - `SnipCompactResultExtended`,
  - `CompactionResult`,
  - compact function signatures.
- Permissions:
  - `PermissionUpdate`,
  - SDK generated permission updates,
  - classifier/path validation results.
- Transport:
  - `SSETransport.close()` and `WebSocketTransport.close()` return types,
  - `Transport` interface fields such as `id`, `type`, and `connected`.
- Workspace API:
  - `WorkspaceSubagentSummary`,
  - `AgentDefinition.name`,
  - local-agent vs in-process teammate unions.
- Commands and tasks:
  - missing default exports,
  - workflow commands,
  - monitor/local workflow task state.

Acceptance:

- `npm run typecheck` passes.
- `npm run build` passes.
- Previously fixed provider routing behavior still passes an offline smoke test.

## Suggested Execution Order

1. Stage 1: fix type infrastructure and rerun the baseline report.
2. Stage 2 and Stage 3: remove environment constant false positives and content
   block errors.
3. Stage 4: narrow unknown data at shared boundaries.
4. Stage 5 and Stage 6: finish dependency drift and true business type drift.

## Progress Log

| Date | Stage | Total Errors | Notes |
| --- | --- | ---: | --- |
| 2026-04-23 | Baseline | ~471 | Initial observed baseline during provider route work. |
| 2026-04-23 | Stage 1 | 467 | Added targeted `@anthropic-ai/mcpb` ambient exports for DXT manifest/config handling. `npm run build` passes. Top codes: TS2339=190, TS2345=68, TS2322=57, TS2367=30, TS2554=19, TS2305=12. Stage 1 import counts: TS2305=12, TS2307=6, TS2614=1, TS2459=1. |
| 2026-04-23 | Stage 1 | 459 | Added the missing `LspServerConfig` export and aligned `ScopedLspServerConfig` with the plugin LSP schema in `src/services/lsp/types.ts`. `npm run build` passes. Top codes: TS2339=186, TS2345=68, TS2322=56, TS2367=29, TS2554=19, TS2353=10, TS2305=10. Stage 1 import counts: TS2305=10, TS2307=6, TS2614=1, TS2459=1. |
| 2026-04-23 | Stage 1 | 458 | Re-exported `SDKMessage` from `src/remote/sdkMessageAdapter.ts` so SSH session stubs use the canonical SDK type boundary. `npm run build` passes. Top codes: TS2339=186, TS2345=68, TS2322=56, TS2367=29, TS2554=19, TS2353=10, TS2305=10, TS2769=7, TS2551=6, TS2307=6. Stage 1 import counts: TS2305=10, TS2307=6, TS2614=1, TS2459=0. |
| 2026-04-23 | Stage 1 | 499 | Re-exported `TaskStateBase` from `src/Tool.ts` so local workflow and monitor MCP task stubs use the canonical task-state type through their existing compatibility import. `npm run build` passes. Top codes: TS2339=219, TS2345=70, TS2322=64, TS2367=29, TS2554=19, TS2353=10, TS2305=8, TS2769=7, TS2551=6, TS2307=6. Stage 1 import counts: TS2305=8, TS2307=6, TS2614=1, TS2459=0. Overall error count increased outside this slice and is recorded as observed. |
| 2026-04-23 | Stage 1 | 498 | Exported a named `Option` type from the missing `*/ui/option.js` ambient module, using the existing CustomSelect `OptionWithDescription<string>` shape. `npm run build` passes. Top codes: TS2339=219, TS2345=70, TS2322=64, TS2367=29, TS2554=19, TS2353=10, TS2305=8, TS2769=7, TS2551=6, TS2307=6. Stage 1 import counts: TS2305=8, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | Stage 1 | 496 | Added the missing `isReplBridgeActive()` export to `src/bootstrap/state.ts` and typed the existing REPL bridge active state. `npm run build` passes. Top codes: TS2339=219, TS2345=70, TS2322=64, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2305=6. Stage 1 import counts: TS2305=6, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | Stage 1 | 495 | Added a narrow `BetaTool` compatibility export to the `@anthropic-ai/sdk/resources/beta/messages/messages.mjs` ambient module. The `api.ts` and `toolSchemaCache.ts` TS2305 diagnostics for `BetaTool` cleared. `npm run build` passes. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2305=4. Stage 1 import counts: TS2305=4, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | Stage 1 | 494 | Exported a tuple-union `Permutations` helper from `src/types/utils.ts`, clearing the `messageQueueManager.ts` TS2305 missing-export diagnostic without changing runtime output. `npm run build` passes. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2749=5, TS2305=3. Stage 1 import counts: TS2305=3, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | Stage 1 | 493 | Exported the missing `DiscoverySignal` union from `src/services/skillSearch/signals.ts`, clearing the `attachments.ts` TS2305 missing-export diagnostic without adding runtime code. `npm run build` passes. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2749=5. Stage 1 import counts: TS2305=2, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | Stage 1 | 491 | Exported a narrow `SdkWorkflowProgress` workflow-state boundary from `src/types/tools.ts` so SDK task progress emitters import through the existing reconstructed tool progress type module. `npm run build` passes. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2749=5, TS2739=5, TS2488=5. Stage 1 import counts: TS2305=0, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | Stage 1 | 488 | Added targeted ambient named exports for guarded internal-only dynamic imports in `workerAgent`, `peerSessions`, `TerminalCaptureTool/prompt`, and `VerifyPlanExecutionTool/constants`. `npm run build` passes. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5. Stage 1 import counts: TS2305=0, TS2307=2, TS2614=0, TS2459=0. Remaining TS2307 entries are same-directory relative utility imports for `./attributionTrailer.js` and `./protectedNamespace.js`. |
| 2026-04-23 | Stage 1 | 486 | Added source-adjacent declarations for guarded relative utility imports `src/utils/attributionTrailer.d.ts` and `src/utils/protectedNamespace.d.ts`. `npm run build` passes. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5. Stage 1 import counts: TS2305=0, TS2307=0, TS2614=0, TS2459=0. |
| 2026-04-23 | Stage 2 | 467 | Widened direct inlined `"external"` ant/external comparisons with the existing `("external" as string)` pattern, preserving equivalent emitted JavaScript while preventing literal-only `TS2367` narrowing. `npm run build` passes. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2554=19, TS2367=10, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5. Stage 1 import counts remain TS2305=0, TS2307=0, TS2614=0, TS2459=0; `TS2367` dropped from 29 to 10. |
| 2026-04-23 | Stage 2 | 460 | Widened direct inlined `"production"` NODE_ENV comparisons with `("production" as string)` in the updater, DevBar, setup, and testing-permission branches. `npm run build` passes and emitted-branch behavior remains equivalent after assertion stripping. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5, TS2367=3. Stage 1 import counts remain TS2305=0, TS2307=0, TS2614=0, TS2459=0; `TS2367` dropped from 10 to 3. |
| 2026-04-23 | Stage 2 | 458 | Added `default_claude_max_5x` and `default_claude_max_20x` to the OAuth `RateLimitTier` union and matching ambient mirror, clearing the two `/upgrade` RateLimitTier `TS2367` diagnostics as real type drift. `npm run build` passes. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5, TS2367=1. Stage 1 import counts remain TS2305=0, TS2307=0, TS2614=0, TS2459=0; only the Stage 3 content-block `TS2367` remains. |
