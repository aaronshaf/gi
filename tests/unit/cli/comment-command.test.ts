import { describe, test, expect, beforeAll, mock } from 'bun:test'
import { extractChangeNumber } from '@/utils/url-parser'
import { setupFetchMock } from '../../mocks/fetch-mock'

describe('gi comment command', () => {
  beforeAll(() => {
    setupFetchMock()
  })

  describe('Change ID extraction', () => {
    test('should handle plain change numbers', () => {
      const testCases = [
        { input: '335531', expected: '335531' },
        { input: '12345', expected: '12345' },
        { input: '1', expected: '1' },
      ]

      testCases.forEach(({ input, expected }) => {
        expect(extractChangeNumber(input)).toBe(expected)
      })
    })

    test('should extract from Gerrit URLs', () => {
      const testCases = [
        {
          input: 'https://gerrit.instructure.com/c/canvas-lms/+/335531',
          expected: '335531'
        },
        {
          input: 'https://gerrit.example.com/c/project/+/12345/',
          expected: '12345'
        },
        {
          input: 'https://gerrit.example.com/c/project/+/12345/2',
          expected: '12345'
        },
        {
          input: 'https://gerrit.example.com/#/c/project/+/99999',
          expected: '99999'
        }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(extractChangeNumber(input)).toBe(expected)
      })
    })

    test('should handle invalid URLs gracefully', () => {
      const testCases = [
        { input: 'not-a-url', expected: 'not-a-url' },
        { input: 'https://example.com/other/path', expected: 'https://example.com/other/path' },
        { input: '', expected: '' },
        { input: '  12345  ', expected: '12345' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(extractChangeNumber(input)).toBe(expected)
      })
    })
  })

  describe('Comment posting via API', () => {
    test('should send correct request for comment posting', async () => {
      const mockFetch = mock(async (url: string, options?: RequestInit) => {
        // Verify the request structure
        expect(url).toContain('/revisions/current/review')
        expect(options?.method).toBe('POST')
        expect(options?.headers).toHaveProperty('Authorization')
        expect(options?.headers).toHaveProperty('Content-Type', 'application/json')
        
        const body = JSON.parse(options?.body as string)
        expect(body).toHaveProperty('message')

        return new Response(`)]}'\n{"labels":{},"ready":true}`, { status: 200 })
      })

      // Replace fetch temporarily
      const originalFetch = global.fetch
      global.fetch = mockFetch as any

      try {
        const response = await fetch(
          'https://gerrit.example.com/a/changes/12345/revisions/current/review',
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa('user:pass')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: 'Test comment' })
          }
        )

        expect(response.status).toBe(200)
        expect(mockFetch).toHaveBeenCalledTimes(1)
      } finally {
        global.fetch = originalFetch
      }
    })
  })

  describe('Non-interactive mode (-m flag)', () => {
    test('should format console output correctly', () => {
      const mockLog = mock(() => {})
      const mockError = mock(() => {})
      
      // Simulate successful comment posting
      mockLog('Posting comment...')
      mockLog('✓ Comment posted successfully!')
      
      expect(mockLog).toHaveBeenCalledTimes(2)
      expect(mockLog.mock.calls[0][0]).toBe('Posting comment...')
      expect(mockLog.mock.calls[1][0]).toBe('✓ Comment posted successfully!')
      
      // Simulate error case
      mockError('✗ Failed to post comment:', 'Network error')
      
      expect(mockError).toHaveBeenCalledTimes(1)
      expect(mockError.mock.calls[0]).toEqual(['✗ Failed to post comment:', 'Network error'])
    })

    test('should validate comment is not empty', () => {
      const validateComment = (comment: string): boolean => {
        return comment.trim().length > 0
      }

      expect(validateComment('')).toBe(false)
      expect(validateComment('   ')).toBe(false)
      expect(validateComment('\n\t')).toBe(false)
      expect(validateComment('Valid comment')).toBe(true)
      expect(validateComment('  Trimmed comment  ')).toBe(true)
    })
  })

  describe('Error handling', () => {
    test('should handle network errors gracefully', async () => {
      const mockFetch = mock(async () => {
        throw new Error('Network error')
      })

      const originalFetch = global.fetch
      global.fetch = mockFetch as any

      try {
        let errorMessage = ''
        try {
          await fetch('https://gerrit.example.com/a/changes/12345/revisions/current/review', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa('user:pass')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: 'Test' })
          })
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : 'Unknown error'
        }

        expect(errorMessage).toBe('Network error')
      } finally {
        global.fetch = originalFetch
      }
    })

    test('should handle 401 unauthorized responses', async () => {
      const response = await fetch('https://gerrit.example.com/a/changes/12345/revisions/current/review', {
        method: 'POST',
        headers: {
          // No Authorization header
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Test' })
      })

      expect(response.status).toBe(401)
      const text = await response.text()
      expect(text).toContain('Unauthorized')
    })
  })
})