import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { Layer } from 'effect'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { openCommand } from '@/cli/commands/open'
import { ConfigService } from '@/services/config'

// Mock child_process.exec
const mockExec = mock()
mock.module('node:child_process', () => ({
  exec: mockExec,
}))

const server = setupServer()

beforeAll(() => {
  server.listen()
})

beforeEach(() => {
  mockExec.mockClear()
})

afterAll(() => {
  server.close()
})

describe('open command', () => {
  test('should open change URL in browser', async () => {
    // Mock the exec function to simulate successful browser opening
    mockExec.mockImplementation((cmd: string, callback: (error: null) => void) => {
      expect(cmd).toMatch(
        /^(open|start|xdg-open) "https:\/\/gerrit\.example\.com\/c\/test-project\/\+\/12345"$/,
      )
      callback(null)
    })

    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.text(
          `)]}'\n${JSON.stringify({
            id: 'test-project~main~I1234567890abcdef',
            project: 'test-project',
            branch: 'main',
            change_id: 'I1234567890abcdef',
            subject: 'Test change',
            status: 'NEW',
            _number: 12345,
            owner: {
              _account_id: 1000000,
              name: 'Test User',
              email: 'test@example.com',
            },
          })}`,
        )
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

    const consoleSpy = mock(() => {})
    const originalLog = console.log
    console.log = consoleSpy

    const program = openCommand('12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    console.log = originalLog

    expect(mockExec).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Opened: https://gerrit.example.com/c/test-project/+/12345',
    )
  })

  test('should handle URLs and extract change number', async () => {
    mockExec.mockImplementation((cmd: string, callback: (error: null) => void) => {
      expect(cmd).toMatch(
        /^(open|start|xdg-open) "https:\/\/gerrit\.example\.com\/c\/test-project\/\+\/12345"$/,
      )
      callback(null)
    })

    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.text(
          `)]}'\n${JSON.stringify({
            id: 'test-project~main~I1234567890abcdef',
            project: 'test-project',
            branch: 'main',
            change_id: 'I1234567890abcdef',
            subject: 'Test change',
            status: 'NEW',
            _number: 12345,
            owner: {
              _account_id: 1000000,
              name: 'Test User',
            },
          })}`,
        )
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

    const consoleSpy = mock(() => {})
    const originalLog = console.log
    console.log = consoleSpy

    // Test with a full Gerrit URL
    const program = openCommand('https://gerrit.example.com/c/test-project/+/12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    console.log = originalLog

    expect(mockExec).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Opened: https://gerrit.example.com/c/test-project/+/12345',
    )
  })

  test('should handle invalid change ID', async () => {
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

    // Use an empty string which is truly invalid according to isValidChangeId
    const program = openCommand('').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow('Invalid change ID: ')
  })

  test('should handle API errors gracefully', async () => {
    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.json({ error: 'Change not found' }, { status: 404 })
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

    const program = openCommand('12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  test('should handle browser opening errors', async () => {
    mockExec.mockImplementation((cmd: string, callback: (error: Error) => void) => {
      callback(new Error('Browser not found'))
    })

    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.text(
          `)]}'\n${JSON.stringify({
            id: 'test-project~main~I1234567890abcdef',
            project: 'test-project',
            branch: 'main',
            change_id: 'I1234567890abcdef',
            subject: 'Test change',
            status: 'NEW',
            _number: 12345,
            owner: {
              _account_id: 1000000,
              name: 'Test User',
            },
          })}`,
        )
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

    const program = openCommand('12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow(
      'Failed to open URL: Browser not found',
    )
  })
})
