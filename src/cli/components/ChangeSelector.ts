import { Box, Text, useApp, useInput } from 'ink'
import React, { useState } from 'react'
import type { ChangeInfo } from '@/schemas/gerrit'
import { formatDate, getStatusIndicator } from '@/utils/formatters'

interface ChangeSelectorProps {
  changes: readonly ChangeInfo[]
  onSelect: (selectedChanges: ChangeInfo[]) => void
  onCancel?: () => void
}

export const ChangeSelector = ({
  changes,
  onSelect,
  onCancel,
}: ChangeSelectorProps): React.ReactElement => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [cursorIndex, setCursorIndex] = useState(0)
  const { exit } = useApp()

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      if (onCancel) {
        onCancel()
      }
      exit()
      return
    }

    if (key.return) {
      const selectedChanges = Array.from(selectedIndices).map((i) => changes[i])
      onSelect(selectedChanges)
      return
    }

    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1))
      return
    }

    if (key.downArrow) {
      setCursorIndex((prev) => Math.min(changes.length - 1, prev + 1))
      return
    }

    if (input === ' ') {
      setSelectedIndices((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(cursorIndex)) {
          newSet.delete(cursorIndex)
        } else {
          newSet.add(cursorIndex)
        }
        return newSet
      })
      return
    }

    if (input === 'a') {
      if (selectedIndices.size === changes.length) {
        setSelectedIndices(new Set())
      } else {
        setSelectedIndices(new Set(changes.map((_, i) => i)))
      }
      return
    }
  })

  if (changes.length === 0) {
    return React.createElement(Box, { flexDirection: 'column' }, [
      React.createElement(Text, { key: 'no-changes' }, 'No open changes found'),
      React.createElement(Text, { key: 'exit-hint', dimColor: true }, 'Press q to exit'),
    ])
  }

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
        const isSelected = selectedIndices.has(index)
        const isCursor = cursorIndex === index
        const status = getStatusIndicator(change)
        const statusPrefix = status ? `${status} ` : ''
        const dateStr = change.updated ? ` (${formatDate(change.updated)})` : ''

        return React.createElement(
          Box,
          { key: `${project}-${change._number}`, paddingLeft: 2 },
          React.createElement(
            Text,
            { color: isCursor ? 'cyan' : undefined },
            `${isCursor ? '▶ ' : '  '}[${isSelected ? '✓' : ' '}] ${statusPrefix}${change._number}: ${change.subject}${dateStr}`,
          ),
        )
      }),
    ]),
  )

  return React.createElement(Box, { flexDirection: 'column' }, [
    React.createElement(
      Box,
      { key: 'header', marginBottom: 1 },
      React.createElement(Text, { bold: true }, 'Select changes to abandon:'),
    ),
    ...projectElements,
    React.createElement(Box, { key: 'footer', marginTop: 1, flexDirection: 'column' }, [
      React.createElement(
        Text,
        { key: 'nav-help', dimColor: true },
        '↑/↓: Navigate | Space: Toggle selection | a: Select/deselect all',
      ),
      React.createElement(
        Text,
        { key: 'action-help', dimColor: true },
        'Enter: Abandon selected | q/Ctrl+C: Cancel',
      ),
      React.createElement(
        Text,
        { key: 'selection-count', dimColor: true },
        `${selectedIndices.size} of ${changes.length} selected`,
      ),
    ]),
  ])
}
