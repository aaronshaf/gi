import { Box, Text, useApp, useInput } from 'ink'
import React, { useState } from 'react'
import { exec } from 'node:child_process'
import type { ChangeInfo } from '@/schemas/gerrit'
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
    // Global shortcuts (work in all modes)
    if (input === 'q' || (key.ctrl && input === 'c')) {
      if (viewMode !== 'list') {
        setViewMode('list')
        return
      }
      exit()
      return
    }

    if (input === '?') {
      setViewMode('help')
      return
    }

    if (viewMode === 'list') {
      // Navigation (Gerrit-like)
      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
        return
      }

      if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => Math.min(changes.length - 1, prev + 1))
        return
      }

      // Page navigation
      if (key.pageUp || input === 'K') {
        setSelectedIndex((prev) => Math.max(0, prev - 10))
        return
      }

      if (key.pageDown || input === 'J') {
        setSelectedIndex((prev) => Math.min(changes.length - 1, prev + 10))
        return
      }

      // First/last item (vim-like)
      if (input === 'g') {
        setSelectedIndex(0)
        return
      }

      if (input === 'G') {
        setSelectedIndex(changes.length - 1)
        return
      }

      // View actions (Gerrit-like)
      if (key.return || input === 'c') {
        setViewMode('detail')
        return
      }

      if (input === 'd') {
        setViewMode('diff')
        return
      }

      if (input === 'o') {
        openChangeInBrowser(changes[selectedIndex], gerritHost)
        return
      }
    }

    if (viewMode === 'detail') {
      // Gerrit-like shortcuts
      if (input === 'd') {
        setViewMode('diff')
        return
      }
      if (input === 'o') {
        openChangeInBrowser(changes[selectedIndex], gerritHost)
        return
      }
      if (key.return || input === 'u' || key.escape) {
        setViewMode('list')
        return
      }
    }

    if (viewMode === 'diff') {
      if (input === 'c') {
        setViewMode('detail')
        return
      }
      if (input === 'o') {
        openChangeInBrowser(changes[selectedIndex], gerritHost)
        return
      }
      if (key.return || input === 'u' || key.escape) {
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
      // Project header with better styling
      React.createElement(
        Box,
        { key: `${project}-header`, borderStyle: 'round', borderColor: 'blue', padding: 1 },
        React.createElement(Text, { color: 'blue', bold: true }, `📁 ${project}`),
      ),
      // Changes in this project
      ...changesByProject[project].map(({ change, index }) => {
        const isCursor = selectedIndex === index
        const ownerName = change.owner?.name || change.owner?.username || 'Unknown'
        const paddedStatus = getStatusString(change)

        // Calculate relative time
        const updatedDate = change.updated ? new Date(change.updated) : new Date()
        const now = new Date()
        const diffMs = now.getTime() - updatedDate.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const timeAgo = diffDays === 0 ? 'today' : diffDays === 1 ? '1 day ago' : `${diffDays}d ago`

        return React.createElement(
          Box,
          {
            key: `${project}-${change._number}`,
            borderStyle: isCursor ? 'single' : undefined,
            borderColor: isCursor ? 'cyan' : undefined,
            padding: isCursor ? 1 : 0,
            marginLeft: 2,
            marginY: isCursor ? 1 : 0,
          },
          React.createElement(Box, { flexDirection: 'column' }, [
            // Main change line
            React.createElement(
              Text,
              {
                key: 'main',
                color: isCursor ? 'cyan' : undefined,
                bold: isCursor,
              },
              `${isCursor ? '→ ' : '  '}${paddedStatus} ${change._number}  ${change.subject}`,
            ),
            // Author and time info
            React.createElement(
              Text,
              {
                key: 'meta',
                dimColor: true,
                color: isCursor ? 'gray' : undefined,
              },
              `    👤 ${ownerName} • ⏰ ${timeAgo}`,
            ),
          ]),
        )
      }),
    ]),
  )

  return React.createElement(Box, { flexDirection: 'column' }, [
    // Header with Gerrit-style title
    React.createElement(
      Box,
      { key: 'header', marginBottom: 1, borderStyle: 'double', borderColor: 'green', padding: 1 },
      [
        React.createElement(
          Text,
          { key: 'title', bold: true, color: 'green' },
          '⚡ Gerrit Code Review - Incoming Changes',
        ),
        React.createElement(
          Text,
          { key: 'count', dimColor: true },
          `${changes.length} changes waiting for your review`,
        ),
      ],
    ),
    ...projectElements,
    // Enhanced footer with Gerrit-like shortcuts
    React.createElement(
      Box,
      {
        key: 'footer',
        marginTop: 1,
        borderStyle: 'single',
        borderColor: 'gray',
        padding: 1,
        flexDirection: 'column',
      },
      [
        React.createElement(
          Text,
          { key: 'nav-title', bold: true, color: 'yellow' },
          'Keyboard Shortcuts (Gerrit-style):',
        ),
        React.createElement(
          Text,
          { key: 'nav-basic', dimColor: true },
          'j/k or ↑/↓: Navigate • c/Enter: View change • d: View diff • o: Open in browser',
        ),
        React.createElement(
          Text,
          { key: 'nav-advanced', dimColor: true },
          'g/G: First/Last • J/K: Page up/down • u/Esc: Back • ?: Help • q: Quit',
        ),
      ],
    ),
  ])
}

