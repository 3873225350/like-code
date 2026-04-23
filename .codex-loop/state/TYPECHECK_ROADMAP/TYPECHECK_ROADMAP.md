# Codex-Loop Typecheck Roadmap (TYPECHECK_ROADMAP)

**Plan ID**: `TYPECHECK_ROADMAP-20260423`
**Status**: `M4: Stage 2 in progress`
**Active Task**: `STAGE-2-ENV-MACROS`

## Mission

Execute the plan in `docs/typecheck-roadmap.md` until `npm run typecheck`
becomes a useful signal for this learning fork. Preserve runtime behavior and
avoid broad `any`, whole-repo `@ts-nocheck`, or automatic commits.

## Source Roadmap

Primary roadmap file:

`docs/typecheck-roadmap.md`

Each optimize/check tick must read that document first, then use this loop
state as the fast execution adapter.

## Milestones

- [x] **STAGE-0-BASELINE**: Create the typecheck roadmap and capture the known baseline.
- [x] **STAGE-1-TYPE-INFRA**: Fix type infrastructure in `src/types/*.d.ts` and local package stubs.
- [ ] **STAGE-2-ENV-MACROS**: Fix environment constants and compile-time macro type false positives.
- [ ] **STAGE-3-MESSAGE-CONTENT**: Normalize `MessageContent` and SDK content block handling.
- [ ] **STAGE-4-UNKNOWN-NARROWING**: Add reusable type guards and narrow runtime data boundaries.
- [ ] **STAGE-5-THIRD-PARTY-DRIFT**: Align third-party API types and dependency drift.
- [ ] **STAGE-6-BUSINESS-DRIFT**: Resolve remaining business type mismatches.

## Current Slice

Latest completed parent stage: `STAGE-1-TYPE-INFRA`.

Active parent stage: `STAGE-2-ENV-MACROS`.

Latest completed slice:

- `STAGE-2-RATELIMITTIER-MAX-TIERS`: added the Claude Max 5x and 20x tier
  literals to the central OAuth `RateLimitTier` union and matching ambient
  mirror. This cleared the two `/upgrade` `TS2367` diagnostics as real type
  drift rather than macro false positives.

Latest checker pass:

- 2026-04-23 14:42 CST: `npm run build` still passes; full `tsc` still exits
  2 with 458 errors. Stage 1 import/declaration loss remains `TS2305=0`,
  `TS2307=0`, `TS2614=0`, `TS2459=0`. `TS2367` dropped from 3 to 1 after
  aligning `RateLimitTier` with Claude Max tier values already used in source.
  The only remaining `TS2367` diagnostic is
  `src/services/api/logging.ts(677,11)`, which stays deferred to Stage 3
  content-block handling.
- 2026-04-23 14:36 CST: checker reran `npm run build` and full `tsc`.
  Build still passes; full `tsc` still exits 2 with 460 errors. Stage 1
  import/declaration loss remains `TS2305=0`, `TS2307=0`, `TS2614=0`,
  `TS2459=0`. `TS2367` remains 3: the two `RateLimitTier` comparisons in
  `src/commands/upgrade/upgrade.tsx` plus the SDK content-block union mismatch
  in `src/services/api/logging.ts`. Loss score is 3 against the Stage 2
  target. Wrote a local patch in `active_task.json` directing the next optimize
  pass to handle the `RateLimitTier` drift as its own slice and keep
  `logging.ts` for Stage 3 unless proven otherwise.
- 2026-04-23 14:29 CST: `npm run build` still passes; full `tsc` still exits
  2 with 460 errors. Stage 1 import/declaration loss remains
  `TS2305=0`, `TS2307=0`, `TS2614=0`, `TS2459=0`. `TS2367` dropped from 10 to
  3 after clearing the NODE_ENV macro family. Remaining `TS2367` diagnostics
  are the two `RateLimitTier` comparisons in `src/commands/upgrade/upgrade.tsx`
  and the SDK content-block union mismatch in `src/services/api/logging.ts`.
  Current top codes are TS2339=220, TS2345=70, TS2322=65, TS2554=19,
  TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5, and
  TS2367=3.
