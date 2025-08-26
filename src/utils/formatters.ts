import type { ChangeInfo } from '@/schemas/gerrit'

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()

  // Check if today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Check if this year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    })
  }

  // Otherwise show full date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

export const getStatusIndicator = (change: ChangeInfo): string => {
  const indicators: string[] = []

  // Check for labels only if they exist
  if (change.labels) {
    // Check for Code-Review
    if (change.labels['Code-Review']) {
      const cr = change.labels['Code-Review']
      if (cr.approved || cr.value === 2) {
        indicators.push(`${colors.green}✓${colors.reset}`)
      } else if (cr.rejected || cr.value === -2) {
        indicators.push(`${colors.red}✗${colors.reset}`)
      } else if (cr.recommended || cr.value === 1) {
        indicators.push(`${colors.cyan}↑${colors.reset}`)
      } else if (cr.disliked || cr.value === -1) {
        indicators.push(`${colors.yellow}↓${colors.reset}`)
      }
    }

    // Check for Verified
    if (change.labels.Verified) {
      const v = change.labels.Verified
      if (v.approved || v.value === 1) {
        indicators.push(`${colors.green}✓${colors.reset}`)
      } else if (v.rejected || v.value === -1) {
        indicators.push(`${colors.red}✗${colors.reset}`)
      }
    }
  }

  // Check if submittable (regardless of labels)
  if (change.submittable) {
    indicators.push('🚀')
  }

  // Check if WIP (regardless of labels)
  if (change.work_in_progress) {
    indicators.push('🚧')
  }

  return indicators.length > 0 ? indicators.join('  ') : '' // Double space for proper alignment
}

export const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}
