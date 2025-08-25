import { Effect } from 'effect'
import { ApiError, GerritApiService } from '@/api/gerrit'
import type { FileDiffContent } from '@/schemas/gerrit'

export interface DiffContext {
  before: string[]
  line?: string
  after: string[]
}

/**
 * Extracts context around a specific line number from a diff.
 * This is a more accurate implementation that properly tracks line numbers
 * across different diff sections.
 */
export const extractDiffContext = (
  diff: FileDiffContent,
  targetLine: number,
  contextLines: number = 2
): DiffContext => {
  const context: DiffContext = {
    before: [],
    after: []
  }
  
  let currentNewLine = 1
  let foundTarget = false
  const collectedLines: Array<{ line: string; lineNum: number; type: 'context' | 'added' }> = []
  
  for (const section of diff.content) {
    // Context lines (present in both old and new)
    if (section.ab) {
      for (const line of section.ab) {
        collectedLines.push({ line, lineNum: currentNewLine, type: 'context' })
        currentNewLine++
      }
    }
    
    // Added lines (only in new file)
    if (section.b) {
      for (const line of section.b) {
        collectedLines.push({ line, lineNum: currentNewLine, type: 'added' })
        currentNewLine++
      }
    }
    
    // Skip lines (large unchanged sections)
    if (section.skip) {
      // If target is in skipped section, we can't show context
      if (currentNewLine <= targetLine && targetLine < currentNewLine + section.skip) {
        return context // Return empty context
      }
      currentNewLine += section.skip
    }
    
    // Removed lines don't affect new file line numbers
    // section.a is ignored for line counting
  }
  
  // Find the target line and extract context
  const targetIndex = collectedLines.findIndex(item => item.lineNum === targetLine)
  if (targetIndex !== -1) {
    // Get before context
    for (let i = Math.max(0, targetIndex - contextLines); i < targetIndex; i++) {
      context.before.push(collectedLines[i].line)
    }
    
    // Get target line
    context.line = collectedLines[targetIndex].line
    
    // Get after context
    for (let i = targetIndex + 1; i < Math.min(collectedLines.length, targetIndex + contextLines + 1); i++) {
      context.after.push(collectedLines[i].line)
    }
  }
  
  return context
}

export const getDiffContext = (
  changeId: string,
  path: string,
  line?: number
): Effect.Effect<DiffContext, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    if (!line || path === 'Commit Message' || path === '/COMMIT_MSG') {
      return { before: [], after: [] }
    }
    
    const gerritApi = yield* GerritApiService
    
    try {
      const diff = yield* gerritApi.getFileDiff(changeId, path)
      return extractDiffContext(diff, line)
    } catch {
      // Return empty context on error
      return { before: [], after: [] }
    }
  })