function renderDetailView(change: ChangeInfo): React.ReactElement {
  const ownerName = change.owner?.name || change.owner?.username || 'Unknown'
  const ownerEmail = change.owner?.email || ''

  // Calculate relative time
  const updatedDate = change.updated ? new Date(change.updated) : new Date()
  const now = new Date()
  const diffMs = now.getTime() - updatedDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const timeAgo = diffDays === 0 ? 'today' : diffDays === 1 ? '1 day ago' : `${diffDays}d ago`

  return React.createElement(Box, { flexDirection: 'column', padding: 1 }, [
    // Header with Gerrit-style title
    React.createElement(
      Box,
      { key: 'header', borderStyle: 'double', borderColor: 'cyan', padding: 1, marginBottom: 1 },
      [
        React.createElement(
          Text,
          { key: 'title', bold: true, color: 'cyan' },
          `🔍 Change ${change._number} - ${change.project}`,
        ),
        React.createElement(Text, { key: 'subject', bold: true, color: 'white' }, change.subject),
      ],
    ),

    // Metadata section
    React.createElement(
      Box,
      {
        key: 'metadata',
        borderStyle: 'single',
        borderColor: 'blue',
        padding: 1,
        marginBottom: 1,
        flexDirection: 'column',
      },
      [
        React.createElement(
          Text,
          { key: 'meta-title', bold: true, color: 'blue' },
          '📋 Change Information:',
        ),
        React.createElement(Text, { key: 'project' }, `📁 Project: ${change.project}`),
        React.createElement(Text, { key: 'branch' }, `🌿 Branch: ${change.branch}`),
        React.createElement(Text, { key: 'status' }, `📊 Status: ${change.status}`),
        React.createElement(
          Text,
          { key: 'owner' },
          `👤 Owner: ${ownerName}${ownerEmail ? ` <${ownerEmail}>` : ''}`,
        ),
        change.updated && React.createElement(Text, { key: 'updated' }, `⏰ Updated: ${timeAgo}`),
      ],
    ),

    // Labels section
    React.createElement(
      Box,
      {
        key: 'labels',
        borderStyle: 'single',
        borderColor: 'magenta',
        padding: 1,
        flexDirection: 'column',
      },
      [
        React.createElement(
          Text,
          { key: 'labels-title', bold: true, color: 'magenta' },
          '🏷️  Labels & Reviews:',
        ),
        Object.keys(change.labels || {}).length === 0
          ? React.createElement(Text, { key: 'no-labels', dimColor: true }, '  No labels set')
          : Object.entries(change.labels || {}).map(([label, labelInfo]) => {
              const labelValue = getLabelValue(labelInfo)
              const labelColor = getLabelColor(labelValue)
              const icon = labelValue > 0 ? '✅' : labelValue < 0 ? '❌' : '⚪'
              return React.createElement(
                Text,
                { key: label, color: labelColor },
                `  ${icon} ${label}: ${labelValue > 0 ? '+' : ''}${labelValue}`,
              )
            }),
      ],
    ),

    React.createElement(
      Box,
      {
        key: 'footer',
        marginTop: 2,
        borderStyle: 'single',
        borderColor: 'gray',
        padding: 1,
        flexDirection: 'column',
      },
      [
        React.createElement(
          Text,
          { key: 'shortcuts-title', bold: true, color: 'yellow' },
          'Gerrit-style shortcuts:',
        ),
        React.createElement(
          Text,
          { key: 'nav-help', dimColor: true },
          'd: View diff • o: Open in browser • u/Esc: Back to list • q: Quit',
        ),
      ],
    ),
  ])
}

