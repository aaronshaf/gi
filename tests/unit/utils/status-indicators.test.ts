import { test, expect, describe } from 'bun:test'
import {
  getStatusIndicators,
  getStatusString,
  getLabelValue,
  getLabelColor,
  DEFAULT_STATUS_INDICATORS,
} from '@/utils/status-indicators'
import { generateMockChange } from '@/test-utils/mock-generator'

describe('Status Indicators Utility', () => {
  describe('getStatusIndicators', () => {
    test('should return approved indicators for approved changes', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { approved: { _account_id: 1 }, value: 2 },
          Verified: { approved: { _account_id: 1 }, value: 1 },
        },
      })

      const indicators = getStatusIndicators(change)
      expect(indicators).toEqual(['✅'])
    })

    test('should return rejected indicators for rejected changes', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { rejected: { _account_id: 1 }, value: -2 },
          Verified: { rejected: { _account_id: 1 }, value: -1 },
        },
      })

      const indicators = getStatusIndicators(change)
      expect(indicators).toEqual(['❌', '❌'])
    })

    test('should return recommended and disliked indicators', () => {
      const change1 = generateMockChange({
        labels: {
          'Code-Review': { recommended: { _account_id: 1 }, value: 1 },
        },
      })

      const change2 = generateMockChange({
        labels: {
          'Code-Review': { disliked: { _account_id: 1 }, value: -1 },
        },
      })

      expect(getStatusIndicators(change1)).toEqual(['👍'])
      expect(getStatusIndicators(change2)).toEqual(['👎'])
    })

    test('should handle empty labels', () => {
      const change = generateMockChange({ labels: {} })
      expect(getStatusIndicators(change)).toEqual([])
    })

    test('should handle undefined labels', () => {
      const change = generateMockChange({ labels: undefined })
      expect(getStatusIndicators(change)).toEqual([])
    })

    test('should use custom indicator config', () => {
      const customConfig = {
        ...DEFAULT_STATUS_INDICATORS,
        approved: '🟢',
        rejected: '🔴',
      }

      const change = generateMockChange({
        labels: {
          'Code-Review': { approved: { _account_id: 1 }, value: 2 },
        },
      })

      const indicators = getStatusIndicators(change, customConfig)
      expect(indicators).toEqual(['🟢'])
    })
  })

  describe('getStatusString', () => {
    test('should return padded status string', () => {
      const change = generateMockChange({
        labels: {
          'Code-Review': { recommended: { _account_id: 1 }, value: 1 },
        },
      })

      const statusString = getStatusString(change, undefined, 10)
      expect(statusString).toBe('👍        ')
      expect(statusString.length).toBe(10)
    })

    test('should return empty padded string for no indicators', () => {
      const change = generateMockChange({ labels: {} })
      const statusString = getStatusString(change, undefined, 8)
      expect(statusString).toBe('        ')
      expect(statusString.length).toBe(8)
    })
  })

  describe('getLabelValue', () => {
    test('should extract numeric values correctly', () => {
      expect(getLabelValue({ value: 2 })).toBe(2)
      expect(getLabelValue({ value: -1 })).toBe(-1)
      expect(getLabelValue({ value: 0 })).toBe(0)
    })

    test('should return 0 for invalid inputs', () => {
      expect(getLabelValue({})).toBe(0)
      expect(getLabelValue({ notValue: 2 })).toBe(0)
      expect(getLabelValue({ value: 'string' })).toBe(0)
      expect(getLabelValue(null)).toBe(0)
      expect(getLabelValue(undefined)).toBe(0)
      expect(getLabelValue('string')).toBe(0)
      expect(getLabelValue(123)).toBe(0)
    })
  })

  describe('getLabelColor', () => {
    test('should return correct colors for label values', () => {
      expect(getLabelColor(2)).toBe('green')
      expect(getLabelColor(1)).toBe('green')
      expect(getLabelColor(0)).toBe('yellow')
      expect(getLabelColor(-1)).toBe('red')
      expect(getLabelColor(-2)).toBe('red')
    })

    test('should handle edge cases', () => {
      expect(getLabelColor(0.1)).toBe('green')
      expect(getLabelColor(-0.1)).toBe('red')
      expect(getLabelColor(100)).toBe('green')
      expect(getLabelColor(-100)).toBe('red')
    })
  })
})
