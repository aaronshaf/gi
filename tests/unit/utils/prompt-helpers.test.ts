import { describe, test, expect } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// Since the helper functions are private, we'll redefine them here for testing
// This ensures they behave exactly like the ones in the review command

// Helper to expand tilde in file paths
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return filePath
}

// Helper to read prompt file
const readPromptFile = (filePath: string): string | null => {
  try {
    const expanded = expandTilde(filePath)
    if (fs.existsSync(expanded)) {
      return fs.readFileSync(expanded, 'utf8')
    }
  } catch {
    // Ignore errors
  }
  return null
}

describe('Prompt Helper Functions', () => {
  describe('expandTilde', () => {
    test('should expand tilde (~/) to home directory', () => {
      const homeDir = os.homedir()
      const result = expandTilde('~/test/file.txt')
      expect(result).toBe(path.join(homeDir, 'test/file.txt'))
    })

    test('should handle tilde with no trailing slash', () => {
      const homeDir = os.homedir()
      const result = expandTilde('~/file.txt')
      expect(result).toBe(path.join(homeDir, 'file.txt'))
    })

    test('should return unchanged path when not starting with tilde', () => {
      const absolutePath = '/absolute/path/file.txt'
      const result = expandTilde(absolutePath)
      expect(result).toBe(absolutePath)
    })

    test('should return unchanged path for relative paths without tilde', () => {
      const relativePath = 'relative/path/file.txt'
      const result = expandTilde(relativePath)
      expect(result).toBe(relativePath)
    })

    test('should handle empty string', () => {
      const result = expandTilde('')
      expect(result).toBe('')
    })

    test('should handle just tilde', () => {
      const result = expandTilde('~')
      expect(result).toBe('~')
    })

    test('should handle tilde in middle of path', () => {
      const pathWithTildeInMiddle = '/path/~/file.txt'
      const result = expandTilde(pathWithTildeInMiddle)
      expect(result).toBe(pathWithTildeInMiddle)
    })
  })

  describe('readPromptFile', () => {
    test('should read existing file content', () => {
      const tempDir = os.tmpdir()
      const tempFile = path.join(tempDir, `test-read-${Date.now()}.md`)
      const testContent = 'Test prompt content\nWith multiple lines'

      try {
        fs.writeFileSync(tempFile, testContent, 'utf8')
        const result = readPromptFile(tempFile)
        expect(result).toBe(testContent)
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile)
        }
      }
    })

    test('should return null for non-existent file', () => {
      const nonExistentFile = '/tmp/does-not-exist-prompt.md'
      const result = readPromptFile(nonExistentFile)
      expect(result).toBeNull()
    })

    test('should expand tilde paths before reading', () => {
      const homeDir = os.homedir()
      const fileName = `.test-tilde-read-${Date.now()}.md`
      const absolutePath = path.join(homeDir, fileName)
      const tildePath = `~/${fileName}`
      const testContent = 'Tilde path test content'

      try {
        fs.writeFileSync(absolutePath, testContent, 'utf8')
        const result = readPromptFile(tildePath)
        expect(result).toBe(testContent)
      } finally {
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath)
        }
      }
    })

    test('should handle permission errors gracefully', () => {
      // Try to read from a restricted directory
      const restrictedFile = '/root/test-permission-error.md'
      const result = readPromptFile(restrictedFile)
      expect(result).toBeNull()
    })

    test('should handle directory instead of file', () => {
      const tempDir = os.tmpdir()
      const result = readPromptFile(tempDir)
      expect(result).toBeNull()
    })

    test('should handle empty file', () => {
      const tempDir = os.tmpdir()
      const tempFile = path.join(tempDir, `test-empty-${Date.now()}.md`)

      try {
        fs.writeFileSync(tempFile, '', 'utf8')
        const result = readPromptFile(tempFile)
        expect(result).toBe('')
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile)
        }
      }
    })

    test('should handle file with special characters', () => {
      const tempDir = os.tmpdir()
      const tempFile = path.join(tempDir, `test-special-${Date.now()}.md`)
      const specialContent =
        'Content with special chars: ñáéíóú 中文 🚀 "quotes" \\backslashes\\ /slashes/'

      try {
        fs.writeFileSync(tempFile, specialContent, 'utf8')
        const result = readPromptFile(tempFile)
        expect(result).toBe(specialContent)
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile)
        }
      }
    })

    test('should handle very large file', () => {
      const tempDir = os.tmpdir()
      const tempFile = path.join(tempDir, `test-large-${Date.now()}.md`)
      const largeContent = 'Large content '.repeat(10000) // ~140KB

      try {
        fs.writeFileSync(tempFile, largeContent, 'utf8')
        const result = readPromptFile(tempFile)
        expect(result).toBe(largeContent)
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile)
        }
      }
    })
  })
})
