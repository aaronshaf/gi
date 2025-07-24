// Cache configuration and TTL settings

export const CACHE_TTL: {
  readonly CHANGE_NEW: number
  readonly CHANGE_MERGED: number
  readonly CHANGE_ABANDONED: number
  readonly CHANGE_DRAFT: number
  readonly FILES_LIST: number
  readonly FILE_DIFF: number
  readonly FILE_CONTENT: number
  readonly ACCOUNT_INFO: number
  readonly PROJECT_INFO: number
  readonly DEFAULT: number
} = {
  // Changes cache for different statuses
  CHANGE_NEW: 5 * 60, // 5 minutes for active changes
  CHANGE_MERGED: 24 * 60 * 60, // 24 hours for merged changes
  CHANGE_ABANDONED: 7 * 24 * 60 * 60, // 7 days for abandoned changes
  CHANGE_DRAFT: 2 * 60, // 2 minutes for drafts

  // Files and diffs cache less aggressively
  FILES_LIST: 10 * 60, // 10 minutes
  FILE_DIFF: 30 * 60, // 30 minutes
  FILE_CONTENT: 60 * 60, // 1 hour

  // API metadata
  ACCOUNT_INFO: 60 * 60, // 1 hour
  PROJECT_INFO: 24 * 60 * 60, // 24 hours

  // Default fallback
  DEFAULT: 15 * 60, // 15 minutes
} as const

export const getCacheTTL: (status?: string, changeType?: string) => number = (
  status?: string,
  changeType?: string,
): number => {
  if (changeType === 'files') return CACHE_TTL.FILES_LIST
  if (changeType === 'diff') return CACHE_TTL.FILE_DIFF
  if (changeType === 'content') return CACHE_TTL.FILE_CONTENT

  switch (status) {
    case 'NEW':
      return CACHE_TTL.CHANGE_NEW
    case 'MERGED':
      return CACHE_TTL.CHANGE_MERGED
    case 'ABANDONED':
      return CACHE_TTL.CHANGE_ABANDONED
    case 'DRAFT':
      return CACHE_TTL.CHANGE_DRAFT
    default:
      return CACHE_TTL.DEFAULT
  }
}

export const isExpired: (expiresAt: number | null) => boolean = (
  expiresAt: number | null,
): boolean => {
  if (!expiresAt) return false
  return Date.now() / 1000 > expiresAt
}

export const generateETag: (...values: (string | number)[]) => string = (
  ...values: (string | number)[]
): string => {
  const combined = values.join('|')
  return btoa(combined).slice(0, 16)
}
