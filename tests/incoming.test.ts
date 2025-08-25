import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Effect, Layer } from 'effect'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { GerritApiServiceLive } from '@/api/gerrit'
import { incomingCommand } from '@/cli/commands/incoming'
import { ConfigService } from '@/services/config'

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

describe('incoming command', () => {
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

  it('should fetch and display incoming changes in pretty format', async () => {
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q')

        // Verify the correct query
        if (query === 'is:open -owner:self -is:wip -is:ignored reviewer:self') {
          return HttpResponse.text(`)]}'\n[
            {
              "id": "team-project~main~I123abc",
              "_number": 1001,
              "project": "team-project",
              "branch": "main",
              "subject": "Fix critical bug in authentication",
              "status": "NEW",
              "change_id": "I123abc",
              "owner": {
                "_account_id": 2001,
                "name": "Alice Developer",
                "email": "alice@example.com"
              },
              "updated": "2024-01-15 10:30:00.000000000"
            },
            {
              "id": "team-project~feature%2Fnew-api~I456def",
              "_number": 1002,
              "project": "team-project",
              "branch": "feature/new-api",
              "subject": "Add new API endpoint",
              "status": "NEW",
              "change_id": "I456def",
              "owner": {
                "_account_id": 2002,
                "name": "Bob Builder",
                "email": "bob@example.com"
              },
              "updated": "2024-01-15 11:00:00.000000000"
            },
            {
              "id": "another-project~main~I789ghi",
              "_number": 1003,
              "project": "another-project",
              "branch": "main",
              "subject": "Update documentation",
              "status": "NEW",
              "change_id": "I789ghi",
              "owner": {
                "_account_id": 2003,
                "name": "Charlie Coder",
                "email": "charlie@example.com"
              },
              "updated": "2024-01-15 09:00:00.000000000"
            }
          ]`)
        }
        return HttpResponse.json([])
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

    const program = incomingCommand({}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    // Check that changes were displayed
    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')

    // Should not have header since we removed it
    expect(output).not.toContain('Incoming changes for review')

    // Check project grouping
    expect(output).toContain('team-project')
    expect(output).toContain('another-project')

    // Check change details
    expect(output).toContain('1001')
    expect(output).toContain('Fix critical bug in authentication')
    expect(output).toContain('(by Alice Developer)')
    expect(output).toContain('1002')
    expect(output).toContain('Add new API endpoint')
    expect(output).toContain('(by Bob Builder)')
    expect(output).toContain('1003')
    expect(output).toContain('Update documentation')
    expect(output).toContain('(by Charlie Coder)')
  })

  it('should output XML format when --xml flag is used', async () => {
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q')

        if (query === 'is:open -owner:self -is:wip -is:ignored reviewer:self') {
          return HttpResponse.text(`)]}'\n[
            {
              "id": "xml-project~develop~Ixmltest",
              "_number": 2001,
              "project": "xml-project",
              "branch": "develop",
              "subject": "XML test change",
              "status": "NEW",
              "change_id": "Ixmltest",
              "owner": {
                "_account_id": 3001,
                "name": "XML User",
                "email": "xml@example.com"
              },
              "updated": "2024-01-15 14:00:00.000000000"
            }
          ]`)
        }
        return HttpResponse.json([])
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

    const program = incomingCommand({ xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    // Check XML output structure
    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(output).toContain('<incoming_result>')
    expect(output).toContain('<status>success</status>')
    expect(output).toContain('<count>1</count>')
    expect(output).toContain('<changes>')
    expect(output).toContain('<change>')
    expect(output).toContain('<number>2001</number>')
    expect(output).toContain('<subject><![CDATA[XML test change]]></subject>')
    expect(output).toContain('<project>xml-project</project>')
    expect(output).toContain('<branch>develop</branch>')
    expect(output).toContain('<status>NEW</status>')
    expect(output).toContain('<change_id>Ixmltest</change_id>')
    expect(output).toContain('<owner>XML User</owner>')
    expect(output).toContain('</change>')
    expect(output).toContain('</changes>')
    expect(output).toContain('</incoming_result>')
  })

  it('should handle no incoming changes gracefully', async () => {
    server.use(
      http.get('*/a/changes/', () => {
        return HttpResponse.text(`)]}'\n[]`)
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

    const program = incomingCommand({}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toBe('')
  })

  it('should handle network failures gracefully', async () => {
    server.use(
      http.get('*/a/changes/', () => {
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

    const program = incomingCommand({}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should handle authentication failures', async () => {
    server.use(
      http.get('*/a/changes/', () => {
        return HttpResponse.text('Unauthorized', { status: 401 })
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      ConfigService.of({
        getCredentials: Effect.succeed({
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'wrongpass',
        }),
        saveCredentials: () => Effect.succeed(undefined),
        deleteCredentials: Effect.succeed(undefined),
      }),
    )

    const program = incomingCommand({}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should properly escape XML special characters', async () => {
    server.use(
      http.get('*/a/changes/', () => {
        return HttpResponse.text(`)]}'\n[
          {
            "id": "test-project~main~Itest",
            "_number": 3001,
            "project": "test<>&\\"project",
            "branch": "main",
            "subject": "Fix <script>alert('XSS')</script> & entities",
            "status": "NEW",
            "change_id": "I<>&test",
            "owner": {
              "_account_id": 4001,
              "name": "User <>&\\"'",
              "email": "test@example.com"
            }
          }
        ]`)
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

    const program = incomingCommand({ xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    // Subject should be in CDATA
    expect(output).toContain(
      "<subject><![CDATA[Fix <script>alert('XSS')</script> & entities]]></subject>",
    )
    // Owner name should be preserved in output
    expect(output).toContain('<owner>User <>&"\'</owner>')
    // Project and change_id should be in output
    expect(output).toContain('<project>test<>&"project</project>')
    expect(output).toContain('<change_id>I<>&test</change_id>')
  })

  it('should group changes by project alphabetically', async () => {
    server.use(
      http.get('*/a/changes/', () => {
        return HttpResponse.text(`)]}'\n[
          {
            "id": "zebra-project~main~Izebra",
            "_number": 4001,
            "project": "zebra-project",
            "branch": "main",
            "subject": "Change in zebra",
            "status": "NEW",
            "change_id": "Izebra",
            "owner": {"_account_id": 5001, "name": "Zoe"}
          },
          {
            "id": "alpha-project~main~Ialpha",
            "_number": 4002,
            "project": "alpha-project",
            "branch": "main",
            "subject": "Change in alpha",
            "status": "NEW",
            "change_id": "Ialpha",
            "owner": {"_account_id": 5002, "name": "Amy"}
          },
          {
            "id": "beta-project~main~Ibeta",
            "_number": 4003,
            "project": "beta-project",
            "branch": "main",
            "subject": "Change in beta",
            "status": "NEW",
            "change_id": "Ibeta",
            "owner": {"_account_id": 5003, "name": "Ben"}
          }
        ]`)
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

    const program = incomingCommand({}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')

    // Find positions of project names in output
    const alphaPos = output.indexOf('alpha-project')
    const betaPos = output.indexOf('beta-project')
    const zebraPos = output.indexOf('zebra-project')

    // Verify alphabetical order
    expect(alphaPos).toBeLessThan(betaPos)
    expect(betaPos).toBeLessThan(zebraPos)
  })
})
