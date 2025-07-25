import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import { DatabaseService } from '@/db/database'
import {
  ChangeInfo,
  type DiffOptions,
  FileDiffContent,
  FileInfo,
  type GerritCredentials,
  type ReviewInput,
  RevisionInfo,
} from '@/schemas/gerrit'
import { ConfigService } from '@/services/config'

export class GerritApiService extends Context.Tag('GerritApiService')<
  GerritApiService,
  {
    readonly getChange: (changeId: string) => Effect.Effect<ChangeInfo, ApiError>
    readonly listChanges: (query?: string) => Effect.Effect<readonly ChangeInfo[], ApiError>
    readonly postReview: (changeId: string, review: ReviewInput) => Effect.Effect<void, ApiError>
    readonly testConnection: Effect.Effect<boolean, ApiError>
    readonly getRevision: (
      changeId: string,
      revisionId?: string,
    ) => Effect.Effect<RevisionInfo, ApiError>
    readonly getFiles: (
      changeId: string,
      revisionId?: string,
    ) => Effect.Effect<Record<string, FileInfo>, ApiError>
    readonly getFileDiff: (
      changeId: string,
      filePath: string,
      revisionId?: string,
      base?: string,
    ) => Effect.Effect<FileDiffContent, ApiError>
    readonly getFileContent: (
      changeId: string,
      filePath: string,
      revisionId?: string,
    ) => Effect.Effect<string, ApiError>
    readonly getPatch: (changeId: string, revisionId?: string) => Effect.Effect<string, ApiError>
    readonly getDiff: (
      changeId: string,
      options?: DiffOptions,
    ) => Effect.Effect<string | string[] | Record<string, unknown> | FileDiffContent, ApiError>
  }
>() {}

export class ApiError extends Schema.TaggedError<ApiError>()('ApiError', {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
}) {}

const createAuthHeader = (credentials: GerritCredentials): string => {
  const auth = btoa(`${credentials.username}:${credentials.password}`)
  return `Basic ${auth}`
}

const makeRequest = <T = unknown>(
  url: string,
  authHeader: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  schema?: Schema.Schema<T>,
): Effect.Effect<T, ApiError> =>
  Effect.gen(function* () {
    const headers: Record<string, string> = {
      Authorization: authHeader,
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          method,
          headers,
          ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
        }),
      catch: () => new ApiError({ message: 'Request failed - network or authentication error' }),
    })

    if (!response.ok) {
      const errorText = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => 'Unknown error',
      }).pipe(Effect.orElseSucceed(() => 'Unknown error'))
      yield* Effect.fail(
        new ApiError({
          message: errorText,
          status: response.status,
        }),
      )
    }

    const text = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => new ApiError({ message: 'Failed to read response data' }),
    })

    // Gerrit returns JSON with )]}' prefix for security
    const cleanJson = text.replace(/^\)\]\}'\n?/, '')

    if (!cleanJson.trim()) {
      return null as unknown as T
    }

    const parsed = yield* Effect.try({
      try: () => JSON.parse(cleanJson),
      catch: () => new ApiError({ message: 'Failed to parse response - invalid JSON format' }),
    })

    if (schema) {
      return yield* Schema.decodeUnknown(schema)(parsed).pipe(
        Effect.mapError(() => new ApiError({ message: 'Invalid response format from server' })),
      )
    }

    return parsed as unknown as T
  })

export const GerritApiServiceLive: Layer.Layer<
  GerritApiService,
  never,
  ConfigService | DatabaseService