function renderHelpView(): React.ReactElement {
  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'double', borderColor: 'yellow', padding: 2 },
    [
      React.createElement(
        Text,
        { key: 'title', bold: true, color: 'yellow' },
        '⚡ Gerrit-style Keyboard Shortcuts',
      ),
      React.createElement(Text, { key: 'spacer1' }, ''),

      React.createElement(
        Text,
        { key: 'navigation-title', bold: true, color: 'cyan' },
        '📍 Navigation (Vim-like):',
      ),
      React.createElement(Text, { key: 'vim-nav' }, '  j/k or ↑/↓ - Navigate up/down'),
      React.createElement(Text, { key: 'page-nav' }, '  J/K - Jump 10 items up/down'),
      React.createElement(Text, { key: 'first-last' }, '  g/G - Go to first/last item'),
      React.createElement(Text, { key: 'spacer2' }, ''),

      React.createElement(
        Text,
        { key: 'actions-title', bold: true, color: 'green' },
        '🎯 Actions (Gerrit-style):',
      ),
      React.createElement(Text, { key: 'view-change' }, '  c/Enter - View change details'),
      React.createElement(Text, { key: 'view-diff' }, '  d - View diff'),
      React.createElement(Text, { key: 'open-browser' }, '  o - Open in browser'),
      React.createElement(Text, { key: 'back' }, '  u/Esc - Back to previous view'),
      React.createElement(Text, { key: 'spacer3' }, ''),

      React.createElement(
        Text,
        { key: 'status-title', bold: true, color: 'magenta' },
        '📊 Status Indicators:',
      ),
      React.createElement(Text, { key: 'approved' }, '  ✅ - Code Review +2 / Verified +1'),
      React.createElement(Text, { key: 'rejected' }, '  ❌ - Code Review -2 / Verified -1'),
      React.createElement(Text, { key: 'recommended' }, '  👍 - Code Review +1'),
      React.createElement(Text, { key: 'disliked' }, '  👎 - Code Review -1'),
      React.createElement(Text, { key: 'spacer4' }, ''),

      React.createElement(
        Text,
        { key: 'gerrit-note', dimColor: true, italic: true },
        'These shortcuts match Gerrit web UI for familiar navigation',
      ),
      React.createElement(Text, { key: 'spacer5' }, ''),
      React.createElement(
        Text,
        { key: 'back-help', dimColor: true, bold: true },
        'Press ? again to close help, or q to quit',
      ),
    ],
  )
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

    React.createElement(
      Box,
      {
        key: 'footer',
        marginTop: 2,
        borderStyle: 'single',
        borderColor: 'gray',
        padding: 1,
        flexDirection: 'column',
      },
      [
        React.createElement(
          Text,
          { key: 'shortcuts-title', bold: true, color: 'yellow' },
          'Gerrit-style shortcuts:',
        ),
        React.createElement(
          Text,
          { key: 'nav-help', dimColor: true },
          'c: View details • o: Open in browser • u/Esc: Back to list • q: Quit',
        ),
      ],
    ),
  ])
}
