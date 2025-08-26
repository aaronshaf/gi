import type { ChangeInfo } from '@/schemas/gerrit'

/**
 * Status indicator configuration
 */
export interface StatusIndicatorConfig {
  approved: string
  rejected: string
  recommended: string
  disliked: string
  verified: string
  failed: string
  empty: string
}

/**
 * Default status indicators using emoji
 */
export const DEFAULT_STATUS_INDICATORS: StatusIndicatorConfig = {
  approved: '✓ ',
  rejected: '✗ ',
  recommended: '↑ ',
  disliked: '↓ ',
  verified: '✓ ',
  failed: '✗ ',
  empty: '  ',
}

/**
 * Gets status indicators for a change based on its labels
 */
export const getStatusIndicators = (
  change: ChangeInfo,
  config: StatusIndicatorConfig = DEFAULT_STATUS_INDICATORS,
): string[] => {
  const indicators: string[] = []

  // Check Code-Review label
  if (change.labels?.['Code-Review']) {
    const cr = change.labels['Code-Review']
    if (cr.approved || cr.value === 2) {
      indicators.push(config.approved)
    } else if (cr.rejected || cr.value === -2) {
      indicators.push(config.rejected)
    } else if (cr.recommended || cr.value === 1) {
      indicators.push(config.recommended)
    } else if (cr.disliked || cr.value === -1) {
      indicators.push(config.disliked)
    }
  }

  // Check Verified label
  if (change.labels?.['Verified']) {
    const v = change.labels.Verified
    if (v.approved || v.value === 1) {
      // Only add verified indicator if not already approved
      if (!indicators.includes(config.approved)) {
        indicators.push(config.verified)
      }
    } else if (v.rejected || v.value === -1) {
      indicators.push(config.failed)
    }
  }

  return indicators
}

/**
 * Gets a formatted status string with consistent padding
 */
export const getStatusString = (
  change: ChangeInfo,
  config: StatusIndicatorConfig = DEFAULT_STATUS_INDICATORS,
  padding = 8,
): string => {
  const indicators = getStatusIndicators(change, config)
  const statusStr = indicators.length > 0 ? indicators.join(' ') : config.empty
  return statusStr.padEnd(padding, ' ')
}

/**
 * Gets label value with proper type safety
 */
export const getLabelValue = (labelInfo: unknown): number => {
  return typeof labelInfo === 'object' &&
    labelInfo !== null &&
    'value' in labelInfo &&
    typeof labelInfo.value === 'number'
    ? labelInfo.value
    : 0
}

/**
 * Gets label color based on value
 */
export const getLabelColor = (value: number): 'green' | 'red' | 'yellow' => {
  if (value > 0) return 'green'
  if (value < 0) return 'red'
  return 'yellow'
}
