import { test, expect, describe, beforeAll, afterEach, afterAll } from 'bun:test'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { Effect, Layer } from 'effect'
import { ConfigService } from '@/services/config'
import { GerritApiServiceLive } from '@/api/gerrit'
import { commentCommand } from '@/cli/commands/comment'
import { EventEmitter } from 'node:events'

// Create a mock process.stdin for testing
class MockProcessStdin extends EventEmitter {
  isTTY = false
  readable = true

  emit(event: string, data?: any): boolean {
    if (event === 'data') {
      super.emit('data', Buffer.from(data))
      // Automatically emit 'end' after data
      setTimeout(() => super.emit('end'), 0)
      return true
    }
    return super.emit(event, data)
  }
}

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('comment command - advanced batch features', () => {
  const mockProcessStdin = new MockProcessStdin()

  test('should handle batch comments with side parameter', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    server.use(
      http.get('*/a/changes/:changeId', () => {
        return HttpResponse.text(`)]}'\n{
          "id": "test-project~main~I123abc",
          "_number": 12345,
          "project": "test-project",
          "branch": "main",
          "change_id": "I123abc",
          "subject": "Test change",
          "status": "NEW",
          "created": "2024-01-15 10:00:00.000000000",
          "updated": "2024-01-15 10:00:00.000000000"
        }`)
      }),
      http.post('*/a/changes/:changeId/revisions/current/review', async ({ request }) => {
        const body = (await request.json()) as {
          message?: string
          comments?: Record<string, unknown[]>
        }
        expect(body.comments).toBeDefined()

        const fileComments = body.comments?.['src/main.js'] as Array<{
          line?: number
          side?: string
          message: string
        }>

        expect(fileComments?.length).toBe(2)
        expect(fileComments?.[0]).toMatchObject({
          line: 10,
          side: 'PARENT',
          message: 'Why was this removed?',
        })
        expect(fileComments?.[1]).toMatchObject({
          line: 10,
          side: 'REVISION',
          message: 'Good improvement',
        })

        return HttpResponse.json({})
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      ConfigService.of({
        getCredentials: Effect.succeed({
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass',
        }),
        saveCredentials: () => Effect.succeed(undefined),
        deleteCredentials: Effect.succeed(undefined),
      }),
    )

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Simulate stdin data with side parameter
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          { file: 'src/main.js', line: 10, message: 'Why was this removed?', side: 'PARENT' },
          { file: 'src/main.js', line: 10, message: 'Good improvement', side: 'REVISION' },
        ]),
      )
    }, 10)

    await Effect.runPromise(program)

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })

  test('should handle batch comments with range parameter', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    server.use(
      http.get('*/a/changes/:changeId', () => {
        return HttpResponse.text(`)]}'\n{
          "id": "test-project~main~I123abc",
          "_number": 12345,
          "project": "test-project",
          "branch": "main",
          "change_id": "I123abc",
          "subject": "Test change",
          "status": "NEW"
        }`)
      }),
      http.post('*/a/changes/:changeId/revisions/current/review', async ({ request }) => {
        const body = (await request.json()) as {
          comments?: Record<string, unknown[]>
        }

        const fileComments = body.comments?.['src/Calculator.java'] as Array<{
          range?: {
            start_line: number
            end_line: number
            start_character?: number
            end_character?: number
          }
          message: string
        }>

        expect(fileComments?.length).toBe(3)

        // Multi-line range comment
        expect(fileComments?.[0]).toMatchObject({
          range: {
            start_line: 50,
            end_line: 55,
          },
          message: 'This block needs refactoring',
        })

        // Character-specific range
        expect(fileComments?.[1]).toMatchObject({
          range: {
            start_line: 10,
            start_character: 8,
            end_line: 10,
            end_character: 25,
          },
          message: 'Variable name is confusing',
        })

        // Mixed with regular line comment
        expect(fileComments?.[2]).toMatchObject({
          line: 42,
          message: 'Add null check here',
        })

        return HttpResponse.json({})
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      ConfigService.of({
        getCredentials: Effect.succeed({
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass',
        }),
        saveCredentials: () => Effect.succeed(undefined),
        deleteCredentials: Effect.succeed(undefined),
      }),
    )

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Simulate stdin data with range parameter
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          {
            file: 'src/Calculator.java',
            range: { start_line: 50, end_line: 55 },
            message: 'This block needs refactoring',
          },
          {
            file: 'src/Calculator.java',
            range: { start_line: 10, start_character: 8, end_line: 10, end_character: 25 },
            message: 'Variable name is confusing',
          },
          {
            file: 'src/Calculator.java',
            line: 42,
            message: 'Add null check here',
          },
        ]),
      )
    }, 10)

    await Effect.runPromise(program)

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })

  test('should handle batch comments with both side and range', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    server.use(
      http.get('*/a/changes/:changeId', () => {
        return HttpResponse.text(`)]}'\n{
          "id": "test-project~main~I123abc",
          "_number": 12345,
          "project": "test-project",
          "branch": "main",
          "change_id": "I123abc",
          "subject": "Test change",
          "status": "NEW"
        }`)
      }),
      http.post('*/a/changes/:changeId/revisions/current/review', async ({ request }) => {
        const body = (await request.json()) as {
          comments?: Record<string, unknown[]>
        }

        const fileComments = body.comments?.['src/Service.java'] as Array<{
          range?: {
            start_line: number
            end_line: number
          }
          side?: string
          message: string
          unresolved?: boolean
        }>

        expect(fileComments?.length).toBe(2)

        // Range comment on PARENT side
        expect(fileComments?.[0]).toMatchObject({
          range: {
            start_line: 20,
            end_line: 35,
          },
          side: 'PARENT',
          message: 'Why was this error handling removed?',
          unresolved: true,
        })

        // Range comment on REVISION side
        expect(fileComments?.[1]).toMatchObject({
          range: {
            start_line: 20,
            end_line: 35,
          },
          side: 'REVISION',
          message: 'New error handling looks good, but consider extracting',
        })

        return HttpResponse.json({})
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      ConfigService.of({
        getCredentials: Effect.succeed({
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass',
        }),
        saveCredentials: () => Effect.succeed(undefined),
        deleteCredentials: Effect.succeed(undefined),
      }),
    )

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Simulate stdin data with both range and side
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          {
            file: 'src/Service.java',
            range: { start_line: 20, end_line: 35 },
            side: 'PARENT',
            message: 'Why was this error handling removed?',
            unresolved: true,
          },
          {
            file: 'src/Service.java',
            range: { start_line: 20, end_line: 35 },
            side: 'REVISION',
            message: 'New error handling looks good, but consider extracting',
          },
        ]),
      )
    }, 10)

    await Effect.runPromise(program)

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })

  test('should validate side parameter values', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      ConfigService.of({
        getCredentials: Effect.succeed({
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass',
        }),
        saveCredentials: () => Effect.succeed(undefined),
        deleteCredentials: Effect.succeed(undefined),
      }),
    )

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Simulate invalid side value
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          {
            file: 'src/main.js',
            line: 10,
            message: 'Test',
            side: 'INVALID', // Invalid side value
          },
        ]),
      )
    }, 10)

    await expect(Effect.runPromise(program)).rejects.toThrow('Invalid batch input format')

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })

  test('should require either line or range but not both', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    server.use(
      http.get('*/a/changes/:changeId', () => {
        return HttpResponse.text(`)]}'\n{
          "id": "test-project~main~I123abc",
          "_number": 12345,
          "project": "test-project",
          "branch": "main",
          "change_id": "I123abc",
          "subject": "Test change",
          "status": "NEW"
        }`)
      }),
      http.post('*/a/changes/:changeId/revisions/current/review', async ({ request }) => {
        const body = (await request.json()) as {
          comments?: Record<string, unknown[]>
        }

        const fileComments = body.comments?.['src/main.js'] as Array<{
          line?: number
          range?: unknown
          message: string
        }>

        // Should use range when both are provided (range takes precedence)
        expect(fileComments?.[0]).toMatchObject({
          range: {
            start_line: 10,
            end_line: 15,
          },
          message: 'Test comment',
        })
        // line should NOT be included when range is present (Gerrit API preference)
        expect(fileComments?.[0].line).toBeUndefined()

        return HttpResponse.json({})
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      ConfigService.of({
        getCredentials: Effect.succeed({
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass',
        }),
        saveCredentials: () => Effect.succeed(undefined),
        deleteCredentials: Effect.succeed(undefined),
      }),
    )

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Both line and range provided - should work
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          {
            file: 'src/main.js',
            line: 10, // Will be included
            range: { start_line: 10, end_line: 15 }, // Takes precedence
            message: 'Test comment',
          },
        ]),
      )
    }, 10)

    await Effect.runPromise(program)

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })
})
