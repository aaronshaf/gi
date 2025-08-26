import { describe, expect, test } from 'bun:test'
import { incomingCommand } from '@/cli/commands/incoming'
import { generateMockChange } from '@/test-utils/mock-generator'
import {
  getStatusIndicators,
  getStatusString,
  getLabelValue,
  getLabelColor,
} from '@/utils/status-indicators'
import { sanitizeUrlSync, getOpenCommand } from '@/utils/shell-safety'

describe('Interactive Incoming Command', () => {
  test('should create command with interactive option', () => {
    const command = incomingCommand({ interactive: true })
    expect(command).toBeDefined()
  })

  test('should create command with interactive and xml options', () => {
    const command = incomingCommand({ interactive: true, xml: true })
    expect(command).toBeDefined()
  })

  test('should create command without interactive option', () => {
    const command = incomingCommand({})
    expect(command).toBeDefined()
  })

  describe('Status Indicators Utility', () => {
    test('should generate status indicators for approved change', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { approved: { _account_id: 1 }, value: 2 },
          Verified: { approved: { _account_id: 1 }, value: 1 },
        },
      })

      const indicators = getStatusIndicators(change)
      expect(indicators).toContain('✓')
      expect(indicators.length).toBeGreaterThan(0)
    })

    test('should generate status indicators for rejected change', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { rejected: { _account_id: 1 }, value: -2 },
        },
      })

      const indicators = getStatusIndicators(change)
      expect(indicators).toContain('✗')
    })

    test('should generate padded status string', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { recommended: { _account_id: 1 }, value: 1 },
        },
      })

      const statusString = getStatusString(change, undefined, 8)
      expect(statusString).toContain('↑')
      expect(statusString.length).toBe(8)
    })

    test('should handle empty labels gracefully', () => {
      const change = generateMockChange({ labels: {} })
      const indicators = getStatusIndicators(change)
      expect(indicators).toHaveLength(0)
    })

    test('should extract label value safely', () => {
      expect(getLabelValue({ value: 2 })).toBe(2)
      expect(getLabelValue({ value: -1 })).toBe(-1)
      expect(getLabelValue({})).toBe(0)
      expect(getLabelValue(null)).toBe(0)
      expect(getLabelValue('invalid')).toBe(0)
    })

    test('should determine label color correctly', () => {
      expect(getLabelColor(2)).toBe('green')
      expect(getLabelColor(1)).toBe('green')
      expect(getLabelColor(0)).toBe('yellow')
      expect(getLabelColor(-1)).toBe('red')
      expect(getLabelColor(-2)).toBe('red')
    })
  })

  describe('URL Sanitization', () => {
    test('should sanitize valid HTTPS URLs', () => {
      const url = 'https://gerrit.example.com/c/project/+/12345'
      expect(() => sanitizeUrlSync(url)).not.toThrow()
      expect(sanitizeUrlSync(url)).toBe(url)
    })

    test('should reject HTTP URLs', () => {
      const url = 'http://gerrit.example.com/c/project/+/12345'
      expect(() => sanitizeUrlSync(url)).toThrow('Invalid protocol')
    })

    test('should reject URLs with dangerous characters', () => {
      const url = 'https://gerrit.example.com/c/project/+/12345;rm -rf /'
      expect(() => sanitizeUrlSync(url)).toThrow('dangerous characters')
    })

    test('should reject malformed URLs', () => {
      const url = 'not-a-url'
      expect(() => sanitizeUrlSync(url)).toThrow('Invalid URL format')
    })

    test('should get correct open command for platform', () => {
      const originalPlatform = process.platform

      Object.defineProperty(process, 'platform', { value: 'darwin' })
      expect(getOpenCommand()).toBe('open')

      Object.defineProperty(process, 'platform', { value: 'win32' })
      expect(getOpenCommand()).toBe('start')

      Object.defineProperty(process, 'platform', { value: 'linux' })
      expect(getOpenCommand()).toBe('xdg-open')

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })
  })

  describe('Change Data Processing', () => {
    test('should handle changes with various label configurations', () => {
      const changes = [
        generateMockChange({
          _number: 1,
          labels: { 'Code-Review': { value: 2, approved: { _account_id: 1 } } },
        }),
        generateMockChange({
          _number: 2,
          labels: { 'Code-Review': { value: -1, disliked: { _account_id: 1 } } },
        }),
        generateMockChange({
          _number: 3,
          labels: {},
        }),
      ]

      changes.forEach((change) => {
        expect(() => getStatusIndicators(change)).not.toThrow()
        expect(() => getStatusString(change)).not.toThrow()
      })
    })

    test('should group changes by project correctly', () => {
      const changes = [
        generateMockChange({ project: 'project-a', _number: 1 }),
        generateMockChange({ project: 'project-b', _number: 2 }),
        generateMockChange({ project: 'project-a', _number: 3 }),
      ]

      const grouped = changes.reduce(
        (acc, change) => {
          if (!acc[change.project]) {
            acc[change.project] = []
          }
          acc[change.project].push(change)
          return acc
        },
        {} as Record<string, typeof changes>,
      )

      expect(Object.keys(grouped)).toHaveLength(2)
      expect(grouped['project-a']).toHaveLength(2)
      expect(grouped['project-b']).toHaveLength(1)
    })
  })
})
