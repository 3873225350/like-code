import React, { useMemo } from 'react'
import type { DeepImmutable } from 'src/types/utils.js'
import { useElapsedTime } from '../../hooks/useElapsedTime.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'
import { Box, Text, useTheme } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import type { LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask.js'
import { getTools } from '../../tools.js'
import { formatNumber } from '../../utils/format.js'
import { extractTag } from '../../utils/messages.js'
import { Byline } from '../design-system/Byline.js'
import { Dialog } from '../design-system/Dialog.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'
import { ProgressBar } from '../design-system/ProgressBar.js'
import { UserPlanMessage } from '../messages/UserPlanMessage.js'
import { renderToolActivity } from './renderToolActivity.js'
import {
  estimateLocalAgentProgress,
  getTaskStatusColor,
  getTaskStatusIcon,
} from './taskStatusUtils.js'

type Props = {
  agent: DeepImmutable<LocalAgentTaskState>
  onDone: () => void
  onKillAgent?: () => void
  onBack?: () => void
}

export function AsyncAgentDetailDialog({
  agent,
  onDone,
  onKillAgent,
  onBack,
}: Props): React.ReactNode {
  const [theme] = useTheme()
  const tools = useMemo(
    () => getTools(getEmptyToolPermissionContext()),
    [],
  )
  const elapsedTime = useElapsedTime(
    agent.startTime,
    agent.status === 'running',
    1000,
    agent.totalPausedMs ?? 0,
  )

  useKeybindings(
    {
      'confirm:yes': onDone,
    },
    { context: 'Confirmation' },
  )

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault()
      onDone()
    } else if (e.key === 'left' && onBack) {
      e.preventDefault()
      onBack()
    } else if (
      e.key === 'x' &&
      agent.status === 'running' &&
      onKillAgent
    ) {
      e.preventDefault()
      onKillAgent()
    }
  }

  const planContent = extractTag(agent.prompt, 'plan')
  const displayPrompt =
    agent.prompt.length > 300
      ? `${agent.prompt.substring(0, 297)}...`
      : agent.prompt

  const tokenCount = agent.result?.totalTokens ?? agent.progress?.tokenCount
  const toolUseCount =
    agent.result?.totalToolUseCount ?? agent.progress?.toolUseCount

  const title = (
    <Text>
      {agent.selectedAgent?.agentType ?? 'agent'} ›{' '}
      {agent.description || 'Async agent'}
    </Text>
  )

  const subtitle = (
    <Text>
      {agent.status !== 'running' && (
        <Text color={getTaskStatusColor(agent.status)}>
          {getTaskStatusIcon(agent.status)}{' '}
          {agent.status === 'completed'
            ? 'Completed'
            : agent.status === 'failed'
              ? 'Failed'
              : 'Stopped'}{' '}
          ·{' '}
        </Text>
      )}
      <Text dimColor>
        {elapsedTime}
        {tokenCount !== undefined && tokenCount > 0 && (
          <> · {formatNumber(tokenCount)} tokens</>
        )}
        {toolUseCount !== undefined && toolUseCount > 0 && (
          <>
            {' '}
            · {toolUseCount} {toolUseCount === 1 ? 'tool' : 'tools'}
          </>
        )}
      </Text>
    </Text>
  )

  const recentActivities = agent.progress?.recentActivities ?? []
  const progress = estimateLocalAgentProgress(agent)

  const inputGuide = (exitState: { pending: boolean; keyName: string }) =>
    exitState.pending ? (
      <Text>Press {exitState.keyName} again to exit</Text>
    ) : (
      <Byline>
        {onBack && <KeyboardShortcutHint shortcut="←" action="go back" />}
        <KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />
        {agent.status === 'running' && onKillAgent && (
          <KeyboardShortcutHint shortcut="x" action="stop" />
        )}
      </Byline>
    )

  return (
    <Box
      flexDirection="column"
      tabIndex={0}
      autoFocus
      onKeyDown={handleKeyDown}
    >
      <Dialog
        title={title}
        subtitle={subtitle}
        onCancel={onDone}
        color="background"
        inputGuide={inputGuide}
      >
        <Box flexDirection="column">
          <Box flexDirection="column">
            <Text bold dimColor>
              Progress
            </Text>
            <Box flexDirection="row">
              <ProgressBar
                ratio={progress.ratio}
                width={24}
                fillColor={
                  agent.status === 'failed'
                    ? 'error'
                    : agent.status === 'killed'
                      ? 'warning'
                      : 'success'
                }
                emptyColor="secondaryBorder"
              />
              <Text>
                {' '}
                {progress.percent}% · {progress.stage}
              </Text>
            </Box>
            <Text dimColor wrap="truncate-end">
              Current: {progress.current}
            </Text>
            {agent.progress?.summary && (
              <Text wrap="wrap">Summary: {agent.progress.summary}</Text>
            )}
            {recentActivities.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>Recent activity</Text>
                {recentActivities.map((activity, i) => (
                  <Text
                    key={i}
                    dimColor={i < recentActivities.length - 1}
                    wrap="truncate-end"
                  >
                    {i === recentActivities.length - 1 ? '› ' : '  '}
                    {renderToolActivity(activity, tools, theme)}
                  </Text>
                ))}
              </Box>
            )}
          </Box>

          {planContent ? (
            <Box marginTop={1}>
              <UserPlanMessage addMargin={false} planContent={planContent} />
            </Box>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              <Text bold dimColor>
                Prompt
              </Text>
              <Text wrap="wrap">{displayPrompt}</Text>
            </Box>
          )}

          {agent.status === 'failed' && agent.error && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="error">
                Error
              </Text>
              <Text color="error" wrap="wrap">
                {agent.error}
              </Text>
            </Box>
          )}
        </Box>
      </Dialog>
    </Box>
  )
}
