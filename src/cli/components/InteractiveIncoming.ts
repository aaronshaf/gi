import { Box, Text, useApp, useInput } from 'ink'
import React, { useState } from 'react'
import { exec } from 'node:child_process'
import type { ChangeInfo } from '@/schemas/gerrit'
import { colors } from '@/utils/formatters'
import { sanitizeUrlSync, getOpenCommand } from '@/utils/shell-safety'
import { getStatusString, getLabelValue, getLabelColor } from '@/utils/status-indicators'

interface InteractiveIncomingProps {
  changes: readonly ChangeInfo[]
  gerritHost?: string
}

type ViewMode = 'list' | 'detail' | 'diff' | 'help'

const openChangeInBrowser = (change: ChangeInfo, gerritHost?: string) => {
  if (!gerritHost) {
    return
  }

  try {
    const changeUrl = `${gerritHost}/c/${change.project}/+/${change._number}`
    const safeUrl = sanitizeUrlSync(changeUrl)
    const openCmd = getOpenCommand()

    exec(`${openCmd} "${safeUrl}"`, (error) => {
      if (error) {
        console.error(`Failed to open URL: ${error.message}`)
      }
    })
  } catch (error) {
    console.error(
      `Failed to sanitize URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

export const InteractiveIncoming = ({
  changes,
  gerritHost,
}: InteractiveIncomingProps): React.ReactElement => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const { exit } = useApp()

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      if (viewMode !== 'list') {
        setViewMode('list')
        return
      }
      exit()
      return
    }

    if (input === '?' || input === 'h') {
      setViewMode('help')
      return
    }

    if (viewMode === 'list') {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
        return
      }

      if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(changes.length - 1, prev + 1))
        return
      }

      if (key.return || input === 'd') {
        setViewMode('detail')
        return
      }

      if (input === 'f') {
        setViewMode('diff')
        return
      }

      if (input === 'o') {
        openChangeInBrowser(changes[selectedIndex], gerritHost)
        return
      }
    }

    if (viewMode === 'detail') {
      if (input === 'f') {
        setViewMode('diff')
        return
      }
      if (input === 'o') {
        openChangeInBrowser(changes[selectedIndex], gerritHost)
        return
      }
      if (key.return || input === 'b' || key.leftArrow) {
        setViewMode('list')
        return
      }
    }

    if (viewMode === 'diff') {
      if (input === 'd') {
        setViewMode('detail')
        return
      }
      if (input === 'o') {
        openChangeInBrowser(changes[selectedIndex], gerritHost)
        return
      }
      if (key.return || input === 'b' || key.leftArrow) {
        setViewMode('list')
        return
      }
    }
  })

  if (changes.length === 0) {
    return React.createElement(Box, { flexDirection: 'column' }, [
      React.createElement(Text, { key: 'no-changes' }, 'No incoming changes found'),
      React.createElement(Text, { key: 'exit-hint', dimColor: true }, 'Press q to exit'),
    ])
  }

  if (viewMode === 'help') {
    return renderHelpView()
  }

  if (viewMode === 'list') {
    return renderListView(changes, selectedIndex, setSelectedIndex)
  }

  const selectedChange = changes[selectedIndex]
  if (viewMode === 'detail') {
    return renderDetailView(selectedChange)
  }

  if (viewMode === 'diff') {
    return renderDiffView(selectedChange)
  }

  return React.createElement(Text, null, 'Unknown view mode')
}

function renderListView(
  changes: readonly ChangeInfo[],
  selectedIndex: number,
  _setSelectedIndex: React.Dispatch<React.SetStateAction<number>>,
): React.ReactElement {
  // Group changes by project
  const changesByProject = changes.reduce(
    (acc, change, index) => {
      if (!acc[change.project]) {
        acc[change.project] = []
      }
      acc[change.project].push({ change, index })
      return acc
    },
    {} as Record<string, Array<{ change: ChangeInfo; index: number }>>,
  )

  const sortedProjects = Object.keys(changesByProject).sort()

  const projectElements = sortedProjects.map((project) =>
    React.createElement(Box, { key: project, flexDirection: 'column', marginBottom: 1 }, [
      React.createElement(Text, { key: `${project}-title`, color: 'blue', bold: true }, project),
      ...changesByProject[project].map(({ change, index }) => {
        const isCursor = selectedIndex === index
        const ownerName = change.owner?.name || change.owner?.username || 'Unknown'

        const paddedStatus = getStatusString(change)

        return React.createElement(
          Box,
          { key: `${project}-${change._number}`, paddingLeft: 2 },
          React.createElement(
            Text,
            {
              color: isCursor ? 'cyan' : undefined,
              backgroundColor: isCursor ? 'gray' : undefined,
            },
            `${isCursor ? '▶ ' : '  '}${paddedStatus} ${change._number}  ${change.subject} ${colors.dim}(by ${ownerName})${colors.reset}`,
          ),
        )
      }),
    ]),
  )

  return React.createElement(Box, { flexDirection: 'column' }, [
    React.createElement(
      Box,
      { key: 'header', marginBottom: 1 },
      React.createElement(Text, { bold: true }, 'Interactive Incoming Changes'),
    ),
    ...projectElements,
    React.createElement(Box, { key: 'footer', marginTop: 1, flexDirection: 'column' }, [
      React.createElement(
        Text,
        { key: 'nav-help', dimColor: true },
        '↑/↓: Navigate | Enter/d: View details | f: View diff | o: Open in browser',
      ),
      React.createElement(Text, { key: 'exit-help', dimColor: true }, 'q/Ctrl+C: Exit'),
    ]),
  ])
}

function renderDetailView(change: ChangeInfo): React.ReactElement {
  const ownerName = change.owner?.name || change.owner?.username || 'Unknown'
  const ownerEmail = change.owner?.email || ''

  // Note: reviewers not available in basic ChangeInfo schema
  const reviewerNames: string[] = []

  return React.createElement(Box, { flexDirection: 'column', padding: 1 }, [
    React.createElement(
      Text,
      { key: 'title', bold: true, color: 'cyan' },
      `Change ${change._number}`,
    ),
    React.createElement(Text, { key: 'subject', bold: true }, change.subject),
    React.createElement(Text, { key: 'spacer1' }, ''),

    React.createElement(Box, { key: 'metadata', flexDirection: 'column' }, [
      React.createElement(Text, { key: 'project' }, `Project: ${change.project}`),
      React.createElement(Text, { key: 'branch' }, `Branch: ${change.branch}`),
      React.createElement(Text, { key: 'status' }, `Status: ${change.status}`),
      React.createElement(
        Text,
        { key: 'owner' },
        `Owner: ${ownerName}${ownerEmail ? ` <${ownerEmail}>` : ''}`,
      ),
      reviewerNames.length > 0 &&
        React.createElement(Text, { key: 'reviewers' }, `Reviewers: ${reviewerNames.join(', ')}`),
      change.updated && React.createElement(Text, { key: 'updated' }, `Updated: ${change.updated}`),
    ]),

    // Note: revision info not available in basic ChangeInfo schema

    React.createElement(Box, { key: 'labels', flexDirection: 'column' }, [
      React.createElement(Text, { key: 'spacer3' }, ''),
      React.createElement(Text, { key: 'labels-title', bold: true }, 'Labels:'),
      ...Object.entries(change.labels || {}).map(([label, labelInfo]) => {
        const labelValue = getLabelValue(labelInfo)
        const labelColor = getLabelColor(labelValue)
        return React.createElement(
          Text,
          { key: label, color: labelColor },
          `  ${label}: ${labelValue > 0 ? '+' : ''}${labelValue}`,
        )
      }),
    ]),

    React.createElement(Box, { key: 'footer', marginTop: 2, flexDirection: 'column' }, [
      React.createElement(
        Text,
        { key: 'nav-help', dimColor: true },
        'f: View diff | o: Open in browser | Enter/b/←: Back to list | q: Exit',
      ),
    ]),
  ])
}

function renderHelpView(): React.ReactElement {
  return React.createElement(Box, { flexDirection: 'column', padding: 1 }, [
    React.createElement(Text, { key: 'title', bold: true, color: 'cyan' }, 'Help'),
    React.createElement(Text, { key: 'spacer1' }, ''),

    React.createElement(Text, { key: 'navigation-title', bold: true }, 'Navigation:'),
    React.createElement(Text, { key: 'up-down' }, '  ↑/↓ - Navigate changes'),
    React.createElement(Text, { key: 'enter-detail' }, '  Enter/d - View change details'),
    React.createElement(Text, { key: 'diff' }, '  f - View diff (placeholder)'),
    React.createElement(Text, { key: 'open' }, '  o - Open change in browser'),
    React.createElement(Text, { key: 'back' }, '  b/← - Back to previous view'),
    React.createElement(Text, { key: 'quit' }, '  q - Quit'),
    React.createElement(Text, { key: 'spacer2' }, ''),

    React.createElement(Text, { key: 'status-title', bold: true }, 'Status Indicators:'),
    React.createElement(Text, { key: 'approved' }, '  ✓ - Approved/Verified'),
    React.createElement(Text, { key: 'rejected' }, '  ✗ - Rejected/Failed'),
    React.createElement(Text, { key: 'recommended' }, '  ↑ - Recommended (+1)'),
    React.createElement(Text, { key: 'disliked' }, '  ↓ - Disliked (-1)'),
    React.createElement(Text, { key: 'spacer3' }, ''),

    React.createElement(
      Text,
      { key: 'back-help', dimColor: true },
      'Press q to go back or Ctrl+C to exit',
    ),
  ])
}

function renderDiffView(change: ChangeInfo): React.ReactElement {
  return React.createElement(Box, { flexDirection: 'column', padding: 1 }, [
    React.createElement(
      Text,
      { key: 'title', bold: true, color: 'cyan' },
      `Diff for Change ${change._number}`,
    ),
    React.createElement(Text, { key: 'subject' }, change.subject),
    React.createElement(Text, { key: 'spacer1' }, ''),

    React.createElement(Box, { key: 'diff-placeholder', padding: 1, borderStyle: 'single' }, [
      React.createElement(Text, { key: 'coming-soon' }, 'Diff view coming soon!'),
      React.createElement(
        Text,
        { key: 'placeholder-info', dimColor: true },
        'This will show a side-by-side diff of the changes.',
      ),
    ]),

    React.createElement(Box, { key: 'footer', flexDirection: 'column' }, [
      React.createElement(Text, { key: 'spacer2' }, ''),
      React.createElement(Text, { key: 'spacer3' }, ''),
      React.createElement(
        Text,
        { key: 'nav-help', dimColor: true },
        'd: View details | o: Open in browser | Enter/b/←: Back to list | q: Exit',
      ),
    ]),
  ])
}