- 2026-04-23 14:20 CST: checker confirmed the user-type literal-widening slice
  aligns with Stage 2 and the roadmap was updated, but the parent
  `STAGE-2-ENV-MACROS` task is not complete. Loss remains the 10 outstanding
  `TS2367` diagnostics. Wrote a local patch in `active_task.json` directing
  the next optimize pass to isolate NODE_ENV literal comparisons first, while
  leaving `RateLimitTier` drift and the SDK content-block diagnostic for
  separate slices.
- 2026-04-23 14:14 CST: `npm run build` still passes; full `tsc` still exits
  2 with 467 errors. Stage 1 import/declaration loss remains
  `TS2305=0`, `TS2307=0`, `TS2614=0`, `TS2459=0`. `TS2367` dropped from 29 to
  10 after clearing the user-type macro family. Current top codes are
  TS2339=220, TS2345=70, TS2322=65, TS2554=19, TS2367=10, TS2353=10,
  TS2769=7, TS2551=6, TS2749=5, TS2739=5, and TS2488=5.

Priority order:

1. Defer the `src/services/api/logging.ts` `TS2367` content-block diagnostic to
   Stage 3 unless a later Stage 2 pass proves it is macro-related.
2. Preserve the completed Stage 1 type-boundary fixes; do not rework them
   unless a fresh checker run regresses `TS2305`, `TS2307`, `TS2614`, or
   `TS2459`.
3. Treat Stage 2 macro work as effectively complete after confirming no
   environment or compile-time macro `TS2367` diagnostics remain.

## Verification

Run at least:

```bash
npm run build
npx tsc --noEmit --pretty false --noErrorTruncation > /tmp/likecode-tsc.log 2>&1
```

Then summarize:

- total error count,
- top error codes,
- whether `TS2305`, `TS2307`, `TS2614`, and `TS2459` improved,
- whether `npm run build` still passes.

## Progress Log

