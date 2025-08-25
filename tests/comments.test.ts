import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Effect, Layer } from 'effect'
import { delay, HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { GerritApiServiceLive } from '@/api/gerrit'
import { commentsCommand } from '@/cli/commands/comments'
import { ConfigService } from '@/services/config'
import { commentHandlers, emptyCommentsHandlers } from './mocks/msw-handlers'

// Create MSW server
const server = setupServer(
  // Default handler for auth check
  http.get('*/a/accounts/self', ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Basic ')) {
      return HttpResponse.text('Unauthorized', { status: 401 })
    }
    return HttpResponse.json({
      _account_id: 1000,
      name: 'Test User',
      email: 'test@example.com',
    })
  }),
)

describe('comments command', () => {
  let mockConsoleLog: ReturnType<typeof mock>
  let mockConsoleError: ReturnType<typeof mock>

  beforeAll(() => {
    // Start MSW server before all tests
    server.listen({ onUnhandledRequest: 'bypass' })
  })

  afterAll(() => {
    // Clean up after all tests
    server.close()
  })

  beforeEach(() => {
    // Reset handlers to defaults before each test
    server.resetHandlers()

    mockConsoleLog = mock(() => {})
    mockConsoleError = mock(() => {})
    console.log = mockConsoleLog
    console.error = mockConsoleError
  })

  afterEach(() => {
    // Clean up after each test
    server.resetHandlers()
  })

  it('should fetch and display comments in pretty format', async () => {
    // Add comment handlers for this test
    server.use(...commentHandlers)

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

    const program = commentsCommand('12345', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    // Check that comments were displayed
    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Found 3 comments')
    expect(output).toContain('Commit Message')
    expect(output).toContain('Please update the commit message')
    expect(output).toContain('src/main.ts')
    expect(output).toContain('Consider using a more descriptive variable name')
    expect(output).toContain('[UNRESOLVED]')
  })

  it('should output XML format when --xml flag is used', async () => {
    // Add comment handlers for this test
    server.use(...commentHandlers)

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

    const program = commentsCommand('12345', { xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    // Check XML output structure
    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(output).toContain('<comments_result>')
    expect(output).toContain('<change_id>12345</change_id>')
    expect(output).toContain('<comment_count>3</comment_count>')
    expect(output).toContain('<message><![CDATA[Please update the commit message]]></message>')
    expect(output).toContain('<unresolved>true</unresolved>')
    expect(output).toContain('</comments_result>')

    // Verify XML is well-formed
    expect(output.match(/<comment>/g)?.length).toBe(3)
    expect(output.match(/<\/comment>/g)?.length).toBe(3)
  })

  it('should handle no comments gracefully', async () => {
    // Use empty comments handlers for this test
    server.use(...emptyCommentsHandlers)

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

    const program = commentsCommand('12345', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('No comments found on this change')
  })

  it('should handle network failures gracefully', async () => {
    // Configure server to return network error
    server.use(
      http.get('*/a/changes/:changeId/revisions/:revisionId/comments', () => {
        return HttpResponse.error()
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

    const program = commentsCommand('12345', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const errorOutput = mockConsoleError.mock.calls.map((call) => call[0]).join('\n')
    expect(errorOutput).toContain('Failed to fetch comments')
  })

  it('should handle network failures gracefully in XML mode', async () => {
    // Configure server to return network error
    server.use(
      http.get('*/a/changes/:changeId/revisions/:revisionId/comments', () => {
        return HttpResponse.error()
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

    const program = commentsCommand('12345', { xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<status>error</status>')
    expect(output).toContain('<error><![CDATA[')
  })

  it('should handle diff fetch failures gracefully', async () => {
    // Comments endpoint works
    server.use(
      http.get('*/a/changes/:changeId/revisions/:revisionId/comments', () => {
        return HttpResponse.text(`)]}'\n{
          "src/file.ts": [{
            "id": "test1",
            "message": "Test comment",
            "line": 10,
            "author": {"name": "Test User"}
          }]
        }`)
      }),
      // Diff endpoint fails
      http.get('*/a/changes/:changeId/revisions/:revisionId/files/:filePath/diff', () => {
        return HttpResponse.error()
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

    const program = commentsCommand('12345', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    // Should still display comment without context
    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Test comment')
    expect(output).toContain('src/file.ts')
  })

  it('should handle concurrent API calls efficiently', async () => {
    let _commentCallTime: number | null = null
    let diffCallCount = 0
    const diffCallTimes: number[] = []

    server.use(
      http.get('*/a/changes/:changeId/revisions/:revisionId/comments', async () => {
        _commentCallTime = Date.now()
        await delay(50) // Simulate network delay
        return HttpResponse.text(`)]}'\n{
          "file1.ts": [{"id": "c1", "message": "Comment 1", "line": 10}],
          "file2.ts": [{"id": "c2", "message": "Comment 2", "line": 20}],
          "file3.ts": [{"id": "c3", "message": "Comment 3", "line": 30}]
        }`)
      }),
      http.get('*/a/changes/:changeId/revisions/:revisionId/files/:filePath/diff', async () => {
        diffCallCount++
        diffCallTimes.push(Date.now())
        await delay(100) // Simulate network delay
        return HttpResponse.text(`)]}'\n{
          "content": [{"ab": ["line 1", "line 2"]}]
        }`)
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

    const startTime = Date.now()
    const program = commentsCommand('12345', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)
    const totalTime = Date.now() - startTime

    // Verify concurrent execution
    expect(diffCallCount).toBe(3) // 3 diff calls made

    // All diff calls should start close together (within 100ms)
    // indicating concurrent execution, not sequential
    const firstDiffTime = diffCallTimes[0]
    const lastDiffTime = diffCallTimes[diffCallTimes.length - 1]
    expect(lastDiffTime - firstDiffTime).toBeLessThan(100)

    // Total time should be less than sequential execution would take
    // Sequential: 50ms (comments) + 3 * 100ms (diffs) = 350ms
    // Concurrent: 50ms (comments) + 100ms (parallel diffs) = 150ms (plus overhead)
    expect(totalTime).toBeLessThan(250)
  })

  it('should properly escape XML special characters', async () => {
    server.use(
      http.get('*/a/changes/:changeId/revisions/:revisionId/comments', () => {
        return HttpResponse.text(`)]}'\n{
          "test.xml": [{
            "id": "xml-test",
            "message": "Test <script>alert('XSS')</script> & entities",
            "author": {
              "name": "User <>&\\"'",
              "email": "test@example.com"
            }
          }]
        }`)
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

    const program = commentsCommand('12345', { xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    // Message should be in CDATA
    expect(output).toContain(
      "<message><![CDATA[Test <script>alert('XSS')</script> & entities]]></message>",
    )
    // Author name should be in CDATA
    expect(output).toContain('<name><![CDATA[User <>&"\']]></name>')
    // Email should be escaped
    expect(output).toContain('<email>test@example.com</email>')
  })

  it('should handle comments with ranges correctly', async () => {
    server.use(
      http.get('*/a/changes/:changeId/revisions/:revisionId/comments', () => {
        return HttpResponse.text(`)]}'\n{
          "src/range.ts": [{
            "id": "range-comment",
            "message": "Multi-line comment",
            "range": {
              "start_line": 10,
              "end_line": 15,
              "start_character": 5,
              "end_character": 20
            }
          }]
        }`)
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

    const program = commentsCommand('12345', { xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<range>')
    expect(output).toContain('<start_line>10</start_line>')
    expect(output).toContain('<end_line>15</end_line>')
    expect(output).toContain('<start_character>5</start_character>')
    expect(output).toContain('<end_character>20</end_character>')
    expect(output).toContain('</range>')
  })
})
