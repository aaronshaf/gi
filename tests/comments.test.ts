import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach, mock } from 'bun:test'
import { Effect } from 'effect'
import { commentsCommand } from '@/cli/commands/comments'
import { GerritApiServiceLive } from '@/api/gerrit'
import { ConfigService } from '@/services/config'
import { Layer } from 'effect'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
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
      email: 'test@example.com'
    })
  })
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
      })
    )

    const program = commentsCommand('12345', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    // Check that comments were displayed
    const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n')
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
      })
    )

    const program = commentsCommand('12345', { xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    // Check XML output
    const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n')
    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(output).toContain('<comments_result>')
    expect(output).toContain('<change_id>12345</change_id>')
    expect(output).toContain('<comment_count>3</comment_count>')
    expect(output).toContain('<message><![CDATA[Please update the commit message]]></message>')
    expect(output).toContain('<unresolved>true</unresolved>')
    expect(output).toContain('</comments_result>')
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
      })
    )

    const program = commentsCommand('12345', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n')
    expect(output).toContain('No comments found on this change')
  })
})