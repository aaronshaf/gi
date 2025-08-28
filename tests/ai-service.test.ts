import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AiService, AiServiceError, NoAiToolFoundError, AiResponseParseError } from '@/services/ai'
import { ConfigService } from '@/services/config'
import { createMockConfigService } from './helpers/config-mock'

describe('AI Service', () => {
  describe('extractResponseTag', () => {
    test('should extract content from response tags', async () => {
      const input = `Some text before
<response>
This is the response content
</response>
Some text after`

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* AiService
          return yield* service.extractResponseTag(input)
        }).pipe(
          Effect.provide(
            Layer.succeed(
              AiService,
              AiService.of({
                detectAiTool: () =>
                  Effect.fail(new NoAiToolFoundError({ message: 'Not implemented' })),
                extractResponseTag: (output: string) =>
                  Effect.gen(function* () {
                    const responseMatch = output.match(/<response>([\s\S]*?)<\/response>/i)

                    if (!responseMatch || !responseMatch[1]) {
                      return yield* Effect.fail(
                        new AiResponseParseError({
                          message: 'No <response> tag found in AI output',
                          rawOutput: output,
                        }),
                      )
                    }

                    return responseMatch[1].trim()
                  }),
                runPrompt: () => Effect.fail(new AiServiceError({ message: 'Not implemented' })),
              }),
            ),
          ),
        ),
      )

      expect(result).toBe('This is the response content')
    })

    test('should handle case-insensitive response tags', async () => {
      const input = `<RESPONSE>Content here</RESPONSE>`

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* AiService
          return yield* service.extractResponseTag(input)
        }).pipe(
          Effect.provide(
            Layer.succeed(
              AiService,
              AiService.of({
                detectAiTool: () =>
                  Effect.fail(new NoAiToolFoundError({ message: 'Not implemented' })),
                extractResponseTag: (output: string) =>
                  Effect.gen(function* () {
                    const responseMatch = output.match(/<response>([\s\S]*?)<\/response>/i)

                    if (!responseMatch || !responseMatch[1]) {
                      return yield* Effect.fail(
                        new AiResponseParseError({
                          message: 'No <response> tag found in AI output',
                          rawOutput: output,
                        }),
                      )
                    }

                    return responseMatch[1].trim()
                  }),
                runPrompt: () => Effect.fail(new AiServiceError({ message: 'Not implemented' })),
              }),
            ),
          ),
        ),
      )

      expect(result).toBe('Content here')
    })

    test('should fail when no response tag is found', async () => {
      const input = 'This is just plain text without tags'

      const result = await Effect.runPromise(
        Effect.either(
          Effect.gen(function* () {
            const service = yield* AiService
            return yield* service.extractResponseTag(input)
          }).pipe(
            Effect.provide(
              Layer.succeed(
                AiService,
                AiService.of({
                  detectAiTool: () =>
                    Effect.fail(new NoAiToolFoundError({ message: 'Not implemented' })),
                  extractResponseTag: (output: string) =>
                    Effect.gen(function* () {
                      const responseMatch = output.match(/<response>([\s\S]*?)<\/response>/i)

                      if (!responseMatch || !responseMatch[1]) {
                        return yield* Effect.fail(
                          new AiResponseParseError({
                            message: 'No <response> tag found in AI output',
                            rawOutput: output,
                          }),
                        )
                      }

                      return responseMatch[1].trim()
                    }),
                  runPrompt: () => Effect.fail(new AiServiceError({ message: 'Not implemented' })),
                }),
              ),
            ),
          ),
        ),
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(AiResponseParseError)
        expect((result.left as AiResponseParseError).rawOutput).toBe(input)
      }
    })

    test('should handle multiline content in response tags', async () => {
      const input = `<response>
Line 1
Line 2
Line 3
</response>`

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* AiService
          return yield* service.extractResponseTag(input)
        }).pipe(
          Effect.provide(
            Layer.succeed(
              AiService,
              AiService.of({
                detectAiTool: () =>
                  Effect.fail(new NoAiToolFoundError({ message: 'Not implemented' })),
                extractResponseTag: (output: string) =>
                  Effect.gen(function* () {
                    const responseMatch = output.match(/<response>([\s\S]*?)<\/response>/i)

                    if (!responseMatch || !responseMatch[1]) {
                      return yield* Effect.fail(
                        new AiResponseParseError({
                          message: 'No <response> tag found in AI output',
                          rawOutput: output,
                        }),
                      )
                    }

                    return responseMatch[1].trim()
                  }),
                runPrompt: () => Effect.fail(new AiServiceError({ message: 'Not implemented' })),
              }),
            ),
          ),
        ),
      )

      expect(result).toBe('Line 1\nLine 2\nLine 3')
    })
  })

  describe('Error Types', () => {
    test('NoAiToolFoundError should have correct message', () => {
      const error = new NoAiToolFoundError({
        message: 'No AI tool found. Please install claude, llm, or opencode CLI.',
      })
      expect(error.message).toBe('No AI tool found. Please install claude, llm, or opencode CLI.')
    })

    test('AiResponseParseError should include raw output', () => {
      const error = new AiResponseParseError({
        message: 'Failed to parse response',
        rawOutput: 'Some raw output',
      })
      expect(error.message).toBe('Failed to parse response')
      expect(error.rawOutput).toBe('Some raw output')
    })

    test('AiServiceError should have message and optional cause', () => {
      const cause = new Error('Original error')
      const error = new AiServiceError({
        message: 'Service failed',
        cause,
      })
      expect(error.message).toBe('Service failed')
      expect(error.cause).toBe(cause)
    })
  })
})
