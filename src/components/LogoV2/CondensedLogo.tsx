import * as React from 'react'
import { homedir } from 'os'
import { relative } from 'path'
import { useEffect } from 'react'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Box, Text } from '../../ink.js'
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js'
import { useAppState } from '../../state/AppState.js'
import { getEffortSuffix } from '../../utils/effort.js'
import { truncate } from '../../utils/format.js'
import {
  formatModelAndBilling,
  formatReleaseNoteForDisplay,
  getLayeredConfigSummaryItems,
  getLogoDisplayData,
  getRecentActivitySync,
  getRecentReleaseNotesSync,
  truncatePath,
  type LayeredConfigSummaryItem,
} from '../../utils/logoV2Utils.js'
import { getWorkspaceApiBaseUrl } from '../../utils/workspaceApiServer.js'
import { renderModelSetting } from '../../utils/model/model.js'
import { getModelOptions } from '../../utils/model/modelOptions.js'
import { getConfiguredModelRouteDetails } from '../../utils/model/modelRoutes.js'
import { OffscreenFreeze } from '../OffscreenFreeze.js'
import {
  GuestPassesUpsell,
  incrementGuestPassesSeenCount,
  useShowGuestPassesUpsell,
} from './GuestPassesUpsell.js'
import {
  incrementOverageCreditUpsellSeenCount,
  OverageCreditUpsell,
  useShowOverageCreditUpsell,
} from './OverageCreditUpsell.js'

const LIKECODE_BLUE = 'rgb(88,166,255)'
const LIKECODE_HEART = 'rgb(255,120,170)'

function SectionHeader({
  title,
  width,
}: {
  title: string
  width: number
}) {
  const lineWidth = Math.max(width - stringWidth(title) - 2, 8)

  return (
    <Text>
      <Text color={LIKECODE_BLUE} bold>
        {title}
      </Text>
      <Text color={LIKECODE_BLUE}>{' ─'.repeat(Math.max(Math.floor(lineWidth / 2), 4))}</Text>
    </Text>
  )
}

function InfoDot() {
  return (
    <Text dimColor>
      {' · '}
    </Text>
  )
}

function Metric({
  label,
  value,
  color = 'greenBright',
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <Text>
      <Text dimColor>{label} </Text>
      <Text color={color} bold>
        {value}
      </Text>
    </Text>
  )
}

function ConfigLayerLine({ item }: { item: LayeredConfigSummaryItem }) {
  const labelColor =
    item.label === 'Global'
      ? 'cyanBright'
      : item.label === 'Project'
        ? 'blueBright'
        : 'magentaBright'

  return (
    <Text>
      <Text color={labelColor} bold>
        {item.label}
      </Text>
      <Text dimColor> {item.source}</Text>
      <InfoDot />
      {item.skills != null ? (
        <>
          <Metric label="skills" value={item.skills} />
          <InfoDot />
        </>
      ) : null}
      <Metric label="rules" value={item.rules} color="yellowBright" />
      <InfoDot />
      <Metric label="hooks" value={item.hooks} color="cyanBright" />
      {item.modelRoutes != null ? (
        <>
          <InfoDot />
          <Metric
            label="routes"
            value={item.modelRoutes}
            color="magentaBright"
          />
        </>
      ) : null}
    </Text>
  )
}

function getRouteAliases(alias: string | string[] | undefined): string[] {
  if (Array.isArray(alias)) {
    return alias.map(value => value.trim()).filter(Boolean)
  }
  return alias?.trim() ? [alias.trim()] : []
}

function formatRouteSource(source?: string): string | undefined {
  if (!source) return undefined
  if (source.includes('MODEL_ROUTES_JSON')) return source

  const cwdRelative = relative(process.cwd(), source)
  if (cwdRelative && !cwdRelative.startsWith('..')) {
    return cwdRelative
  }

  const homeRelative = relative(homedir(), source)
  if (homeRelative && !homeRelative.startsWith('..')) {
    return `~/${homeRelative}`
  }

  return source
}

function formatRouteHost(baseURL?: string): string | undefined {
  if (!baseURL) return undefined
  try {
    return new URL(baseURL).host
  } catch {
    return baseURL
  }
}

type RouteModelSummary = {
  alias: string
  model: string
  host?: string
  source?: string
}

type RouteModelGroup = {
  host: string
  sources: string[]
  items: RouteModelSummary[]
}

type AvailableModelSummary = {
  label: string
  value: string
}

function getRouteModelSummaries(): {
  count: number
  items: RouteModelSummary[]
} {
  const routes = Object.entries(getConfiguredModelRouteDetails()).filter(
    ([model]) => model.trim() && !model.includes('*'),
  )

  return {
    count: routes.length,
    items: routes.flatMap(([model, route]) => {
      const aliases = getRouteAliases(route.alias)
      const names = aliases.length > 0 ? aliases : [model]
      return names.map(alias => ({
        alias,
        model,
        host: formatRouteHost(route.baseURL),
        source: formatRouteSource(route.source),
      }))
    }),
  }
}

