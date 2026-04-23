import figures from 'figures'
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTerminalSize } from 'src/hooks/useTerminalSize.js'
import { stringWidth } from 'src/ink/stringWidth.js'
import { useAppState, useSetAppState } from 'src/state/AppState.js'
import {
  enterTeammateView,
  exitTeammateView,
} from 'src/state/teammateViewHelpers.js'
import {
  isPanelAgentTask,
  type LocalAgentTaskState,
} from 'src/tasks/LocalAgentTask/LocalAgentTask.js'
import { getPillLabel, pillNeedsCta } from 'src/tasks/pillLabel.js'
import {
  type BackgroundTaskState,
  isBackgroundTask,
  type TaskState,
} from 'src/tasks/types.js'
import { truncate } from 'src/utils/format.js'
import { calculateHorizontalScrollWindow } from 'src/utils/horizontalScroll.js'
import { Box, Text } from '../../ink.js'
import {
  AGENT_COLOR_TO_THEME_COLOR,
  AGENT_COLORS,
  type AgentColorName,
} from '../../tools/AgentTool/agentColorManager.js'
import type { Theme } from '../../utils/theme.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'
import { ProgressBar } from '../design-system/ProgressBar.js'
import {
  describeBackgroundTaskActivity,
  estimateLocalAgentProgress,
  shouldHideTasksFooter,
} from './taskStatusUtils.js'

type Props = {
  tasksSelected: boolean
  isViewingTeammate?: boolean
  teammateFooterIndex?: number
  isLeaderIdle?: boolean
  onOpenDialog?: (taskId?: string) => void
}

type AgentPillInfo = {
  name: string
  color?: keyof Theme
  isIdle: boolean
  taskId?: string
  idx: number
}

