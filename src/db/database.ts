import { Database } from 'bun:sqlite'
import * as os from 'node:os'
import * as path from 'node:path'
import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import type { ChangeInfo } from '@/schemas/gerrit'
import { generateETag, getCacheTTL, isExpired } from './cache-config'
import {
  CREATE_CACHE_METADATA_TABLE,
  CREATE_CHANGES_TABLE,
  CREATE_COMMENTS_TABLE,
  CREATE_INDEXES,
} from './schema'

export class DatabaseService extends Context.Tag('DatabaseService')<
  DatabaseService,
  {
    readonly db: Database
    readonly getChange: (changeId: string) => Effect.Effect<ChangeInfo | null, DatabaseError>
    readonly saveChange: (change: ChangeInfo, etag?: string) => Effect.Effect<void, DatabaseError>
    readonly searchChanges: (query: {
      status?: string
      project?: string
      limit?: number
    }) => Effect.Effect<ChangeInfo[], DatabaseError>
    readonly clearExpiredCache: Effect.Effect<void, DatabaseError>
    readonly invalidateChange: (changeId: string) => Effect.Effect<void, DatabaseError>
    readonly isChangeStale: (changeId: string) => Effect.Effect<boolean, DatabaseError>
    readonly getCacheMetadata: (key: string) => Effect.Effect<string | null, DatabaseError>
    readonly setCacheMetadata: (
      key: string,
      value: string,
      expiresInSeconds?: number,
    ) => Effect.Effect<void, DatabaseError>
  }
>() {}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()('DatabaseError', {
  message: Schema.String,
}) {}

const initializeDatabase = (db: Database): Effect.Effect<void, DatabaseError> =>
  Effect.try({
    try: () => {
      // Create tables
      db.exec(CREATE_CHANGES_TABLE)
      db.exec(CREATE_COMMENTS_TABLE)
      db.exec(CREATE_CACHE_METADATA_TABLE)

      // Create indexes
      for (const indexSql of CREATE_INDEXES) {
        db.exec(indexSql)
      }

      // Enable foreign key constraints
      db.exec('PRAGMA foreign_keys = ON')

      // Enable WAL mode for better concurrent access
      db.exec('PRAGMA journal_mode = WAL')

      // Optimize for performance
      db.exec('PRAGMA synchronous = NORMAL')
      db.exec('PRAGMA cache_size = 10000')
      db.exec('PRAGMA temp_store = MEMORY')
    },
    catch: () => new DatabaseError({ message: 'Failed to initialize database' }),
  })

interface ChangeRow {
  id: string
  project: string
  branch: string
  change_id: string
  subject: string
  status: 'NEW' | 'MERGED' | 'ABANDONED' | 'DRAFT'
  created: string
  updated: string
  insertions: number
  deletions: number
  number: number
  owner_account_id: number
  owner_name?: string | null
  owner_email?: string | null
  owner_username?: string | null
}

const mapRowToChange = (row: ChangeRow): ChangeInfo => ({
  id: row.id,
  project: row.project,
  branch: row.branch,
  change_id: row.change_id,
  subject: row.subject,
  status: row.status,
  created: row.created,
  updated: row.updated,
  insertions: row.insertions,
  deletions: row.deletions,
  number: row.number,
  owner: {
    _account_id: row.owner_account_id,
    name: row.owner_name || undefined,
    email: row.owner_email || undefined,
    username: row.owner_username || undefined,
  },
})

const isRowExpired = (row: { expires_at?: number | null }): boolean => {
  if (!row.expires_at) return false
  return isExpired(row.expires_at)
}

