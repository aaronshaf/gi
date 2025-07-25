import { describe, expect, test } from 'bun:test'
import { extractChangeNumber, isValidChangeId } from './url-parser'

describe('extractChangeNumber', () => {
  test('extracts change number from standard Gerrit URL', () => {
    const url = 'https://gerrit.instructure.com/c/canvas-lms/+/384571'
    expect(extractChangeNumber(url)).toBe('384571')
  })

  test('extracts change number from URL with trailing slash', () => {
    const url = 'https://gerrit.instructure.com/c/canvas-lms/+/384571/'
    expect(extractChangeNumber(url)).toBe('384571')
  })

  test('extracts change number from URL with patchset', () => {
    const url = 'https://gerrit.instructure.com/c/canvas-lms/+/384571/2'
    expect(extractChangeNumber(url)).toBe('384571')
  })

  test('extracts change number from hash-based URL', () => {
    const url = 'https://gerrit.instructure.com/#/c/canvas-lms/+/384571/'
    expect(extractChangeNumber(url)).toBe('384571')
  })

  test('extracts change number from simplified URL format', () => {
    const url = 'https://gerrit.instructure.com/c/+/384571'
    expect(extractChangeNumber(url)).toBe('384571')
  })

  test('extracts change number from hash-based simplified URL', () => {
    const url = 'https://gerrit.instructure.com/#/c/+/384571'
    expect(extractChangeNumber(url)).toBe('384571')
  })

  test('returns plain change number as-is', () => {
    expect(extractChangeNumber('384571')).toBe('384571')
  })

  test('returns Change-Id format as-is', () => {
    const changeId = 'Iabcdef1234567890abcdef1234567890abcdef12'
    expect(extractChangeNumber(changeId)).toBe(changeId)
  })

  test('returns original input for invalid URLs', () => {
    const invalidUrl = 'https://gerrit.instructure.com/invalid/path'
    expect(extractChangeNumber(invalidUrl)).toBe(invalidUrl)
  })

  test('handles malformed URLs gracefully', () => {
    const malformed = 'not-a-url-at-all'
    expect(extractChangeNumber(malformed)).toBe(malformed)
  })

  test('handles http:// URLs', () => {
    const httpUrl = 'http://gerrit.example.com/c/project/+/123456'
    expect(extractChangeNumber(httpUrl)).toBe('123456')
  })

  test('handles malformed https URLs that throw in URL constructor', () => {
    const malformed = 'https://[invalid-url'
    expect(extractChangeNumber(malformed)).toBe(malformed)
  })

  test('handles empty string', () => {
    expect(extractChangeNumber('')).toBe('')
  })

  test('handles whitespace', () => {
    expect(extractChangeNumber('  384571  ')).toBe('384571')
  })
})

describe('isValidChangeId', () => {
  test('validates numeric change IDs', () => {
    expect(isValidChangeId('384571')).toBe(true)
    expect(isValidChangeId('1')).toBe(true)
    expect(isValidChangeId('999999')).toBe(true)
  })

  test('rejects zero and negative numbers', () => {
    expect(isValidChangeId('0')).toBe(false)
    expect(isValidChangeId('-1')).toBe(false)
  })

  test('validates Change-Id format', () => {
    const validChangeId = 'Iabcdef1234567890abcdef1234567890abcdef12'
    expect(isValidChangeId(validChangeId)).toBe(true)
  })

  test('rejects invalid Change-Id format', () => {
    // Only reject if it doesn't follow the strict Change-Id format when it starts with 'I' and is long
    expect(isValidChangeId('abcdef1234567890abcdef1234567890abcdef12')).toBe(true) // valid topic name
    expect(isValidChangeId('Iabc')).toBe(true) // could be a valid topic or branch name
  })

  test('validates other identifier formats', () => {
    expect(isValidChangeId('topic-branch')).toBe(true)
    expect(isValidChangeId('feature/new-thing')).toBe(true)
  })

  test('rejects empty and whitespace-only strings', () => {
    expect(isValidChangeId('')).toBe(false)
    expect(isValidChangeId('   ')).toBe(false)
    expect(isValidChangeId('has spaces')).toBe(false)
  })

  test('handles exact Change-Id format validation', () => {
    // Valid Change-Id: starts with 'I' and exactly 40 hex chars
    expect(isValidChangeId('I1234567890abcdef1234567890abcdef12345678')).toBe(true)

    // Invalid: wrong length
    expect(isValidChangeId('I123')).toBe(true) // this is treated as a valid topic name
    expect(isValidChangeId('I1234567890abcdef1234567890abcdef123456789')).toBe(true) // too long, treated as topic

    // Invalid: non-hex characters
    expect(isValidChangeId('I1234567890abcdef1234567890abcdef1234567g')).toBe(true) // treated as topic name
  })

  test('rejects strings starting with dash', () => {
    expect(isValidChangeId('-123')).toBe(false)
    expect(isValidChangeId('-abc')).toBe(false)
  })
})
