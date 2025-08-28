import { test, expect, describe, beforeAll, afterEach, afterAll } from 'bun:test'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { Effect, Layer } from 'effect'
import { ConfigService } from '@/services/config'
import { GerritApiServiceLive } from '@/api/gerrit'
import { commentCommand } from '@/cli/commands/comment'
import { EventEmitter } from 'node:events'

import { createMockConfigService } from './helpers/config-mock'
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

describe('Gerrit API Compliance Tests', () => {
  const mockProcessStdin = new MockProcessStdin()

  test('should match exact Gerrit API format for batch comments', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    let capturedRequestBody: any = null

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
        capturedRequestBody = await request.json()
        return HttpResponse.json({})
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Test exact Gerrit API example from documentation
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          {
            file: 'gerrit-server/src/main/java/com/google/gerrit/server/project/RefControl.java',
            line: 23,
            message: '[nit] trailing whitespace',
          },
          {
            file: 'gerrit-server/src/main/java/com/google/gerrit/server/project/RefControl.java',
            line: 49,
            message: '[nit] s/conrtol/control',
          },
          {
            file: 'gerrit-server/src/main/java/com/google/gerrit/server/project/RefControl.java',
            range: {
              start_line: 50,
              start_character: 0,
              end_line: 55,
              end_character: 20,
            },
            message: 'Incorrect indentation',
          },
        ]),
      )
    }, 10)

    await Effect.runPromise(program)

    // Verify the request body matches Gerrit API format
    expect(capturedRequestBody).toBeDefined()
    expect(capturedRequestBody.comments).toBeDefined()

    const comments =
      capturedRequestBody.comments[
        'gerrit-server/src/main/java/com/google/gerrit/server/project/RefControl.java'
      ]
    expect(comments).toBeDefined()
    expect(comments.length).toBe(3)

    // Verify first comment (line-based)
    expect(comments[0]).toEqual({
      line: 23,
      message: '[nit] trailing whitespace',
    })

    // Verify second comment (line-based)
    expect(comments[1]).toEqual({
      line: 49,
      message: '[nit] s/conrtol/control',
    })

    // Verify third comment (range-based)
    expect(comments[2]).toEqual({
      range: {
        start_line: 50,
        start_character: 0,
        end_line: 55,
        end_character: 20,
      },
      message: 'Incorrect indentation',
    })

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })

  test('should handle all Gerrit comment features combined', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    let capturedRequestBody: any = null

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
        capturedRequestBody = await request.json()
        return HttpResponse.json({})
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Comprehensive test with all features
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          // Simple line comment
          {
            file: 'src/main/java/com/example/MyClass.java',
            line: 15,
            message: 'Could you refactor this method to improve readability?',
          },
          // Range comment with character positions
          {
            file: 'src/main/java/com/example/MyClass.java',
            range: {
              start_line: 30,
              start_character: 12,
              end_line: 30,
              end_character: 15,
            },
            message: "The variable name 'tmp' is not very descriptive. Can we rename it?",
          },
          // Multi-line range comment
          {
            file: 'README.md',
            range: {
              start_line: 20,
              end_line: 25,
            },
            message: 'This entire section needs updating',
          },
          // Comment with side parameter (PARENT)
          {
            file: 'config.xml',
            line: 10,
            side: 'PARENT',
            message: 'Why was this configuration removed?',
          },
          // Comment with side parameter (REVISION)
          {
            file: 'config.xml',
            line: 10,
            side: 'REVISION',
            message: 'Good improvement to the configuration',
          },
          // Unresolved comment
          {
            file: 'src/utils.js',
            line: 42,
            message: 'This needs to be fixed before merge',
            unresolved: true,
          },
          // Range with side and unresolved
          {
            file: 'src/service.java',
            range: {
              start_line: 100,
              start_character: 0,
              end_line: 110,
              end_character: 0,
            },
            side: 'REVISION',
            message: 'This block has a potential memory leak',
            unresolved: true,
          },
        ]),
      )
    }, 10)

    await Effect.runPromise(program)

    // Verify the request body structure
    expect(capturedRequestBody).toBeDefined()
    expect(capturedRequestBody.comments).toBeDefined()

    // Check MyClass.java comments
    const myClassComments = capturedRequestBody.comments['src/main/java/com/example/MyClass.java']
    expect(myClassComments).toBeDefined()
    expect(myClassComments.length).toBe(2)

    expect(myClassComments[0]).toEqual({
      line: 15,
      message: 'Could you refactor this method to improve readability?',
    })

    expect(myClassComments[1]).toEqual({
      range: {
        start_line: 30,
        start_character: 12,
        end_line: 30,
        end_character: 15,
      },
      message: "The variable name 'tmp' is not very descriptive. Can we rename it?",
    })

    // Check README.md comments
    const readmeComments = capturedRequestBody.comments['README.md']
    expect(readmeComments).toBeDefined()
    expect(readmeComments.length).toBe(1)

    expect(readmeComments[0]).toEqual({
      range: {
        start_line: 20,
        end_line: 25,
      },
      message: 'This entire section needs updating',
    })

    // Check config.xml comments with side parameters
    const configComments = capturedRequestBody.comments['config.xml']
    expect(configComments).toBeDefined()
    expect(configComments.length).toBe(2)

    expect(configComments[0]).toEqual({
      line: 10,
      side: 'PARENT',
      message: 'Why was this configuration removed?',
    })

    expect(configComments[1]).toEqual({
      line: 10,
      side: 'REVISION',
      message: 'Good improvement to the configuration',
    })

    // Check utils.js unresolved comment
    const utilsComments = capturedRequestBody.comments['src/utils.js']
    expect(utilsComments).toBeDefined()
    expect(utilsComments.length).toBe(1)

    expect(utilsComments[0]).toEqual({
      line: 42,
      message: 'This needs to be fixed before merge',
      unresolved: true,
    })

    // Check service.java range with side and unresolved
    const serviceComments = capturedRequestBody.comments['src/service.java']
    expect(serviceComments).toBeDefined()
    expect(serviceComments.length).toBe(1)

    expect(serviceComments[0]).toEqual({
      range: {
        start_line: 100,
        start_character: 0,
        end_line: 110,
        end_character: 0,
      },
      side: 'REVISION',
      message: 'This block has a potential memory leak',
      unresolved: true,
    })

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })

  test('should handle comment without line when using range', async () => {
    const originalStdin = process.stdin
    Object.defineProperty(process, 'stdin', {
      value: mockProcessStdin,
      configurable: true,
    })

    let capturedRequestBody: any = null

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
        capturedRequestBody = await request.json()
        return HttpResponse.json({})
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())

    const program = commentCommand('12345', { batch: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Test comment with only range, no line
    setTimeout(() => {
      mockProcessStdin.emit(
        'data',
        JSON.stringify([
          {
            file: 'src/main.java',
            range: {
              start_line: 10,
              end_line: 15,
            },
            message: 'This should work without a line property',
          },
        ]),
      )
    }, 10)

    await Effect.runPromise(program)

    // Verify the comment has range but no line property
    expect(capturedRequestBody).toBeDefined()
    expect(capturedRequestBody.comments).toBeDefined()

    const comments = capturedRequestBody.comments['src/main.java']
    expect(comments).toBeDefined()
    expect(comments.length).toBe(1)

    expect(comments[0]).toEqual({
      range: {
        start_line: 10,
        end_line: 15,
      },
      message: 'This should work without a line property',
    })

    // Ensure no 'line' property is present when using range
    expect(comments[0].line).toBeUndefined()

    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true,
    })
  })
})