export function BackgroundTaskStatus({
  tasksSelected,
  isViewingTeammate,
  teammateFooterIndex = 0,
  isLeaderIdle = false,
  onOpenDialog,
}: Props): React.ReactNode {
  const setAppState = useSetAppState()
  const { columns } = useTerminalSize()
  const tasks = useAppState(s => s.tasks)
  const viewingAgentTaskId = useAppState(s => s.viewingAgentTaskId)
  const expandedView = useAppState(s => s.expandedView)
  const showSpinnerTree = expandedView === 'teammates'

  const runningTasks = useMemo(
    () =>
      (Object.values(tasks ?? {}) as TaskState[]).filter(
        t =>
          isBackgroundTask(t) &&
          !(('external' as string) === 'ant' && isPanelAgentTask(t)),
      ),
    [tasks],
  )
  const localAgentTasks = useMemo(
    () =>
      runningTasks.filter(
        (task): task is LocalAgentTaskState => task.type === 'local_agent',
      ),
    [runningTasks],
  )
  const [agentCarouselTick, setAgentCarouselTick] = useState(0)

  useEffect(() => {
    if (tasksSelected || localAgentTasks.length <= 1) return
    const timer = setInterval(() => setAgentCarouselTick(t => t + 1), 3000)
    return () => clearInterval(timer)
  }, [localAgentTasks.length, tasksSelected])

  const visibleLocalAgent =
    localAgentTasks.length > 0
      ? (localAgentTasks[agentCarouselTick % localAgentTasks.length] ??
        localAgentTasks[0]!)
      : undefined

  const teammateEntries = useMemo(
    () =>
      runningTasks
        .filter(
          (t): t is BackgroundTaskState & { type: 'in_process_teammate' } =>
            t.type === 'in_process_teammate',
        )
        .sort((a, b) =>
          a.identity.agentName.localeCompare(b.identity.agentName),
        ),
    [runningTasks],
  )

  const allTeammates =
    !showSpinnerTree &&
    runningTasks.length > 0 &&
    runningTasks.every(t => t.type === 'in_process_teammate')

  const allPills = useMemo<AgentPillInfo[]>(() => {
    const mainPill = {
      name: 'main',
      color: undefined as keyof Theme | undefined,
      isIdle: isLeaderIdle,
      taskId: undefined as string | undefined,
    }
    const teammatePills = teammateEntries.map(t => ({
      name: t.identity.agentName,
      color: getAgentThemeColor(t.identity.color),
      isIdle: t.isIdle,
      taskId: t.id,
    }))
    if (!tasksSelected) {
      teammatePills.sort((a, b) => {
        if (a.isIdle !== b.isIdle) return a.isIdle ? 1 : -1
        return 0
      })
    }
    return [mainPill, ...teammatePills].map((pill, idx) => ({
      ...pill,
      idx,
    }))
  }, [teammateEntries, isLeaderIdle, tasksSelected])

  if (allTeammates || (!showSpinnerTree && isViewingTeammate)) {
    const selectedIdx = tasksSelected ? teammateFooterIndex : -1
    const viewedIdx = viewingAgentTaskId
      ? teammateEntries.findIndex(t => t.id === viewingAgentTaskId) + 1
      : 0
    const pillWidths = allPills.map(
      (pill, i) => stringWidth(`@${pill.name}`) + (i > 0 ? 1 : 0),
    )
    const availableWidth = Math.max(20, columns - 24)
    const {
      startIndex,
      endIndex,
      showLeftArrow,
      showRightArrow,
    } = calculateHorizontalScrollWindow(
      pillWidths,
      availableWidth,
      2,
      selectedIdx >= 0 ? selectedIdx : 0,
    )
    const visiblePills = allPills.slice(startIndex, endIndex)

    return (
      <>
        {showLeftArrow && <Text dimColor>{figures.arrowLeft} </Text>}
        {visiblePills.map((pill, i) => (
          <React.Fragment key={pill.name}>
            {i > 0 && <Text> </Text>}
            <AgentPill
              name={pill.name}
              color={pill.color}
              isSelected={selectedIdx === pill.idx}
              isViewed={viewedIdx === pill.idx}
              isIdle={pill.isIdle}
              onClick={() =>
                pill.taskId
                  ? enterTeammateView(pill.taskId, setAppState)
                  : exitTeammateView(setAppState)
              }
            />
          </React.Fragment>
        ))}
        {showRightArrow && <Text dimColor> {figures.arrowRight}</Text>}
        <Text dimColor>
          {' · '}
          <KeyboardShortcutHint shortcut="shift + ↓" action="expand" />
        </Text>
      </>
    )
  }

  if (shouldHideTasksFooter(tasks ?? {}, showSpinnerTree)) return null
  if (runningTasks.length === 0) return null

  if (tasksSelected && runningTasks.length > 1) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap">
          {runningTasks.map((task, index) => (
            <React.Fragment key={task.id}>
              {index > 0 && <Text> </Text>}
              <TaskPill
                task={task}
                width={Math.max(
                  18,
                  Math.min(44, Math.floor((columns - 8) / Math.min(4, runningTasks.length))),
                )}
                onClick={onOpenDialog ? () => onOpenDialog(task.id) : undefined}
              />
            </React.Fragment>
          ))}
        </Box>
        <Text dimColor>
          {figures.arrowDown} / Enter view tasks · Esc/← back from details
        </Text>
      </Box>
    )
  }

  if (!tasksSelected && visibleLocalAgent) {
    return (
      <>
        <LocalAgentProgressSummary
          task={visibleLocalAgent}
          count={localAgentTasks.length}
          width={Math.max(26, Math.min(58, columns - 34))}
          onClick={
            onOpenDialog ? () => onOpenDialog(visibleLocalAgent.id) : undefined
          }
        />
        <Text dimColor> · {figures.arrowDown} to manage</Text>
      </>
    )
  }

  return (
    <>
      <SummaryPill selected={tasksSelected} onClick={onOpenDialog}>
        {getPillLabel(runningTasks)}
      </SummaryPill>
      {pillNeedsCta(runningTasks) && (
        <Text dimColor> · {figures.arrowDown} to view</Text>
      )}
    </>
  )
}

