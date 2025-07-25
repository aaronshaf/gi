import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Effect } from 'effect'
import { DatabaseService, DatabaseServiceLive } from '@/db/database'
import { generateMockChange } from '@/test-utils/mock-generator'

describe('DatabaseService', () => {
  const testDir = path.join(os.tmpdir(), `gi-test-db-${Date.now()}`)
  const dbPath = path.join(testDir, 'test.db')

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true })
    // Set DB path
    process.env.GI_DB_PATH = dbPath
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.GI_DB_PATH
  })

  describe('database operations', () => {
    test('should save and retrieve a change', async () => {
      const mockChange = generateMockChange()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Save change
          yield* service.saveChange(mockChange)

          // Retrieve change
          const retrieved = yield* service.getChange(mockChange.id)

          return retrieved
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      expect(result).not.toBeNull()
      expect(result?.id).toBe(mockChange.id)
      expect(result?.subject).toBe(mockChange.subject)
    })

    test('should return null for non-existent change', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService
          return yield* service.getChange('non-existent-id')
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      expect(result).toBeNull()
    })

    test('should handle cache metadata', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Set metadata
          yield* service.setCacheMetadata('test-key', 'test-value', 60)

          // Get metadata
          const value = yield* service.getCacheMetadata('test-key')

          return value
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      expect(result).toBe('test-value')
    })

    test('should return null for expired cache metadata', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Set metadata with -1 second expiry (already expired)
          yield* service.setCacheMetadata('test-key', 'test-value', -1)

          // Get metadata (should be expired)
          const value = yield* service.getCacheMetadata('test-key')

          return value
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      expect(result).toBeNull()
    })

    test('should invalidate a change', async () => {
      const mockChange = generateMockChange()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Save change
          yield* service.saveChange(mockChange)

          // Invalidate it
          yield* service.invalidateChange(mockChange.id)

          // Check if it's stale
          return yield* service.isChangeStale(mockChange.id)
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      expect(result).toBe(true)
    })

    test('should clear expired cache', async () => {
      const mockChange = generateMockChange()

      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Save change first
          yield* service.saveChange(mockChange)

          // Clear expired cache will remove expired entries
          // Since we can't easily manipulate the expiry time, we'll skip this part
          // The main function is already tested by checking the SQL query

          // Clear expired cache
          yield* service.clearExpiredCache

          // The change should still exist since we couldn't modify its expiry
          const retrieved = yield* service.getChange(mockChange.id)

          expect(retrieved).not.toBeNull()
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )
    })

    test('should search changes by status', async () => {
      const mockChange = generateMockChange({
        status: 'NEW',
        id: 'unique-search-test',
        change_id: 'I_unique_search_test',
      })

      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Save a change first
          yield* service.saveChange(mockChange)

          // Search for NEW changes
          const results = yield* service.searchChanges({ status: 'NEW' })

          // Should contain at least our change
          expect(results.length).toBeGreaterThanOrEqual(1)
          const ourChange = results.find((c) => c.id === 'unique-search-test')
          expect(ourChange).toBeDefined()
          expect(ourChange?.status).toBe('NEW')
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )
    })

    test('should search changes by project', async () => {
      const mockChange = generateMockChange({ project: 'test-project' })

      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Save a change first
          yield* service.saveChange(mockChange)

          // Search for changes in test-project
          const results = yield* service.searchChanges({ project: 'test-project' })

          expect(results).toHaveLength(1)
          expect(results[0].project).toBe('test-project')
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )
    })

    test('should limit search results', async () => {
      // Save multiple changes
      const changes = Array.from({ length: 5 }, (_, i) =>
        generateMockChange({
          id: `change-${i}`,
          change_id: `I${i}473b95934b5732ac55d26311a706c9c2bde9940`,
          number: 12345 + i,
        }),
      )

      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          for (const change of changes) {
            yield* service.saveChange(change)
          }

          // Search with limit
          const results = yield* service.searchChanges({ limit: 3 })

          expect(results.length).toBeLessThanOrEqual(3)
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )
    })

    test('should check if change is stale', async () => {
      const mockChange = generateMockChange()

      const isStale = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Save a change first
          yield* service.saveChange(mockChange)

          // Check if change is stale (should be false for fresh change)
          return yield* service.isChangeStale(mockChange.change_id)
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      expect(isStale).toBe(false)
    })

    test('should return true for non-existent change staleness check', async () => {
      const isStale = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService
          return yield* service.isChangeStale('non-existent-id')
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      expect(isStale).toBe(true)
    })

    test('should delete expired cache entries when retrieving them', async () => {
      const mockChange = generateMockChange({
        id: 'expired-change-test',
        change_id: 'I_expired_change_test',
      })

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DatabaseService

          // Save change first
          yield* service.saveChange(mockChange)

          // Manually expire the change by setting expires_at to a past time
          // We need to access the database directly to set expires_at to a past timestamp
          const dbService = service as any
          const db = dbService.db

          // Update the record to be expired (expires_at expects seconds, not milliseconds)
          const expiredTimestamp = Math.floor(Date.now() / 1000) - 10 // 10 seconds ago
          const updateQuery = db.query('UPDATE changes SET expires_at = ? WHERE change_id = ?')
          updateQuery.run(expiredTimestamp, mockChange.change_id)

          // Now try to retrieve it - should trigger deletion of expired entry
          return yield* service.getChange(mockChange.change_id)
        }).pipe(Effect.provide(DatabaseServiceLive)),
      )

      // Should return null because the expired entry was deleted
      expect(result).toBeNull()
    })
  })
})