| Date | Slice | Total Errors | Build | Notes |
| --- | --- | ---: | --- | --- |
| 2026-04-23 | `STAGE-1-MCPB-DECLARATIONS` | 467 | pass | `@anthropic-ai/mcpb` TS2305 errors cleared; top codes now TS2339=190, TS2345=68, TS2322=57, TS2367=30, TS2554=19, TS2305=12. Key Stage 1 counts: TS2305=12, TS2307=6, TS2614=1, TS2459=1. |
| 2026-04-23 | `STAGE-1-LSP-CONFIG-TYPES` | 459 | pass | Exported `LspServerConfig` and made scoped configs carry the validated LSP config shape. LSP TS2305 and `extensionToLanguage` TS2339 errors cleared. Top codes: TS2339=186, TS2345=68, TS2322=56, TS2367=29, TS2554=19, TS2353=10, TS2305=10. Key Stage 1 counts: TS2305=10, TS2307=6, TS2614=1, TS2459=1. |
| 2026-04-23 | `STAGE-1-SDKMESSAGE-EXPORT` | 458 | pass | Re-exported the canonical `SDKMessage` type from `src/remote/sdkMessageAdapter.ts`; the SSHSessionManager TS2459 diagnostic cleared. Top codes: TS2339=186, TS2345=68, TS2322=56, TS2367=29, TS2554=19, TS2353=10, TS2305=10, TS2769=7, TS2551=6, TS2307=6. Key Stage 1 counts: TS2305=10, TS2307=6, TS2614=1, TS2459=0. |
| 2026-04-23 | `STAGE-1-TASKSTATEBASE-REEXPORT` | 499 | pass | Re-exported canonical `TaskStateBase` from `src/Tool.ts`; LocalWorkflowTask and MonitorMcpTask TS2305 diagnostics cleared. Top codes: TS2339=219, TS2345=70, TS2322=64, TS2367=29, TS2554=19, TS2353=10, TS2305=8, TS2769=7, TS2551=6, TS2307=6. Key Stage 1 counts: TS2305=8, TS2307=6, TS2614=1, TS2459=0. Overall error count increased outside this slice and is recorded as observed. |
| 2026-04-23 | `STAGE-1-UI-OPTION-TYPE` | 498 | pass | Exported a named `Option` type from the missing `*/ui/option.js` ambient module, aliased to `OptionWithDescription<string>` from CustomSelect. PermissionRuleList TS2614 cleared. Top codes: TS2339=219, TS2345=70, TS2322=64, TS2367=29, TS2554=19, TS2353=10, TS2305=8, TS2769=7, TS2551=6, TS2307=6. Key Stage 1 counts: TS2305=8, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-1-REPL-BRIDGE-ACTIVE` | 496 | pass | Added the missing `isReplBridgeActive()` bootstrap export backed by the existing REPL bridge active state. SendMessageTool and ToolSearchTool TS2305 diagnostics cleared. Top codes: TS2339=219, TS2345=70, TS2322=64, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2305=6. Key Stage 1 counts: TS2305=6, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-1-BETATOOL-COMPAT` | 495 | pass | Added a narrow `BetaTool` compatibility export to the Anthropic SDK beta messages `.mjs` ambient module. `api.ts` and `toolSchemaCache.ts` TS2305 diagnostics cleared. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2305=4. Key Stage 1 counts: TS2305=4, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-1-PERMUTATIONS-EXPORT` | 494 | pass | Exported a tuple-union `Permutations` helper from `src/types/utils.ts`. `messageQueueManager.ts` TS2305 cleared. 13:10 checker rerun confirms unchanged Stage 1 loss. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2749=5, TS2739=5, TS2488=5, TS2305=3. Key Stage 1 counts: TS2305=3, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-1-DISCOVERYSIGNAL-EXPORT` | 493 | pass | Exported the missing `DiscoverySignal` union from `src/services/skillSearch/signals.ts`. `attachments.ts` TS2305 cleared. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2749=5, TS2739=5, TS2488=5. Key Stage 1 counts: TS2305=2, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-1-SDKWORKFLOWPROGRESS-EXPORT` | 491 | pass | Exported a narrow `SdkWorkflowProgress` workflow-state boundary from `src/types/tools.ts`. `sdkEventQueue.ts` and `sdkProgress.ts` TS2305 diagnostics cleared. Top codes: TS2339=219, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2307=6, TS2749=5, TS2739=5, TS2488=5. Key Stage 1 counts: TS2305=0, TS2307=6, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-1-INTERNAL-GUARDED-MODULE-STUBS` | 488 | pass | Added targeted ambient named exports for `workerAgent`, `peerSessions`, `TerminalCaptureTool/prompt`, and `VerifyPlanExecutionTool/constants` in `src/types/internal-modules.d.ts`. Four TS2307 diagnostics cleared; the two remaining TS2307 entries are same-directory relative imports for `./attributionTrailer.js` and `./protectedNamespace.js`. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5. Key Stage 1 counts: TS2305=0, TS2307=2, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-1-RELATIVE-UTILITY-SHIMS` | 486 | pass | Added source-adjacent declarations for `src/utils/attributionTrailer.d.ts` and `src/utils/protectedNamespace.d.ts`, resolving same-directory guarded imports that wildcard ambient declarations did not catch. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2367=29, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5. Key Stage 1 counts: TS2305=0, TS2307=0, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-2-USER-TYPE-LITERAL-WIDENING` | 467 | pass | Widened direct inlined `"external"` ant/external comparisons with the existing `("external" as string)` pattern. User-type `TS2367` diagnostics cleared and total `TS2367` dropped from 29 to 10. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2554=19, TS2367=10, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5. Key Stage 1 counts remain TS2305=0, TS2307=0, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-2-NODE-ENV-LITERAL-WIDENING` | 460 | pass | Widened direct inlined `"production"` test/development comparisons with the existing `("production" as string)` pattern. NODE_ENV `TS2367` diagnostics cleared and total `TS2367` dropped from 10 to 3. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5, TS2367=3. Key Stage 1 counts remain TS2305=0, TS2307=0, TS2614=0, TS2459=0. |
| 2026-04-23 | `STAGE-2-RATELIMITTIER-MAX-TIERS` | 458 | pass | Added `default_claude_max_5x` and `default_claude_max_20x` to the OAuth `RateLimitTier` union and matching ambient mirror. The two `/upgrade` RateLimitTier `TS2367` diagnostics cleared; only the Stage 3 content-block `TS2367` remains. Top codes: TS2339=220, TS2345=70, TS2322=65, TS2554=19, TS2353=10, TS2769=7, TS2551=6, TS2749=5, TS2739=5, TS2488=5, TS2367=1. Key Stage 1 counts remain TS2305=0, TS2307=0, TS2614=0, TS2459=0. |