> = Layer.effect(
  GerritApiService,
  Effect.gen(function* () {
    const configService = yield* ConfigService
    const databaseService = yield* DatabaseService

    const getCredentialsAndAuth = Effect.gen(function* () {
      const credentials = yield* configService.getCredentials.pipe(
        Effect.mapError(() => new ApiError({ message: 'Failed to get credentials' })),
      )
      const authHeader = createAuthHeader(credentials)
      return { credentials, authHeader }
    })

    const getChange = (changeId: string) =>
      Effect.gen(function* () {
        // First check cache
        const cached = yield* databaseService
          .getChange(changeId)
          .pipe(Effect.catchTag('DatabaseError', () => Effect.succeed(null)))

        if (cached) {
          return cached
        }

        // Fetch from API
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const url = `${credentials.host}/a/changes/${encodeURIComponent(changeId)}`

        const change = yield* makeRequest(url, authHeader, 'GET', undefined, ChangeInfo)

        // Cache the result
        yield* databaseService
          .saveChange(change)
          .pipe(Effect.catchTag('DatabaseError', () => Effect.void))

        return change
      })

    const listChanges = (query = 'is:open') =>
      Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const encodedQuery = encodeURIComponent(query)
        const url = `${credentials.host}/a/changes/?q=${encodedQuery}`

        const changes = yield* makeRequest(
          url,
          authHeader,
          'GET',
          undefined,
          Schema.Array(ChangeInfo),
        )

        // Cache all changes
        for (const change of changes) {
          yield* databaseService
            .saveChange(change)
            .pipe(Effect.catchTag('DatabaseError', () => Effect.void))
        }

        return changes
      })

    const postReview = (changeId: string, review: ReviewInput) =>
      Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const url = `${credentials.host}/a/changes/${encodeURIComponent(changeId)}/revisions/current/review`

        yield* makeRequest(url, authHeader, 'POST', review)

        // Invalidate cache for this change
        yield* databaseService.getChange(changeId).pipe(
          Effect.andThen((cached) => {
            if (cached) {
              // Update the cached change's updated timestamp
              const updatedChange = {
                ...cached,
                updated: new Date().toISOString(),
              }
              return databaseService.saveChange(updatedChange)
            }
            return Effect.void
          }),
          Effect.catchTag('DatabaseError', () => Effect.void),
        )
      })

    const testConnection = Effect.gen(function* () {
      const { credentials, authHeader } = yield* getCredentialsAndAuth
      const url = `${credentials.host}/a/accounts/self`

      yield* makeRequest(url, authHeader)
      return true
    }).pipe(Effect.catchAll(() => Effect.succeed(false)))

    const getRevision = (changeId: string, revisionId = 'current') =>
      Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const url = `${credentials.host}/a/changes/${encodeURIComponent(changeId)}/revisions/${revisionId}`

        return yield* makeRequest(url, authHeader, 'GET', undefined, RevisionInfo)
      })

    const getFiles = (changeId: string, revisionId = 'current') =>
      Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const url = `${credentials.host}/a/changes/${encodeURIComponent(changeId)}/revisions/${revisionId}/files`

        return yield* makeRequest(
          url,
          authHeader,
          'GET',
          undefined,
          Schema.Record({ key: Schema.String, value: FileInfo }),
        )
      })

    const getFileDiff = (
      changeId: string,
      filePath: string,
      revisionId = 'current',
      base?: string,
    ) =>
      Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        let url = `${credentials.host}/a/changes/${encodeURIComponent(changeId)}/revisions/${revisionId}/files/${encodeURIComponent(filePath)}/diff`

        if (base) {
          url += `?base=${encodeURIComponent(base)}`
        }

        return yield* makeRequest(url, authHeader, 'GET', undefined, FileDiffContent)
      })

    const getFileContent = (changeId: string, filePath: string, revisionId = 'current') =>
      Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const url = `${credentials.host}/a/changes/${encodeURIComponent(changeId)}/revisions/${revisionId}/files/${encodeURIComponent(filePath)}/content`

        // These endpoints return base64 directly, not JSON with prefix
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(url, {
              method: 'GET',
              headers: { Authorization: authHeader },
            }),
          catch: () =>
            new ApiError({ message: 'Request failed - network or authentication error' }),
        })

        if (!response.ok) {
          const errorText = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () => 'Unknown error',
          }).pipe(Effect.orElseSucceed(() => 'Unknown error'))

          yield* Effect.fail(
            new ApiError({
              message: errorText,
              status: response.status,
            }),
          )
        }

        const base64Content = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new ApiError({ message: 'Failed to read response data' }),
        })

        // Decode base64 content
        return yield* Effect.try({
          try: () => atob(base64Content),
          catch: () => new ApiError({ message: 'Failed to decode file content' }),
        })
      })

    const getPatch = (changeId: string, revisionId = 'current') =>
      Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const url = `${credentials.host}/a/changes/${encodeURIComponent(changeId)}/revisions/${revisionId}/patch`

        // These endpoints return base64 directly, not JSON with prefix
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(url, {
              method: 'GET',
              headers: { Authorization: authHeader },
            }),
          catch: () =>
            new ApiError({ message: 'Request failed - network or authentication error' }),
        })

        if (!response.ok) {
          const errorText = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () => 'Unknown error',
          }).pipe(Effect.orElseSucceed(() => 'Unknown error'))

          yield* Effect.fail(
            new ApiError({
              message: errorText,
              status: response.status,
            }),
          )
        }

        const base64Patch = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new ApiError({ message: 'Failed to read response data' }),
        })

        // Decode base64 patch
        return yield* Effect.try({
          try: () => atob(base64Patch),
          catch: () => new ApiError({ message: 'Failed to decode patch data' }),
        })
      })

    const getDiff = (changeId: string, options: DiffOptions = {}) =>
      Effect.gen(function* () {
        const format = options.format || 'unified'
        const revisionId = options.patchset ? `${options.patchset}` : 'current'

        if (format === 'files') {
          const files = yield* getFiles(changeId, revisionId)
          return Object.keys(files)
        }

        if (options.file) {
          if (format === 'json') {
            const diff = yield* getFileDiff(
              changeId,
              options.file,
              revisionId,
              options.base ? `${options.base}` : undefined,
            )
            return diff
          } else {
            // Return unified diff for single file (we'll need to convert JSON diff to unified format)
            const diff = yield* getFileDiff(
              changeId,
              options.file,
              revisionId,
              options.base ? `${options.base}` : undefined,
            )
            return convertToUnifiedDiff(diff, options.file)
          }
        }

        if (options.fullFiles) {
          const files = yield* getFiles(changeId, revisionId)
          const result: Record<string, string> = {}

          for (const [filePath, _fileInfo] of Object.entries(files)) {
            if (filePath === '/COMMIT_MSG' || filePath === '/MERGE_LIST') continue

            const content = yield* getFileContent(changeId, filePath, revisionId).pipe(
              Effect.catchAll(() => Effect.succeed('Binary file or permission denied')),
            )
            result[filePath] = content
          }

          return format === 'json'
            ? result
            : Object.entries(result)
                .map(([path, content]) => `=== ${path} ===\n${content}\n`)
                .join('\n')
        }

        if (format === 'json') {
          const files = yield* getFiles(changeId, revisionId)
          return files
        }

        // Default: return unified patch
        return yield* getPatch(changeId, revisionId)
      })

    // Helper function to convert JSON diff to unified diff format
    const convertToUnifiedDiff = (diff: FileDiffContent, filePath: string): string => {
      const lines: string[] = []

      if (diff.diff_header) {
        lines.push(...diff.diff_header)
      } else {
        lines.push(`--- a/${filePath}`)
        lines.push(`+++ b/${filePath}`)
      }

      let _oldLineNum = 1
      let _newLineNum = 1

      for (const section of diff.content) {
        if (section.ab) {
          // Common lines
          for (const line of section.ab) {
            lines.push(` ${line}`)
            _oldLineNum++
            _newLineNum++
          }
        }

        if (section.a) {
          // Deleted lines
          for (const line of section.a) {
            lines.push(`-${line}`)
            _oldLineNum++
          }
        }

        if (section.b) {
          // Added lines
          for (const line of section.b) {
            lines.push(`+${line}`)
            _newLineNum++
          }
        }

        if (section.skip) {
          _oldLineNum += section.skip
          _newLineNum += section.skip
        }
      }

      return lines.join('\n')
    }

    return {
      getChange,
      listChanges,
      postReview,
      testConnection,
      getRevision,
      getFiles,
      getFileDiff,
      getFileContent,
      getPatch,
      getDiff,
    }
  }),
)