export const DatabaseServiceLive = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const configDir = path.join(os.homedir(), '.gi')
    const dbPath = path.join(configDir, 'cache.db')

    // Ensure config directory exists
    yield* Effect.tryPromise({
      try: async () => {
        const fs = await import('node:fs/promises')
        await fs.mkdir(configDir, { recursive: true })
      },
      catch: (_error) => new DatabaseError({ message: 'Failed to create config directory' }),
    })

    const db = new Database(dbPath)
    yield* initializeDatabase(db)

    const getChange = (changeId: string) =>
      Effect.try({
        try: () => {
          const query = db.query(`
            SELECT * FROM changes 
            WHERE (change_id = ? OR id = ?)
          `)
          const row = query.get(changeId, changeId)

          if (!row) return null
          if (isRowExpired(row)) {
            // Delete expired entry
            const deleteQuery = db.query('DELETE FROM changes WHERE change_id = ? OR id = ?')
            deleteQuery.run(changeId, changeId)
            return null
          }

          return mapRowToChange(row as unknown as ChangeRow)
        },
        catch: () => new DatabaseError({ message: 'Failed to get change from database' }),
      })

    const saveChange = (change: ChangeInfo, etag?: string) =>
      Effect.try({
        try: () => {
          const ttl = getCacheTTL(change.status)
          const expiresAt = Math.floor(Date.now() / 1000) + ttl
          const generatedETag =
            etag || generateETag(change.change_id, change.updated, change.status)

          const query = db.query(`
            INSERT OR REPLACE INTO changes (
              id, project, branch, change_id, subject, status, created, updated,
              insertions, deletions, number, owner_account_id, owner_name, 
              owner_email, owner_username, expires_at, etag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          query.run(
            change.id,
            change.project,
            change.branch,
            change.change_id,
            change.subject,
            change.status,
            change.created,
            change.updated,
            change.insertions,
            change.deletions,
            change.number,
            change.owner._account_id,
            change.owner.name || null,
            change.owner.email || null,
            change.owner.username || null,
            expiresAt,
            generatedETag,
          )
        },
        catch: () => new DatabaseError({ message: 'Failed to save change to database' }),
      })

    const searchChanges = (query: { status?: string; project?: string; limit?: number }) =>
      Effect.try({
        try: () => {
          let sql = 'SELECT * FROM changes WHERE 1=1'
          const params: (string | number)[] = []

          if (query.status) {
            sql += ' AND status = ?'
            params.push(query.status)
          }

          if (query.project) {
            sql += ' AND project = ?'
            params.push(query.project)
          }

          sql += ' ORDER BY updated DESC'

          if (query.limit) {
            sql += ' LIMIT ?'
            params.push(query.limit)
          }

          const stmt = db.query(sql)
          const rows = stmt.all(...params)
          return rows.map((row) => mapRowToChange(row as unknown as ChangeRow))
        },
        catch: () => new DatabaseError({ message: 'Failed to search changes in database' }),
      })

    const clearExpiredCache = Effect.try({
      try: () => {
        const now = Math.floor(Date.now() / 1000)
        // Clear expired changes using parameterized query
        const clearChangesStmt = db.prepare(
          'DELETE FROM changes WHERE expires_at IS NOT NULL AND expires_at < ?',
        )
        clearChangesStmt.run(now)

        // Clear expired cache metadata using parameterized query
        const clearMetadataStmt = db.prepare(
          'DELETE FROM cache_metadata WHERE expires_at IS NOT NULL AND expires_at < ?',
        )
        clearMetadataStmt.run(now)
      },
      catch: () => new DatabaseError({ message: 'Failed to clear expired cache' }),
    })

    const invalidateChange = (changeId: string) =>
      Effect.try({
        try: () => {
          const query = db.query('DELETE FROM changes WHERE change_id = ? OR id = ?')
          query.run(changeId, changeId)
        },
        catch: () => new DatabaseError({ message: 'Failed to invalidate change' }),
      })

    const isChangeStale = (changeId: string) =>
      Effect.try({
        try: () => {
          const query = db.query(`
            SELECT expires_at FROM changes 
            WHERE (change_id = ? OR id = ?)
          `)
          const row = query.get(changeId, changeId)

          if (!row) return true // Not in cache = stale
          return isRowExpired(row)
        },
        catch: (_error) => new DatabaseError({ message: 'Failed to check if change is stale' }),
      })

    const getCacheMetadata = (key: string): Effect.Effect<string | null, DatabaseError> =>
      Effect.try({
        try: () => {
          const query = db.query(`
            SELECT value, expires_at FROM cache_metadata 
            WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
          `)
          const now = Math.floor(Date.now() / 1000)
          const row = query.get(key, now)
          return row && typeof row === 'object' && 'value' in row
            ? (row.value as unknown as string)
            : null
        },
        catch: () => new DatabaseError({ message: 'Failed to get cache metadata' }),
      })

    const setCacheMetadata = (key: string, value: string, expiresInSeconds?: number) =>
      Effect.try({
        try: () => {
          const expiresAt = expiresInSeconds
            ? Math.floor(Date.now() / 1000) + expiresInSeconds
            : null

          const query = db.query(`
            INSERT OR REPLACE INTO cache_metadata (key, value, expires_at, updated_at)
            VALUES (?, ?, ?, strftime('%s', 'now'))
          `)
          query.run(key, value, expiresAt)
        },
        catch: () => new DatabaseError({ message: 'Failed to set cache metadata' }),
      })

    return {
      db,
      getChange,
      saveChange,
      searchChanges,
      clearExpiredCache,
      invalidateChange,
      isChangeStale,
      getCacheMetadata,
      setCacheMetadata,
    }
  }),
)
