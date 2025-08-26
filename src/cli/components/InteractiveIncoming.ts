import { Box, Text, useApp, useInput } from 'ink'
import React, { useState } from 'react'
import { exec } from 'node:child_process'
import type { ChangeInfo } from '@/schemas/gerrit'
import { colors } from '@/utils/formatters'

interface InteractiveIncomingProps {
  changes: readonly ChangeInfo[]
  gerritHost?: string
}

type ViewMode = 'list' | 'detail' | 'diff' | 'help'

const openChangeInBrowser = (change: ChangeInfo, gerritHost?: string) => {
  if (!gerritHost) {
    return
  }

  const changeUrl = `${gerritHost}/c/${change.project}/+/${change._number}`
  const openCmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'

  exec(`${openCmd} "${changeUrl}"`, (error) => {
    if (error) {
      console.error(`Failed to open URL: ${error.message}`)
    }
  })
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

        // Build status indicators
        const indicators: string[] = []
        if (change.labels?.['Code-Review']) {
          const cr = change.labels['Code-Review']
          if (cr.approved || cr.value === 2) indicators.push('✅')
          else if (cr.rejected || cr.value === -2) indicators.push('❌')
          else if (cr.recommended || cr.value === 1) indicators.push('👍')
          else if (cr.disliked || cr.value === -1) indicators.push('👎')
        }

        if (change.labels?.['Verified']) {
          const v = change.labels.Verified
          if (v.approved || v.value === 1) {
            if (!indicators.includes('✅')) indicators.push('✅')
          } else if (v.rejected || v.value === -1) {
            indicators.push('❌')
          }
        }

        const statusStr = indicators.length > 0 ? indicators.join(' ') : '        '
        const paddedStatus = statusStr.padEnd(8, ' ')

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
        const labelValue =
          typeof labelInfo === 'object' && labelInfo !== null && 'value' in labelInfo
            ? (labelInfo as any).value || 0
            : 0
        const labelColor = labelValue > 0 ? 'green' : labelValue < 0 ? 'red' : 'yellow'
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
