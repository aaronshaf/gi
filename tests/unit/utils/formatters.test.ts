import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { formatDate, getStatusIndicator, colors } from '@/utils/formatters'
import { generateMockChange } from '@/test-utils/mock-generator'

describe('Formatters', () => {
  describe('formatDate', () => {
    let originalDate: typeof Date

    beforeEach(() => {
      originalDate = Date
    })

    afterEach(() => {
      global.Date = originalDate
    })

    test("should format today's date with time", () => {
      // Mock Date to always return a fixed current date when called without args
      const mockCurrentTime = new originalDate('2023-12-01T15:00:00.000Z')

      // Create a mock Date constructor
      const MockDate = function (this: any, dateString?: any) {
        if (arguments.length === 0) {
          // When called with new Date() - return current time
          return mockCurrentTime
        }
        // When called with new Date(dateString) - return parsed date
        return new originalDate(dateString)
      } as any

      // Copy static methods
      MockDate.now = () => mockCurrentTime.getTime()
      MockDate.parse = originalDate.parse
      MockDate.UTC = originalDate.UTC
      MockDate.prototype = originalDate.prototype

      global.Date = MockDate

      const todayDate = '2023-12-01T12:30:00.000Z'
      const result = formatDate(todayDate)

      // Should show time only for today
      expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i)
    })

    test("should format this year's date without year", () => {
      // Mock Date to always return a fixed current date when called without args
      const mockCurrentTime = new originalDate('2023-12-01T15:00:00.000Z')

      const MockDate = function (this: any, dateString?: any) {
        if (arguments.length === 0) {
          return mockCurrentTime
        }
        return new originalDate(dateString)
      } as any

      MockDate.now = () => mockCurrentTime.getTime()
      MockDate.parse = originalDate.parse
      MockDate.UTC = originalDate.UTC
      MockDate.prototype = originalDate.prototype

      global.Date = MockDate

      const thisYearDate = '2023-06-15T10:30:00.000Z'
      const result = formatDate(thisYearDate)

      // Should show month and day for this year
      expect(result).toMatch(/^[A-Za-z]{3}\s\d{2}$/)
      expect(result).not.toContain('2023')
    })

    test("should format previous year's date with year", () => {
      // Mock current time to be 2023-12-01
      const mockNow = new Date('2023-12-01T15:00:00.000Z').getTime()
      Date.now = () => mockNow

      const previousYearDate = '2022-06-15T10:30:00.000Z'
      const result = formatDate(previousYearDate)

      // Should show month, day, and year for previous years
      expect(result).toMatch(/^[A-Za-z]{3}\s\d{2},\s\d{4}$/)
      expect(result).toContain('2022')
    })

    test('should handle future dates', () => {
      // Mock current time to be 2023-12-01
      const mockNow = new Date('2023-12-01T15:00:00.000Z').getTime()
      Date.now = () => mockNow

      const futureDate = '2024-03-15T10:30:00.000Z'
      const result = formatDate(futureDate)

      // Should show month, day, and year for future dates
      expect(result).toMatch(/^[A-Za-z]{3}\s\d{2},\s\d{4}$/)
      expect(result).toContain('2024')
    })

    test('should handle edge case of exact midnight', () => {
      // Mock Date to always return a fixed current date when called without args
      const mockCurrentTime = new originalDate('2023-12-01T00:00:00.000Z')

      const MockDate = function (this: any, dateString?: any) {
        if (arguments.length === 0) {
          return mockCurrentTime
        }
        return new originalDate(dateString)
      } as any

      MockDate.now = () => mockCurrentTime.getTime()
      MockDate.parse = originalDate.parse
      MockDate.UTC = originalDate.UTC
      MockDate.prototype = originalDate.prototype

      global.Date = MockDate

      const sameDate = '2023-12-01T00:00:00.000Z'
      const result = formatDate(sameDate)

      // Should still be treated as today
      expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i)
    })

    test('should handle different timezones correctly', () => {
      // Mock Date to always return a fixed current date when called without args
      const mockCurrentTime = new originalDate('2023-12-01T12:00:00.000Z')

      const MockDate = function (this: any, dateString?: any) {
        if (arguments.length === 0) {
          return mockCurrentTime
        }
        return new originalDate(dateString)
      } as any

      MockDate.now = () => mockCurrentTime.getTime()
      MockDate.parse = originalDate.parse
      MockDate.UTC = originalDate.UTC
      MockDate.prototype = originalDate.prototype

      global.Date = MockDate

      // Test with various timezone formats
      const utcDate = '2023-12-01T08:30:00.000Z'
      const result = formatDate(utcDate)

      // Should be treated as today regardless of timezone
      expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i)
    })
  })

  describe('getStatusIndicator', () => {
    test('should return empty string for change without labels', () => {
      const change = generateMockChange({ labels: undefined })
      const result = getStatusIndicator(change)
      expect(result).toBe('')
    })

    test('should return empty string for change with empty labels', () => {
      const change = generateMockChange({ labels: {} })
      const result = getStatusIndicator(change)
      expect(result).toBe('')
    })

    test('should show approved Code-Review indicator', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': {
            approved: { _account_id: 123, name: 'Reviewer', email: 'reviewer@example.com' },
          },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✅')
    })

    test('should show approved Code-Review with value +2', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: 2 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✅')
    })

    test('should show rejected Code-Review indicator', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': {
            rejected: { _account_id: 123, name: 'Reviewer', email: 'reviewer@example.com' },
          },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('❌')
    })

    test('should show rejected Code-Review with value -2', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: -2 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('❌')
    })

    test('should show recommended Code-Review indicator', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': {
            recommended: { _account_id: 123, name: 'Reviewer', email: 'reviewer@example.com' },
          },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('👍')
    })

    test('should show recommended Code-Review with value +1', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: 1 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('👍')
    })

    test('should show disliked Code-Review indicator', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': {
            disliked: { _account_id: 123, name: 'Reviewer', email: 'reviewer@example.com' },
          },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('👎')
    })

    test('should show disliked Code-Review with value -1', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: -1 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('👎')
    })

    test('should show approved Verified indicator', () => {
      const change = generateMockChange({
        labels: {
          Verified: { approved: { _account_id: 123, name: 'Bot', email: 'bot@example.com' } },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✓')
    })

    test('should show approved Verified with value +1', () => {
      const change = generateMockChange({
        labels: {
          Verified: { value: 1 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✓')
    })

    test('should show rejected Verified indicator', () => {
      const change = generateMockChange({
        labels: {
          Verified: { rejected: { _account_id: 123, name: 'Bot', email: 'bot@example.com' } },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✗')
    })

    test('should show rejected Verified with value -1', () => {
      const change = generateMockChange({
        labels: {
          Verified: { value: -1 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✗')
    })

    test('should show submittable indicator', () => {
      const change = generateMockChange({ submittable: true })
      const result = getStatusIndicator(change)
      expect(result).toContain('🚀')
    })

    test('should show work in progress indicator', () => {
      const change = generateMockChange({ work_in_progress: true })
      const result = getStatusIndicator(change)
      expect(result).toContain('🚧')
    })

    test('should combine multiple indicators', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: 2 },
          Verified: { value: 1 },
        },
        submittable: true,
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✅')
      expect(result).toContain('✓')
      expect(result).toContain('🚀')
    })

    test('should handle mixed positive and negative reviews', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: 1 },
          Verified: { value: -1 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('👍')
      expect(result).toContain('✗')
    })

    test('should handle WIP with other indicators', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: 2 },
        },
        work_in_progress: true,
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✅')
      expect(result).toContain('🚧')
    })

    test('should handle zero values (no indicators)', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: 0 },
          Verified: { value: 0 },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toBe('')
    })

    test('should handle custom label names', () => {
      const change = generateMockChange({
        labels: {
          'Custom-Label': { value: 1 },
        },
      })
      const result = getStatusIndicator(change)
      // Should not show indicators for unknown labels
      expect(result).toBe('')
    })

    test('should prioritize boolean flags over numeric values', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': {
            approved: { _account_id: 123, name: 'Reviewer', email: 'reviewer@example.com' },
            value: 1, // Should use approved flag, not value
          },
        },
      })
      const result = getStatusIndicator(change)
      expect(result).toContain('✅')
    })
  })

  describe('colors', () => {
    test('should export color constants', () => {
      expect(colors.green).toBe('\x1b[32m')
      expect(colors.yellow).toBe('\x1b[33m')
      expect(colors.red).toBe('\x1b[31m')
      expect(colors.blue).toBe('\x1b[34m')
      expect(colors.cyan).toBe('\x1b[36m')
      expect(colors.reset).toBe('\x1b[0m')
      expect(colors.bold).toBe('\x1b[1m')
      expect(colors.dim).toBe('\x1b[2m')
    })

    test('should have correct ANSI escape sequences', () => {
      // Test that colors are proper ANSI escape sequences
      expect(colors.green.startsWith('\x1b[')).toBe(true)
      expect(colors.reset).toBe('\x1b[0m')
      expect(colors.bold).toBe('\x1b[1m')
    })

    test('colors should be used in status indicators', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { value: 2 },
          Verified: { value: -1 },
        },
      })
      const result = getStatusIndicator(change)

      // Should contain color codes
      expect(result).toContain(colors.green)
      expect(result).toContain(colors.red)
      expect(result).toContain(colors.reset)
    })
  })
})
