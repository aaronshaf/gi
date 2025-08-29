import { describe, test, expect, beforeEach } from 'bun:test'
import { Effect, Layer } from 'effect'
import { mineCommand } from '@/cli/commands/mine'
import { GerritApiService, type ApiError } from '@/api/gerrit'
import { generateMockChange } from '@/test-utils/mock-generator'
import type { ChangeInfo } from '@/schemas/gerrit'

// Mock console.log to capture output
const mockConsole = {
  logs: [] as string[],
  log: function (message: string) {
    this.logs.push(message)
  },
  clear: function () {
    this.logs = []
  },
}

describe('mine command', () => {
  beforeEach(() => {
    mockConsole.clear()
    // Replace console.log for tests
    global.console.log = mockConsole.log.bind(mockConsole)
  })

  test('should fetch and display my changes in pretty format', async () => {
    const mockChanges: ChangeInfo[] = [
      generateMockChange({
        _number: 12345,
        subject: 'My test change',
        project: 'test-project',
        branch: 'main',
        status: 'NEW',
      }),
      generateMockChange({
        _number: 12346,
        subject: 'Another change',
        project: 'test-project-2',
        branch: 'develop',
        status: 'MERGED',
      }),
    ]

    const mockApi = GerritApiService.of({
      listChanges: (query: string) => {
        expect(query).toBe('owner:self status:open')
        return Effect.succeed(mockChanges)
      },
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    await Effect.runPromise(
      mineCommand({ xml: false }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
    )

    expect(mockConsole.logs.length).toBeGreaterThan(0)
    expect(mockConsole.logs.some((log) => log.includes('My test change'))).toBe(true)
    expect(mockConsole.logs.some((log) => log.includes('Another change'))).toBe(true)
  })

  test('should output XML format when --xml flag is used', async () => {
    const mockChanges: ChangeInfo[] = [
      generateMockChange({
        _number: 12345,
        subject: 'Test change',
        project: 'test-project',
        branch: 'main',
        status: 'NEW',
      }),
    ]

    const mockApi = GerritApiService.of({
      listChanges: (query: string) => {
        expect(query).toBe('owner:self status:open')
        return Effect.succeed(mockChanges)
      },
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    await Effect.runPromise(
      mineCommand({ xml: true }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
    )

    const output = mockConsole.logs.join('\n')
    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(output).toContain('<changes count="1">')
    expect(output).toContain('<change>')
    expect(output).toContain('<number>12345</number>')
    expect(output).toContain('<subject><![CDATA[Test change]]></subject>')
    expect(output).toContain('<project>test-project</project>')
    expect(output).toContain('<branch>main</branch>')
    expect(output).toContain('<status>NEW</status>')
    expect(output).toContain('</change>')
    expect(output).toContain('</changes>')
  })

  test('should handle no changes gracefully', async () => {
    const mockApi = GerritApiService.of({
      listChanges: () => Effect.succeed([]),
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    await Effect.runPromise(
      mineCommand({ xml: false }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
    )

    // Mine command returns early for empty results, so no output is expected
    expect(mockConsole.logs).toEqual([])
  })

  test('should handle no changes gracefully in XML format', async () => {
    const mockApi = GerritApiService.of({
      listChanges: () => Effect.succeed([]),
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    await Effect.runPromise(
      mineCommand({ xml: true }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
    )

    const output = mockConsole.logs.join('\n')
    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(output).toContain('<changes count="0">')
    expect(output).toContain('</changes>')
  })

  test('should handle network failures gracefully', async () => {
    const mockApi = GerritApiService.of({
      listChanges: () => Effect.fail(new Error('Network error') as ApiError),
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    const result = await Effect.runPromise(
      Effect.either(
        mineCommand({ xml: false }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
      ),
    )

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left.message).toBe('Network error')
    }
  })

  test('should handle network failures gracefully in XML format', async () => {
    const mockApi = GerritApiService.of({
      listChanges: () => Effect.fail(new Error('API error') as ApiError),
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    const result = await Effect.runPromise(
      Effect.either(
        mineCommand({ xml: true }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
      ),
    )

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left.message).toBe('API error')
    }
  })

  test('should properly escape XML special characters', async () => {
    const mockChanges: ChangeInfo[] = [
      generateMockChange({
        _number: 12345,
        subject: 'Test with <special> & "characters"',
        project: 'test-project',
        branch: 'feature/test&update',
        status: 'NEW',
      }),
    ]

    const mockApi = GerritApiService.of({
      listChanges: () => Effect.succeed(mockChanges),
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    await Effect.runPromise(
      mineCommand({ xml: true }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
    )

    const output = mockConsole.logs.join('\n')
    // CDATA sections should preserve special characters
    expect(output).toContain('<![CDATA[Test with <special> & "characters"]]>')
    expect(output).toContain('<branch>feature/test&update</branch>')
  })

  test('should display changes with proper grouping by project', async () => {
    const mockChanges: ChangeInfo[] = [
      generateMockChange({
        _number: 12345,
        subject: 'Change in project A',
        project: 'project-a',
        branch: 'main',
        status: 'NEW',
      }),
      generateMockChange({
        _number: 12346,
        subject: 'Change in project B',
        project: 'project-b',
        branch: 'main',
        status: 'NEW',
      }),
      generateMockChange({
        _number: 12347,
        subject: 'Another change in project A',
        project: 'project-a',
        branch: 'develop',
        status: 'MERGED',
      }),
    ]

    const mockApi = GerritApiService.of({
      listChanges: () => Effect.succeed(mockChanges),
      getChange: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeDiff: () => Effect.fail(new Error('Not implemented') as ApiError),
      getChangeComments: () => Effect.fail(new Error('Not implemented') as ApiError),
      postReview: () => Effect.fail(new Error('Not implemented') as ApiError),
      abandonChange: () => Effect.fail(new Error('Not implemented') as ApiError),
    })

    await Effect.runPromise(
      mineCommand({ xml: false }).pipe(Effect.provide(Layer.succeed(GerritApiService, mockApi))),
    )

    const output = mockConsole.logs.join('\n')
    expect(output).toContain('Change in project A')
    expect(output).toContain('Change in project B')
    expect(output).toContain('Another change in project A')
    expect(output).toContain('project-a')
    expect(output).toContain('project-b')
  })
})
