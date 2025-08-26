import { describe, expect, test } from 'bun:test'
import {
  formatDiffPretty,
  formatFilesList,
  formatDiffSummary,
  extractDiffStats,
} from '@/utils/diff-formatters'

describe('Diff Formatters', () => {
  describe('formatDiffPretty', () => {
    test('should format a unified diff with colors and summary', () => {
      const diff = `diff --git a/src/main.ts b/src/main.ts
index 1234567..abcdef0 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,5 +1,6 @@
 function main() {
+  // Added comment
   console.log("Hello World")
   return 0
 }`

      const result = formatDiffPretty(diff)

      expect(result).toContain('Changes summary:')
      expect(result).toContain('1 file changed')
      expect(result).toContain('+1 addition')
      expect(result).toContain('diff --git')
      expect(result).toContain('function main()')
      expect(result).toContain('// Added comment')
    })

    test('should handle empty or invalid diff content', () => {
      const emptyResult = formatDiffPretty('')
      expect(emptyResult).toContain('No changes detected')
      expect(emptyResult).toContain('No diff content available')

      const nullResult = formatDiffPretty(null as any)
      expect(nullResult).toContain('No changes detected')
      expect(nullResult).toContain('No diff content available')
    })

    test('should handle multi-file diffs', () => {
      const diff = `diff --git a/file1.ts b/file1.ts
index abc123..def456 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3
diff --git a/file2.ts b/file2.ts
index 111222..333444 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,1 @@
-removed line
 remaining line`

      const result = formatDiffPretty(diff)

      expect(result).toContain('2 files changed')
      expect(result).toContain('+1 addition')
      expect(result).toContain('-1 deletion')
    })
  })

  describe('formatFilesList', () => {
    test('should format a list of files with header', () => {
      const files = ['src/main.ts', 'src/utils.ts', 'README.md']
      const result = formatFilesList(files)

      expect(result).toContain('Changed files (3):')
      expect(result).toContain('src/main.ts')
      expect(result).toContain('src/utils.ts')
      expect(result).toContain('README.md')
      expect(result).toContain('•')
    })

    test('should handle empty files list', () => {
      expect(formatFilesList([])).toBe('No files changed')
      expect(formatFilesList(null as any)).toBe('No files changed')
    })
  })

  describe('formatDiffSummary', () => {
    test('should format summary with files, additions, and deletions', () => {
      const stats = { files: 2, additions: 5, deletions: 3 }
      const result = formatDiffSummary(stats)

      expect(result).toContain('2 files changed')
      expect(result).toContain('+5 additions')
      expect(result).toContain('-3 deletions')
    })

    test('should handle singular vs plural correctly', () => {
      const singleStats = { files: 1, additions: 1, deletions: 1 }
      const result = formatDiffSummary(singleStats)

      expect(result).toContain('1 file changed')
      expect(result).toContain('+1 addition')
      expect(result).toContain('-1 deletion')
    })

    test('should handle zero changes', () => {
      const emptyStats = { files: 0, additions: 0, deletions: 0 }
      const result = formatDiffSummary(emptyStats)

      expect(result).toContain('No changes detected')
    })

    test('should handle only additions', () => {
      const addStats = { files: 1, additions: 3, deletions: 0 }
      const result = formatDiffSummary(addStats)

      expect(result).toContain('1 file changed')
      expect(result).toContain('+3 additions')
      expect(result).not.toContain('deletion')
    })
  })

  describe('extractDiffStats', () => {
    test('should extract correct statistics from diff', () => {
      const diff = `diff --git a/file1.ts b/file1.ts
index abc123..def456 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,4 @@
 line1
+new line
-old line
 line2`

      const stats = extractDiffStats(diff)

      expect(stats.files).toBe(1)
      expect(stats.additions).toBe(1)
      expect(stats.deletions).toBe(1)
    })

    test('should handle empty diff content', () => {
      expect(extractDiffStats('')).toEqual({ files: 0, additions: 0, deletions: 0 })
      expect(extractDiffStats(null as any)).toEqual({ files: 0, additions: 0, deletions: 0 })
    })

    test('should count multiple files correctly', () => {
      const diff = `diff --git a/file1.ts b/file1.ts
+added line 1
diff --git a/file2.ts b/file2.ts  
+added line 2
-removed line`

      const stats = extractDiffStats(diff)

      expect(stats.files).toBe(2)
      expect(stats.additions).toBe(2)
      expect(stats.deletions).toBe(1)
    })
  })
})