function LocalAgentProgressSummary({
  task,
  count,
  width,
  onClick,
}: {
  task: LocalAgentTaskState
  count: number
  width: number
  onClick?: () => void
}): React.ReactNode {
  const [hover, setHover] = useState(false)
  const progress = estimateLocalAgentProgress(task)
  const agentName =
    task.selectedAgent?.name ?? task.selectedAgent?.agentType ?? 'agent'
  const countLabel = `${count} local agent${count === 1 ? '' : 's'}`
  const barWidth = Math.max(6, Math.min(10, Math.floor(width * 0.18)))
  const nameWidth = Math.max(8, Math.floor(width * 0.28))
  const stageWidth = Math.max(8, width - stringWidth(countLabel) - nameWidth - barWidth - 15)
  const content = (
    <Text color="background" inverse={hover}>
      {countLabel}
      <Text dimColor={!hover}> · </Text>
      <Text color="cyanBright" bold>
        {truncate(agentName, nameWidth, true)}
      </Text>
      <Text dimColor={!hover}> </Text>
      <ProgressBar
        ratio={progress.ratio}
        width={barWidth}
        fillColor={task.status === 'failed' ? 'error' : 'success'}
        emptyColor="secondaryBorder"
      />
      <Text dimColor={!hover}>
        {' '}
        {progress.percent}% {truncate(progress.stage, stageWidth, true)}
      </Text>
    </Text>
  )

  if (!onClick) return content
  return (
    <Box
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {content}
    </Box>
  )
}

function TaskPill({
  task,
  width,
  onClick,
}: {
  task: BackgroundTaskState
  width: number
  onClick?: () => void
}): React.ReactNode {
  const [hover, setHover] = useState(false)
  const labelWidth = Math.max(8, Math.floor(width * 0.55))
  const activityWidth = Math.max(6, width - labelWidth - 3)
  const label = truncate(getTaskName(task), labelWidth, true)
  const activity = truncate(
    describeBackgroundTaskActivity(task),
    activityWidth,
    true,
  )
  const content = (
    <Text color="background" inverse={hover}>
      {label}
      <Text dimColor={!hover}> · {activity}</Text>
    </Text>
  )
  if (!onClick) return content
  return (
    <Box
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {content}
    </Box>
  )
}

function getTaskName(task: BackgroundTaskState): string {
  switch (task.type) {
    case 'local_bash':
      return task.kind === 'monitor' ? task.description : task.command
    case 'local_agent':
      return task.selectedAgent?.name
        ? `${task.selectedAgent.name}: ${task.description}`
        : task.description
    case 'in_process_teammate':
      return `@${task.identity.agentName}`
    case 'remote_agent':
      return task.title
    case 'local_workflow':
      return task.workflowName ?? task.summary ?? task.description
    case 'monitor_mcp':
      return task.description
    case 'dream':
      return task.description
  }
}

type AgentPillProps = {
  name: string
  color?: keyof Theme
  isSelected: boolean
  isViewed: boolean
  isIdle: boolean
  onClick?: () => void
}

function AgentPill({
  name,
  color,
  isSelected,
  isViewed,
  isIdle,
  onClick,
}: AgentPillProps): React.ReactNode {
  const [hover, setHover] = useState(false)
  const highlighted = isSelected || hover

  let label: React.ReactNode
  if (highlighted) {
    label = color ? (
      <Text backgroundColor={color} color="inverseText" bold={isViewed}>
        @{name}
      </Text>
    ) : (
      <Text color="background" inverse bold={isViewed}>
        @{name}
      </Text>
    )
  } else if (isIdle) {
    label = (
      <Text dimColor bold={isViewed}>
        @{name}
      </Text>
    )
  } else if (isViewed) {
    label = (
      <Text color={color} bold>
        @{name}
      </Text>
    )
  } else {
    label = (
      <Text color={color} dimColor={!color}>
        @{name}
      </Text>
    )
  }

  if (!onClick) return label
  return (
    <Box
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </Box>
  )
}

function SummaryPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick?: () => void
  children: React.ReactNode
}): React.ReactNode {
  const [hover, setHover] = useState(false)
  const label = (
    <Text color="background" inverse={selected || hover}>
      {children}
    </Text>
  )
  if (!onClick) return label
  return (
    <Box
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </Box>
  )
}

function getAgentThemeColor(
  colorName: string | undefined,
): keyof Theme | undefined {
  if (!colorName) return undefined
  if (AGENT_COLORS.includes(colorName as AgentColorName)) {
    return AGENT_COLOR_TO_THEME_COLOR[colorName as AgentColorName]
  }
  return undefined
}
