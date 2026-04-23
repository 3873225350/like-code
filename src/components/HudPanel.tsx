import React, { useEffect, useMemo, useState } from 'react'
import {
  formatCost,
  getModelUsage,
  getTotalCacheCreationInputTokens,
  getTotalCacheReadInputTokens,
  getTotalCost,
  getTotalInputTokens,
  getTotalOutputTokens,
  hasUnknownModelCost,
} from '../cost-tracker.js'
import { getSessionId } from '../bootstrap/state.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { Box, Text } from '../ink.js'
import { useAppState } from '../state/AppState.js'
import { isPanelAgentTask } from '../tasks/LocalAgentTask/LocalAgentTask.js'
import { isBackgroundTask } from '../tasks/types.js'
import { formatNumber, truncate } from '../utils/format.js'
import { getCwd } from '../utils/cwd.js'
import { getHudMode } from '../utils/hud.js'
import {
  getUsageHistorySummary,
  type UsageAggregate,
} from '../utils/usageHistory.js'

function getAggregateTokens(usage: UsageAggregate): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens
  )
}

function formatUsage(
  label: string,
  usage: UsageAggregate,
  showCost: boolean,
): string {
  const tokenText = `${label} ${formatNumber(getAggregateTokens(usage))} tok`
  return showCost ? `${tokenText} ${formatCost(usage.costUSD)}` : tokenText
}

function addUsage(a: UsageAggregate, b: UsageAggregate): UsageAggregate {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens:
      a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    webSearchRequests: a.webSearchRequests + b.webSearchRequests,
    costUSD: a.costUSD + b.costUSD,
  }
}

export function HudPanel(): React.ReactNode {
  const { columns } = useTerminalSize()
  const tasks = useAppState(s => s.tasks)
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const activeTasks = useMemo(
    () =>
      Object.values(tasks).filter(
        task =>
          isBackgroundTask(task) &&
          !(('external' as string) === 'ant' && isPanelAgentTask(task)),
      ),
    [tasks],
  )

  const hudMode = getHudMode()
  if (hudMode === 'off') {
    return null
  }

  const inputTokens = getTotalInputTokens()
  const outputTokens = getTotalOutputTokens()
  const cacheReadTokens = getTotalCacheReadInputTokens()
  const cacheWriteTokens = getTotalCacheCreationInputTokens()
  const totalTokens =
    inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens
  const modelUsage = getModelUsage()
  const historySummary = getUsageHistorySummary({
    excludeSessionId: getSessionId(),
  })
  const sessionUsage = {
    inputTokens,
    outputTokens,
    cacheReadInputTokens: cacheReadTokens,
    cacheCreationInputTokens: cacheWriteTokens,
    webSearchRequests: 0,
    costUSD: getTotalCost(),
  }
  const todayUsage = addUsage(historySummary.today, sessionUsage)
  const allUsage = addUsage(historySummary.all, sessionUsage)
  const modelSummary = Object.entries(modelUsage)
    .sort(
      ([, a], [, b]) =>
        b.inputTokens +
        b.outputTokens +
        b.cacheReadInputTokens +
        b.cacheCreationInputTokens -
        (a.inputTokens +
          a.outputTokens +
          a.cacheReadInputTokens +
          a.cacheCreationInputTokens),
    )
    .slice(0, 3)
    .map(([model, usage]) => {
      const modelTokens =
        usage.inputTokens +
        usage.outputTokens +
        usage.cacheReadInputTokens +
        usage.cacheCreationInputTokens
      return `${model}:${formatNumber(modelTokens)}`
    })
    .join(' · ')

  const pathBudget = Math.max(24, Math.floor(columns * 0.42))
  const cwd = truncate(getCwd(), pathBudget, true)
  const taskLine = `${activeTasks.length} active task${activeTasks.length === 1 ? '' : 's'}`
  const showCost = !hasUnknownModelCost()

  if (hudMode === 'compact') {
    return (
      <Box flexDirection="column" width="100%" marginTop={1}>
        <Text wrap="truncate">
          <Text color="claude">HUD </Text>
          <Text dimColor>project </Text>
          {cwd}
          <Text dimColor> · </Text>
          {formatUsage('session', sessionUsage, showCost)}
          <Text dimColor> · </Text>
          {formatUsage('today', todayUsage, showCost)}
          <Text dimColor> · </Text>
          {taskLine}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width="100%" marginTop={1}>
      <Text color="claude">HUD</Text>
      <Text wrap="truncate">
        <Text dimColor>project </Text>
        {cwd}
        <Text dimColor> · </Text>
        {taskLine}
      </Text>
      <Text wrap="truncate">
        <Text dimColor>session </Text>
        {[
          `tokens ${formatNumber(totalTokens)}`,
          `in ${formatNumber(inputTokens)}`,
          `out ${formatNumber(outputTokens)}`,
          `cache ${formatNumber(cacheReadTokens + cacheWriteTokens)}`,
          ...(showCost ? [formatCost(getTotalCost())] : []),
        ].join(' · ')}
      </Text>
      <Text wrap="truncate">
        <Text dimColor>today </Text>
        {[
          `tokens ${formatNumber(getAggregateTokens(todayUsage))}`,
          `in ${formatNumber(todayUsage.inputTokens)}`,
          `out ${formatNumber(todayUsage.outputTokens)}`,
          `cache ${formatNumber(todayUsage.cacheReadInputTokens + todayUsage.cacheCreationInputTokens)}`,
          ...(showCost ? [formatCost(todayUsage.costUSD)] : []),
        ].join(' · ')}
      </Text>
      <Text wrap="truncate">
        <Text dimColor>project all </Text>
        {[
          `tokens ${formatNumber(getAggregateTokens(allUsage))}`,
          `in ${formatNumber(allUsage.inputTokens)}`,
          `out ${formatNumber(allUsage.outputTokens)}`,
          `cache ${formatNumber(allUsage.cacheReadInputTokens + allUsage.cacheCreationInputTokens)}`,
          ...(showCost ? [formatCost(allUsage.costUSD)] : []),
        ].join(' · ')}
      </Text>
      {!showCost ? (
        <Text dimColor wrap="truncate">
          token-only: route pricing is empty or incomplete
        </Text>
      ) : null}
      {modelSummary && (
        <Text dimColor wrap="truncate">
          models {modelSummary}
        </Text>
      )}
    </Box>
  )
}
