import React, { useMemo } from 'react'
import { useAppState } from '../../state/AppState.js'
import { isPanelAgentTask } from '../../tasks/LocalAgentTask/LocalAgentTask.js'
import {
  type BackgroundTaskState,
  isBackgroundTask,
  type TaskState,
} from '../../tasks/types.js'
import { formatNumber } from '../../utils/format.js'
import { Box, Text } from '../../ink.js'
import { describeBackgroundTaskActivity } from './taskStatusUtils.js'

function getTaskLabel(task: BackgroundTaskState): string {
  switch (task.type) {
    case 'local_agent':
      return task.selectedAgent?.name
        ? `${task.selectedAgent.name} ${task.description}`
        : task.description
    case 'local_bash':
      return task.kind === 'monitor' ? task.description : task.command
    case 'remote_agent':
      return task.title
    case 'in_process_teammate':
      return `@${task.identity.agentName}`
    case 'local_workflow':
      return task.workflowName ?? task.summary ?? task.description
    case 'monitor_mcp':
      return task.description
    case 'dream':
      return task.description
  }
}

function getTaskTokens(task: BackgroundTaskState): number | undefined {
  if ('tokens' in task && typeof task.tokens === 'number') {
    return task.tokens
  }
  if ('usage' in task && task.usage && typeof task.usage === 'object') {
    const usage = task.usage as {
      inputTokens?: number
      outputTokens?: number
      cacheReadInputTokens?: number
      cacheCreationInputTokens?: number
    }
    return (
      (usage.inputTokens ?? 0) +
      (usage.outputTokens ?? 0) +
      (usage.cacheReadInputTokens ?? 0) +
      (usage.cacheCreationInputTokens ?? 0)
    )
  }
  return undefined
}

export function ActiveBackgroundTasksPanel(): React.ReactNode {
  const tasks = useAppState(s => s.tasks)

  const runningTasks = useMemo(
    () =>
      (Object.values(tasks ?? {}) as TaskState[]).filter(
        (task): task is BackgroundTaskState =>
          isBackgroundTask(task) &&
          task.status === 'running' &&
          !(('external' as string) === 'ant' && isPanelAgentTask(task)),
      ),
    [tasks],
  )

  if (runningTasks.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column" width="100%" marginBottom={1}>
      <Text color="claude">
        Background tasks{' '}
        <Text dimColor>
          {runningTasks.length} active agent
          {runningTasks.length === 1 ? '' : 's'}
        </Text>
      </Text>
      {runningTasks.slice(0, 6).map(task => {
        const tokens = getTaskTokens(task)
        return (
          <Text key={task.id} wrap="truncate">
            <Text dimColor>  {task.type.replace(/^local_/, '')} </Text>
            {getTaskLabel(task)}
            <Text dimColor> · {describeBackgroundTaskActivity(task)}</Text>
            {tokens !== undefined && (
              <Text dimColor> · {formatNumber(tokens)} tokens</Text>
            )}
          </Text>
        )
      })}
      {runningTasks.length > 6 && (
        <Text dimColor>  +{runningTasks.length - 6} more</Text>
      )}
    </Box>
  )
}
