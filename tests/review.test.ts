import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { Effect, Layer } from 'effect'
import { reviewCommand } from '@/cli/commands/review'
import { AiService, NoAiToolFoundError } from '@/services/ai'
import { GerritApiService } from '@/api/gerrit'
import { ConfigService } from '@/services/config'
import { createMockConfigService } from './helpers/config-mock'
import type { ChangeInfo, CommentInfo, MessageInfo } from '@/schemas/gerrit'

describe('Review Command', () => {
  let consoleSpy: any
  let mockAiService: any
  let mockApiService: any

  beforeEach(() => {
    consoleSpy = {
      log: spyOn(console, 'log').mockImplementation(() => {}),
      error: spyOn(console, 'error').mockImplementation(() => {}),
    }

    // Mock AI Service
    mockAiService = {
      detectAiTool: () => Effect.succeed('claude'),
      extractResponseTag: (output: string) => Effect.succeed(output),
      runPrompt: (prompt: string, input: string) => {
        if (
          prompt.includes('INLINE_REVIEW_SYSTEM_PROMPT') ||
          prompt.includes('Example Output (THIS IS THE ONLY ACCEPTABLE FORMAT)')
        ) {
          // Return mock inline comments
          return Effect.succeed(
            JSON.stringify([
              {
                file: 'src/main.ts',
                line: 10,
                message: '🤖 Consider adding error handling here',
              },
            ]),
          )
        } else {
          // Return mock overall review
          return Effect.succeed(
            '🤖 Claude Code\n\nOVERALL ASSESSMENT\n\nThe code looks good overall.',
          )
        }
      },
    }

    // Mock Gerrit API Service
    const mockChange: ChangeInfo = {
      id: 'project~master~I123',
      _number: 12345,
      change_id: 'I123',
      project: 'test-project',
      branch: 'master',
      subject: 'Test change',
      status: 'NEW',
      created: '2024-01-01 10:00:00.000000000',
      updated: '2024-01-01 12:00:00.000000000',
      owner: {
        _account_id: 1000,
        name: 'Test User',
        email: 'test@example.com',
      },
    }

    mockApiService = {
      getChange: () => Effect.succeed(mockChange),
      getDiff: () => Effect.succeed('diff --git a/src/main.ts b/src/main.ts\n+console.log("test")'),
      getComments: () => Effect.succeed({} as Record<string, CommentInfo[]>),
      getMessages: () => Effect.succeed([] as MessageInfo[]),
      listChanges: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Not implemented' }),
      postReview: () => Effect.succeed(undefined as void),
      abandonChange: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Not implemented' }),
      testConnection: Effect.succeed(true),
      getRevision: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Not implemented' }),
      getFiles: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Not implemented' }),
      getFileDiff: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Not implemented' }),
      getFileContent: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Not implemented' }),
      getPatch: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Not implemented' }),
    }
  })

  afterEach(() => {
    consoleSpy.log.mockRestore()
    consoleSpy.error.mockRestore()
  })

  test('should detect AI tool and perform review', async () => {
    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', { debug: false }).pipe(
          Effect.provide(Layer.succeed(AiService, mockAiService)),
          Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Right')

    // Check that AI tool detection was logged
    expect(consoleSpy.log).toHaveBeenCalledWith('→ Checking for AI tool availability...')
    expect(consoleSpy.log).toHaveBeenCalledWith('✓ Found AI tool: claude')

    // Check that review stages were executed
    expect(consoleSpy.log).toHaveBeenCalledWith('→ Generating inline comments for change 12345...')
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '→ Generating overall review comment for change 12345...',
    )
    expect(consoleSpy.log).toHaveBeenCalledWith('✓ Review complete for 12345')
  })

  test('should handle comment mode with auto-yes', async () => {
    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', { comment: true, yes: true }).pipe(
          Effect.provide(Layer.succeed(AiService, mockAiService)),
          Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Right')

    // Check that comments were posted without prompts
    expect(consoleSpy.log).toHaveBeenCalledWith('✓ Inline comments posted for 12345')
    expect(consoleSpy.log).toHaveBeenCalledWith('✓ Overall review posted for 12345')
  })

  test('should show debug output when debug flag is set', async () => {
    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', { debug: true }).pipe(
          Effect.provide(Layer.succeed(AiService, mockAiService)),
          Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Right')

    // Check that debug messages were shown
    expect(consoleSpy.log).toHaveBeenCalledWith('[DEBUG] Running AI for inline comments...')
    expect(consoleSpy.log).toHaveBeenCalledWith('[DEBUG] Running AI for overall review...')
  })

  test('should fail when no AI tool is available', async () => {
    const noToolService = {
      detectAiTool: () => Effect.fail(new NoAiToolFoundError({ message: 'No AI tool found' })),
      extractResponseTag: mockAiService.extractResponseTag,
      runPrompt: mockAiService.runPrompt,
    }

    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', {}).pipe(
          Effect.provide(Layer.succeed(AiService, noToolService)),
          Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(Error)
      expect(result.left.message).toContain('No AI tool found')
    }
  })

  test('should handle invalid JSON response for inline comments', async () => {
    const badJsonService = {
      detectAiTool: () => Effect.succeed('claude'),
      extractResponseTag: (output: string) => Effect.succeed(output),
      runPrompt: (prompt: string, input: string) => {
        if (
          prompt.includes('INLINE_REVIEW_SYSTEM_PROMPT') ||
          prompt.includes('Example Output (THIS IS THE ONLY ACCEPTABLE FORMAT)')
        ) {
          // Return invalid JSON
          return Effect.succeed('not valid json')
        } else {
          return Effect.succeed(
            '🤖 Claude Code\n\nOVERALL ASSESSMENT\n\nThe code looks good overall.',
          )
        }
      },
    }

    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', {}).pipe(
          Effect.provide(Layer.succeed(AiService, badJsonService)),
          Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Left')
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse inline comments JSON'),
    )
  })

  test('should handle empty inline comments array', async () => {
    const emptyCommentsService = {
      detectAiTool: () => Effect.succeed('claude'),
      extractResponseTag: (output: string) => Effect.succeed(output),
      runPrompt: (prompt: string, input: string) => {
        if (
          prompt.includes('INLINE_REVIEW_SYSTEM_PROMPT') ||
          prompt.includes('Example Output (THIS IS THE ONLY ACCEPTABLE FORMAT)')
        ) {
          // Return empty array
          return Effect.succeed('[]')
        } else {
          return Effect.succeed('🤖 Claude Code\n\nOVERALL ASSESSMENT\n\nNo issues found.')
        }
      },
    }

    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', {}).pipe(
          Effect.provide(Layer.succeed(AiService, emptyCommentsService)),
          Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Right')
    expect(consoleSpy.log).toHaveBeenCalledWith('\n→ No inline comments')
  })

  test('should format change data as XML for inline review', async () => {
    let capturedXmlData: string | undefined

    const captureService = {
      detectAiTool: () => Effect.succeed('claude'),
      extractResponseTag: (output: string) => Effect.succeed(output),
      runPrompt: (prompt: string, input: string) => {
        // Check if this is the inline review prompt (which gets XML data)
        // Inline prompt contains "JSON array" in its system prompt
        if (prompt.includes('JSON array wrapped in response tags')) {
          capturedXmlData = input
          return Effect.succeed('[]')
        } else {
          return Effect.succeed('🤖 Claude Code\n\nOVERALL ASSESSMENT\n\nLooks good.')
        }
      },
    }

    await Effect.runPromise(
      reviewCommand('12345', {}).pipe(
        Effect.provide(Layer.succeed(AiService, captureService)),
        Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
        Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
      ),
    )

    expect(capturedXmlData).toBeDefined()
    expect(capturedXmlData).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(capturedXmlData).toContain('<show_result>')
    expect(capturedXmlData).toContain('<change>')
    expect(capturedXmlData).toContain('<id>I123</id>')
    expect(capturedXmlData).toContain('<number>12345</number>')
  })

  test('should display review without posting when --comment flag is not present', async () => {
    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', {}).pipe(
          Effect.provide(Layer.succeed(AiService, mockAiService)),
          Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Right')

    // Check that it displays the reviews but doesn't post
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('━━━━━━ INLINE COMMENTS ━━━━━━'),
    )
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('━━━━━━ OVERALL REVIEW ━━━━━━'),
    )

    // Verify it doesn't post
    expect(consoleSpy.log).not.toHaveBeenCalledWith('✓ Inline comments posted for 12345')
    expect(consoleSpy.log).not.toHaveBeenCalledWith('✓ Overall review posted for 12345')
  })

  test('should handle error during comment posting', async () => {
    // Create a failing API service
    const failingApiService = {
      ...mockApiService,
      postReview: () => Effect.fail({ _tag: 'ApiError' as const, message: 'Network error' }),
    }

    const result = await Effect.runPromise(
      Effect.either(
        reviewCommand('12345', { comment: true, yes: true }).pipe(
          Effect.provide(Layer.succeed(AiService, mockAiService)),
          Effect.provide(Layer.succeed(GerritApiService, failingApiService)),
          Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
        ),
      ),
    )

    expect(result._tag).toBe('Left')
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to post inline comments'),
    )
  })

  test('should format change data as pretty text for overall review', async () => {
    let capturedPrettyData: string | undefined

    const captureService = {
      detectAiTool: () => Effect.succeed('claude'),
      extractResponseTag: (output: string) => Effect.succeed(output),
      runPrompt: (prompt: string, input: string) => {
        // Check if this is the inline review prompt (which gets XML) or overall (which gets pretty text)
        if (
          prompt.includes('Example Output (THIS IS THE ONLY ACCEPTABLE FORMAT)') &&
          prompt.includes('<response>') &&
          prompt.includes('JSON')
        ) {
          // This is inline review with XML data
          return Effect.succeed('[]')
        } else if (prompt.includes('OVERALL ASSESSMENT')) {
          // This is overall review with pretty text data
          capturedPrettyData = input
          return Effect.succeed('🤖 Claude Code\n\nOVERALL ASSESSMENT\n\nLooks good.')
        } else {
          return Effect.succeed('🤖 Claude Code\n\nOVERALL ASSESSMENT\n\nLooks good.')
        }
      },
    }

    await Effect.runPromise(
      reviewCommand('12345', {}).pipe(
        Effect.provide(Layer.succeed(AiService, captureService)),
        Effect.provide(Layer.succeed(GerritApiService, mockApiService)),
        Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
      ),
    )

    expect(capturedPrettyData).toBeDefined()
    expect(capturedPrettyData).toContain('📋 Change 12345: Test change')
    expect(capturedPrettyData).toContain('Project: test-project')
    expect(capturedPrettyData).toContain('Branch: master')
    expect(capturedPrettyData).toContain('Status: NEW')
  })
})
