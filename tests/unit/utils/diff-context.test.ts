import { describe, expect, it } from 'bun:test'
import { extractDiffContext } from '@/utils/diff-context'
import type { FileDiffContent } from '@/schemas/gerrit'

describe('extractDiffContext', () => {
  it('should extract context around a simple line', () => {
    const diff: FileDiffContent = {
      content: [
        {
          ab: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5']
        }
      ]
    }
    
    const context = extractDiffContext(diff, 3, 2)
    
    expect(context.before).toEqual(['line 1', 'line 2'])
    expect(context.line).toBe('line 3')
    expect(context.after).toEqual(['line 4', 'line 5'])
  })
  
  it('should handle added lines correctly', () => {
    const diff: FileDiffContent = {
      content: [
        {
          ab: ['line 1', 'line 2']
        },
        {
          b: ['added 1', 'added 2', 'added 3']
        },
        {
          ab: ['line 3', 'line 4']
        }
      ]
    }
    
    // Target line 4 (added 2)
    const context = extractDiffContext(diff, 4, 1)
    
    expect(context.before).toEqual(['added 1'])
    expect(context.line).toBe('added 2')
    expect(context.after).toEqual(['added 3'])
  })
  
  it('should handle removed lines correctly (they dont affect new line numbers)', () => {
    const diff: FileDiffContent = {
      content: [
        {
          ab: ['line 1', 'line 2']
        },
        {
          a: ['removed 1', 'removed 2'] // These don't count in new file
        },
        {
          ab: ['line 3', 'line 4']
        }
      ]
    }
    
    // Line 3 in new file is 'line 3' (removed lines don't count)
    const context = extractDiffContext(diff, 3, 1)
    
    expect(context.before).toEqual(['line 2'])
    expect(context.line).toBe('line 3')
    expect(context.after).toEqual(['line 4'])
  })
  
  it('should handle skip sections correctly', () => {
    const diff: FileDiffContent = {
      content: [
        {
          ab: ['line 1', 'line 2']
        },
        {
          skip: 100 // Lines 3-102 are skipped
        },
        {
          ab: ['line 103', 'line 104']
        }
      ]
    }
    
    // Line in skipped section - should return empty context
    const context1 = extractDiffContext(diff, 50, 2)
    expect(context1.before).toEqual([])
    expect(context1.line).toBeUndefined()
    expect(context1.after).toEqual([])
    
    // Line after skip
    const context2 = extractDiffContext(diff, 103, 1)
    expect(context2.line).toBe('line 103')
    expect(context2.after).toEqual(['line 104'])
  })
  
  it('should handle edge cases at file boundaries', () => {
    const diff: FileDiffContent = {
      content: [
        {
          ab: ['line 1', 'line 2', 'line 3']
        }
      ]
    }
    
    // First line
    const context1 = extractDiffContext(diff, 1, 2)
    expect(context1.before).toEqual([])
    expect(context1.line).toBe('line 1')
    expect(context1.after).toEqual(['line 2', 'line 3'])
    
    // Last line
    const context2 = extractDiffContext(diff, 3, 2)
    expect(context2.before).toEqual(['line 1', 'line 2'])
    expect(context2.line).toBe('line 3')
    expect(context2.after).toEqual([])
  })
  
  it('should return empty context for non-existent lines', () => {
    const diff: FileDiffContent = {
      content: [
        {
          ab: ['line 1', 'line 2']
        }
      ]
    }
    
    const context = extractDiffContext(diff, 999, 2)
    expect(context.before).toEqual([])
    expect(context.line).toBeUndefined()
    expect(context.after).toEqual([])
  })
  
  it('should handle complex mixed diff sections', () => {
    const diff: FileDiffContent = {
      content: [
        {
          ab: ['unchanged 1']  // Line 1
        },
        {
          a: ['old only']      // Not in new file
        },
        {
          b: ['new only']      // Line 2
        },
        {
          ab: ['unchanged 2']  // Line 3
        },
        {
          skip: 10            // Lines 4-13 skipped
        },
        {
          ab: ['unchanged 3']  // Line 14
        },
        {
          b: ['added at end']  // Line 15
        }
      ]
    }
    
    // Test line 2 (new only)
    const context1 = extractDiffContext(diff, 2, 1)
    expect(context1.before).toEqual(['unchanged 1'])
    expect(context1.line).toBe('new only')
    expect(context1.after).toEqual(['unchanged 2'])
    
    // Test line 15 (added at end)
    const context2 = extractDiffContext(diff, 15, 1)
    expect(context2.before).toEqual(['unchanged 3'])
    expect(context2.line).toBe('added at end')
    expect(context2.after).toEqual([])
  })
})