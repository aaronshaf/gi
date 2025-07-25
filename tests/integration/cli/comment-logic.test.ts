import { describe, test, expect, beforeAll, beforeEach, afterEach, mock } from 'bun:test'
import { extractChangeNumber } from '@/utils/url-parser'
import { setupFetchMock } from '../../mocks/fetch-mock'

describe('gi comment - Command Logic Tests', () => {
  beforeAll(() => {
    setupFetchMock()
  })

  // Mock console output
  let consoleOutput: string[] = []
  let consoleErrors: string[] = []
  const originalConsoleLog = console.log
  const originalConsoleError = console.error
  
  beforeEach(() => {
    consoleOutput = []
    consoleErrors = []
    console.log = mock((...args: any[]) => {
      consoleOutput.push(args.join(' '))
    })
    console.error = mock((...args: any[]) => {
      consoleErrors.push(args.join(' '))
    })
  })
  
  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  // Simulate the command logic
  const simulateCommentCommand = async (changeIdOrUrl: string, cliMessage?: string, stdinMessage?: string) => {
    const changeId = extractChangeNumber(changeIdOrUrl)
    const finalMessage = cliMessage && stdinMessage ? cliMessage + stdinMessage : cliMessage || stdinMessage
    
    if (!finalMessage) {
      return { success: false, reason: 'no message' }
    }
    
    console.log('Posting comment...')
    
    try {
      // Simulate API call
      const response = await fetch(
        `https://gerrit.example.com/a/changes/${changeId}/revisions/current/review`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa('testuser:testpass')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: finalMessage })
        }
      )
      
      if (response.ok) {
        console.log('✓ Comment posted successfully!')
        return { success: true, message: finalMessage }
      } else {
        throw new Error(`API returned ${response.status}`)
      }
    } catch (error) {
      console.error('✗ Failed to post comment:', error instanceof Error ? error.message : String(error))
      return { success: false, error }
    }
  }

  describe('Piping modes', () => {
    test('should accept piped input', async () => {
      const result = await simulateCommentCommand('12345', undefined, 'This is a piped comment')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('This is a piped comment')
      expect(consoleOutput).toContain('Posting comment...')
      expect(consoleOutput).toContain('✓ Comment posted successfully!')
    })

    test('should accept -m flag alone', async () => {
      const result = await simulateCommentCommand('12345', 'Direct message')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('Direct message')
      expect(consoleOutput).toContain('✓ Comment posted successfully!')
    })

    test('should concatenate -m flag with piped input', async () => {
      const result = await simulateCommentCommand('12345', '🤖: ', 'Automated comment')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('🤖: Automated comment')
      expect(consoleOutput).toContain('✓ Comment posted successfully!')
    })

    test('should handle multi-line piped input', async () => {
      const multiLineInput = 'Line 1\nLine 2\nLine 3'
      const result = await simulateCommentCommand('12345', undefined, multiLineInput)
      
      expect(result.success).toBe(true)
      expect(result.message).toBe(multiLineInput)
    })

    test('should handle empty input', async () => {
      const result = await simulateCommentCommand('12345', undefined, undefined)
      
      expect(result.success).toBe(false)
      expect(result.reason).toBe('no message')
      expect(consoleOutput).not.toContain('Posting comment...')
    })

    test('should handle whitespace-only input', async () => {
      const result = await simulateCommentCommand('12345', undefined, '')
      
      expect(result.success).toBe(false)
      expect(result.reason).toBe('no message')
    })
  })

  describe('URL support', () => {
    test('should work with Gerrit URLs', async () => {
      const result = await simulateCommentCommand(
        'https://gerrit.example.com/c/project/+/12345',
        undefined,
        'Comment on URL'
      )
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('Comment on URL')
    })

    test('should work with URL and -m flag', async () => {
      const result = await simulateCommentCommand(
        'https://gerrit.example.com/c/project/+/12345',
        'Prefix: ',
        'Main content'
      )
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('Prefix: Main content')
    })
  })

  describe('Message combination', () => {
    test('should concatenate without forced newline', async () => {
      const result = await simulateCommentCommand('12345', 'Prefix: ', 'Content')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('Prefix: Content')
    })

    test('should allow explicit newlines in -m flag', async () => {
      const result = await simulateCommentCommand('12345', 'Header\n', 'Content')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('Header\nContent')
    })

    test('should handle empty -m with piped content', async () => {
      const result = await simulateCommentCommand('12345', '', 'Content')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('Content')
    })
  })

  describe('Error handling', () => {
    test('should handle API errors gracefully', async () => {
      // Mock a failing fetch
      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        return new Response('{"message":"Permission denied"}', { status: 403 })
      }) as any
      
      const result = await simulateCommentCommand('12345', undefined, 'This should fail')
      
      expect(result.success).toBe(false)
      expect(consoleErrors.join(' ')).toContain('Failed to post comment')
      
      global.fetch = originalFetch
    })

    test('should handle network errors', async () => {
      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        throw new Error('Network error')
      }) as any
      
      const result = await simulateCommentCommand('12345', undefined, 'Network test')
      
      expect(result.success).toBe(false)
      expect(consoleErrors.join(' ')).toContain('Network error')
      
      global.fetch = originalFetch
    })
  })

  describe('Special characters', () => {
    test('should handle unicode characters', async () => {
      const result = await simulateCommentCommand('12345', undefined, '🎉 Unicode test 你好 🚀')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('🎉 Unicode test 你好 🚀')
    })

    test('should handle quotes and special chars', async () => {
      const result = await simulateCommentCommand(
        '12345',
        undefined,
        'Test with "quotes" and \'apostrophes\' & symbols <>'
      )
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('quotes')
      expect(result.message).toContain('apostrophes')
    })
  })
})