function getRouteModelGroups(items: RouteModelSummary[]): RouteModelGroup[] {
  const groups = new Map<string, RouteModelGroup>()
  for (const item of items) {
    const host = item.host ?? 'custom route'
    const group = groups.get(host) ?? {
      host,
      sources: [],
      items: [],
    }
    if (item.source && !group.sources.includes(item.source)) {
      group.sources.push(item.source)
    }
    group.items.push(item)
    groups.set(host, group)
  }
  return [...groups.values()]
}

function getAvailableModelSummaries(): AvailableModelSummary[] {
  const routeModels = new Set(Object.keys(getConfiguredModelRouteDetails()))
  const summaries = getModelOptions(false)
    .filter(option => option.value !== null)
    .filter(option => !routeModels.has(String(option.value)))
    .map(option => {
      const value = String(option.value)
      return {
        label: option.label.trim() || value,
        value,
      }
    })

  const seen = new Set<string>()
  return summaries.filter(item => {
    const key = `${item.label}:${item.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ModelInventoryHeader({
  title,
  count,
  width,
}: {
  title: string
  count: number
  width: number
}) {
  const headerText = `${title} ${count}`
  const ruleWidth = Math.max(0, width - stringWidth(headerText) - 2)

  return (
    <Text>
      <Text color={LIKECODE_BLUE} bold>
        {title}
      </Text>
      <Text dimColor> </Text>
      <Text color="magentaBright" bold>
        {count}
      </Text>
      {ruleWidth > 4 ? (
        <Text color={LIKECODE_BLUE}>
          {' '}{'─'.repeat(Math.floor(ruleWidth / 2))}
        </Text>
      ) : null}
    </Text>
  )
}

function AvailableModelLine({
  item,
  width,
}: {
  item: AvailableModelSummary
  width: number
}) {
  return (
    <Text wrap="truncate">
      <Text dimColor>{'  - '}</Text>
      <Text color="cyanBright" bold>
        {truncate(item.label, Math.max(10, Math.floor(width * 0.54)))}
      </Text>
      <Text dimColor> -> </Text>
      <Text color="whiteBright">
        {truncate(item.value, Math.max(10, Math.floor(width * 0.34)))}
      </Text>
    </Text>
  )
}

function RouteModelLine({
  item,
  width,
}: {
  item: RouteModelSummary
  width: number
}) {
  return (
    <Text wrap="truncate">
      <Text dimColor>{'    - '}</Text>
      <Text color="cyanBright" bold>
        {truncate(item.alias, Math.max(8, Math.floor(width * 0.24)))}
      </Text>
      <Text dimColor> -> </Text>
      <Text color="whiteBright">
        {truncate(item.model, Math.max(12, Math.floor(width * 0.62)))}
      </Text>
    </Text>
  )
}

function RouteModelGroupView({
  group,
  width,
  marginTop = 1,
}: {
  group: RouteModelGroup
  width: number
  marginTop?: number
}) {
  const sourceText = group.sources.join(', ')
  const sourceBudget = Math.max(12, width - stringWidth(group.host) - 8)

  return (
    <Box flexDirection="column" marginTop={marginTop}>
      <Text wrap="truncate">
        <Text dimColor>{'  '}</Text>
        <Text color="greenBright" bold>
          {truncate(group.host, Math.max(12, Math.floor(width * 0.42)))}
        </Text>
        {sourceText ? (
          <>
            <Text dimColor> · </Text>
            <Text dimColor>{truncate(sourceText, sourceBudget, true)}</Text>
          </>
        ) : null}
      </Text>
      {group.items.map(item => (
        <RouteModelLine
          key={`${group.host}-${item.alias}-${item.model}`}
          item={item}
          width={width}
        />
      ))}
    </Box>
  )
}

function ModelInventory({
  availableModels,
  routeModels,
  width,
}: {
  availableModels: AvailableModelSummary[]
  routeModels: { count: number; items: RouteModelSummary[] }
  width: number
}) {
  if (availableModels.length === 0 && routeModels.items.length === 0) {
    return null
  }
  const availableWidth = width
  const routeWidth = width
  const routeGroups = getRouteModelGroups(routeModels.items)

  return (
    <Box
      marginTop={0}
      flexDirection="column"
      width={width}
      alignItems="flex-start"
    >
      {availableModels.length > 0 ? (
        <Box
          flexDirection="column"
          width={availableWidth}
        >
          <ModelInventoryHeader
            title="Available models"
            count={availableModels.length}
            width={availableWidth}
          />
          {availableModels.map(item => (
            <AvailableModelLine
              key={`${item.label}-${item.value}`}
              item={item}
              width={availableWidth}
            />
          ))}
        </Box>
      ) : null}
      {routeModels.items.length > 0 ? (
        <Box
          marginTop={availableModels.length > 0 ? 1 : 0}
          flexDirection="column"
          width={routeWidth}
        >
          <ModelInventoryHeader
            title="Route models"
            count={routeModels.count}
            width={routeWidth}
          />
          {routeGroups.map((group, index) => (
            <RouteModelGroupView
              key={group.host}
              group={group}
              width={routeWidth}
              marginTop={index === 0 ? 0 : 1}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

function VerticalDivider({ height }: { height: number }) {
  return (
    <Box
      height={height}
      borderStyle="single"
      borderColor={LIKECODE_BLUE}
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      width={1}
    />
  )
}

export function CondensedLogo() {
  const { columns } = useTerminalSize()
  const agent = useAppState(state => state.agent)
  const effortValue = useAppState(state => state.effortValue)
  const backgroundTasksShortcut = useShortcutDisplay(
    'app:toggleBackgroundTasks',
    'Global',
    'alt+b',
  )
  const model = useMainLoopModel()
  const modelDisplayName = renderModelSetting(model)
  const {
    cwd,
    billingType,
    agentName: agentNameFromSettings,
    commandPath,
  } =
    getLogoDisplayData()
  const configSummaryItems = getLayeredConfigSummaryItems()
  const agentName = agent ?? agentNameFromSettings
  const showGuestPassesUpsell = useShowGuestPassesUpsell()
  const showOverageCreditUpsell = useShowOverageCreditUpsell()

  useEffect(() => {
    if (showGuestPassesUpsell) {
      incrementGuestPassesSeenCount()
    }
  }, [showGuestPassesUpsell])

  useEffect(() => {
    if (showOverageCreditUpsell && !showGuestPassesUpsell) {
      incrementOverageCreditUpsellSeenCount()
    }
  }, [showOverageCreditUpsell, showGuestPassesUpsell])

  const textWidth = Math.max(columns - 15, 20)
  const effortSuffix = getEffortSuffix(model, effortValue)
  const { shouldSplit, truncatedModel, truncatedBilling } = formatModelAndBilling(
    modelDisplayName + effortSuffix,
    billingType,
    textWidth,
  )
  const restoredBilling = `${truncatedBilling} · Harzva restored`
  const cwdAvailableWidth = agentName
    ? textWidth - 1 - stringWidth(agentName) - 3
    : textWidth
  const truncatedCwd = truncatePath(cwd, Math.max(cwdAvailableWidth, 10))
  const workspaceLine = agentName
    ? `Harzva restored · @${agentName} · ${truncatedCwd}`
    : `Harzva restored · ${truncatedCwd}`
  const truncatedCommandPath = truncate(commandPath, Math.max(textWidth, 20))
  const webWorkspaceUrl = getWorkspaceApiBaseUrl()
  const likeLogo = [
    '  /\\_/\\\\',
    ' ( o.o )',
    '  > ^ <',
  ]
  const recentActivity = getRecentActivitySync().slice(0, 3)
  const recentNotes = getRecentReleaseNotesSync(3)
  const contentWidth = Math.max(columns - 6, 30)
  const dashboardLayout = columns >= 120
  const rightWidth = Math.max(Math.floor(columns * 0.43), 32)
  const leftWidth = Math.max(columns - rightWidth - 9, 32)
  const statusPanelWidth = dashboardLayout
    ? Math.max(34, Math.floor(contentWidth * 0.3))
    : Math.max(leftWidth - 2, 30)
  const rightPanelWidth = dashboardLayout
    ? Math.max(34, Math.floor(contentWidth * 0.3))
    : Math.max(rightWidth - 2, 30)
  const inventoryWidth = dashboardLayout
    ? Math.max(52, contentWidth - statusPanelWidth - rightPanelWidth - 4)
    : contentWidth
  const isTwoColumn = columns >= 92
  const title = ` Like Code v2.1.88 `
  const routeModelSummary = getRouteModelSummaries()
  const availableModelSummary = getAvailableModelSummaries()
  const dashboardDividerHeight = 15

  return (
    <OffscreenFreeze>
      <Box flexDirection="column">
        <Box
          borderStyle="round"
          borderColor={LIKECODE_BLUE}
          borderText={title}
          paddingX={1}
          paddingY={0}
          flexDirection="column"
        >
          <Box
            flexDirection={dashboardLayout || isTwoColumn ? 'row' : 'column'}
            gap={dashboardLayout ? 1 : isTwoColumn ? 1 : 0}
          >
            <Box
              width={dashboardLayout || isTwoColumn ? statusPanelWidth : undefined}
              flexDirection="column"
              alignItems="flex-start"
              paddingRight={dashboardLayout || isTwoColumn ? 1 : 0}
            >
              <Text>
                <Text color={LIKECODE_BLUE} bold>
                  LIKE CODE
                </Text>
                <Text color={LIKECODE_HEART} bold>
                  {' ♥'}
                </Text>
              </Text>
              <Box marginTop={1} marginBottom={1} flexDirection="column" alignItems="flex-start">
                {likeLogo.map((line, index) => (
                  <Text key={`${line}-${index}`} color={LIKECODE_BLUE} bold>
                    {line}
                  </Text>
                ))}
              </Box>

              {shouldSplit ? (
                <>
                  <Text color={LIKECODE_BLUE} bold>
                    {truncate(truncatedModel, statusPanelWidth - 2)}
                  </Text>
                  <Text>
                    <Text color="yellowBright">
                      {truncate(truncatedBilling, statusPanelWidth - 2)}
                    </Text>
                    <Text dimColor> · </Text>
                    <Text color="greenBright">Harzva restored</Text>
                  </Text>
                </>
              ) : (
                <Text>
                  <Text color={LIKECODE_BLUE} bold>
                    {truncate(truncatedModel, statusPanelWidth - 24)}
                  </Text>
                  <Text dimColor> · </Text>
                  <Text color="yellowBright">{truncatedBilling}</Text>
                </Text>
              )}

              <Text dimColor>{truncate(workspaceLine, statusPanelWidth)}</Text>
              <Text dimColor>{truncate(truncatedCommandPath, statusPanelWidth)}</Text>
              <Box marginTop={1} flexDirection="column">
                {configSummaryItems.map(item => (
                  <ConfigLayerLine
                    key={`${item.label}-${item.source}`}
                    item={item}
                  />
                ))}
              </Box>
            </Box>

            {dashboardLayout ? (
              <VerticalDivider height={dashboardDividerHeight} />
            ) : null}

            {dashboardLayout ? (
              <Box width={inventoryWidth} flexDirection="column">
                <ModelInventory
                  availableModels={availableModelSummary}
                  routeModels={routeModelSummary}
                  width={inventoryWidth}
                />
              </Box>
            ) : null}

            {isTwoColumn ? (
              <VerticalDivider height={dashboardLayout ? dashboardDividerHeight : 12} />
            ) : null}

            <Box
              flexGrow={1}
              width={dashboardLayout || isTwoColumn ? rightPanelWidth : undefined}
              flexDirection="column"
              paddingLeft={isTwoColumn ? 2 : 0}
              marginTop={isTwoColumn ? 0 : 1}
            >
              <SectionHeader
                title="Tips for getting started"
                width={rightPanelWidth}
              />
              <Text>
                Run <Text color={LIKECODE_BLUE}>/show:slash</Text> to inspect built-in commands
              </Text>
              <Text>
                Web <Text color={LIKECODE_BLUE}>{truncate(webWorkspaceUrl, rightPanelWidth - 6)}</Text>
              </Text>
              <Text>
                Press <Text color={LIKECODE_BLUE}>{backgroundTasksShortcut}</Text> for tasks/HUD
              </Text>

              <Box marginTop={1} flexDirection="column">
                <SectionHeader
                  title="Recent activity"
                  width={rightPanelWidth}
                />
                {recentActivity.length > 0 ? (
                  recentActivity.map(log => {
                    const description =
                      log.summary && log.summary !== 'No prompt'
                        ? log.summary
                        : log.firstPrompt || 'No prompt'

                    return (
                      <Text key={log.sessionId ?? description}>
                        {truncate(description, rightPanelWidth)}
                      </Text>
                    )
                  })
                ) : (
                  <Text dimColor>No recent activity</Text>
                )}
              </Box>

              <Box marginTop={1} flexDirection="column">
                <SectionHeader title="What's new" width={rightPanelWidth} />
                {recentNotes.length > 0 ? (
                  recentNotes.map(note => (
                    <Text key={note}>
                      {formatReleaseNoteForDisplay(note, rightPanelWidth)}
                    </Text>
                  ))
                ) : (
                  <Text dimColor>Check the changelog for updates</Text>
                )}
              </Box>
            </Box>
          </Box>

          {!dashboardLayout ? (
            <Box marginTop={1}>
              <ModelInventory
                availableModels={availableModelSummary}
                routeModels={routeModelSummary}
                width={inventoryWidth}
              />
            </Box>
          ) : null}

          <Box marginTop={1} flexDirection="column">
            {showGuestPassesUpsell ? <GuestPassesUpsell /> : null}
            {!showGuestPassesUpsell && showOverageCreditUpsell ? (
              <OverageCreditUpsell maxWidth={textWidth} twoLine />
            ) : null}
          </Box>
        </Box>
      </Box>
    </OffscreenFreeze>
  )
}
