import { Schema } from '@effect/schema'

// Authentication schemas
export const GerritCredentials: Schema.Schema<{
  readonly host: string
  readonly username: string
  readonly password: string
}> = Schema.Struct({
  host: Schema.String.pipe(
    Schema.pattern(/^https?:\/\/.+$/),
    Schema.annotations({ description: 'Gerrit server URL' }),
  ),
  username: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Gerrit username' }),
  ),
  password: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'HTTP password or API token' }),
  ),
})
export type GerritCredentials = Schema.Schema.Type<typeof GerritCredentials>

// Change schemas
export const ChangeInfo: Schema.Schema<{
  readonly id: string
  readonly project: string
  readonly branch: string
  readonly change_id: string
  readonly subject: string
  readonly status: 'NEW' | 'MERGED' | 'ABANDONED' | 'DRAFT'
  readonly created: string
  readonly updated: string
  readonly insertions: number
  readonly deletions: number
  readonly number: number
  readonly owner: {
    readonly _account_id: number
    readonly name?: string
    readonly email?: string
    readonly username?: string
  }
}> = Schema.Struct({
  id: Schema.String,
  project: Schema.String,
  branch: Schema.String,
  change_id: Schema.String,
  subject: Schema.String,
  status: Schema.Literal('NEW', 'MERGED', 'ABANDONED', 'DRAFT'),
  created: Schema.String,
  updated: Schema.String,
  insertions: Schema.Number,
  deletions: Schema.Number,
  number: Schema.Number,
  owner: Schema.Struct({
    _account_id: Schema.Number,
    name: Schema.optional(Schema.String),
    email: Schema.optional(Schema.String),
    username: Schema.optional(Schema.String),
  }),
})
export type ChangeInfo = Schema.Schema.Type<typeof ChangeInfo>

// Comment schemas
export const CommentInput: Schema.Schema<{
  readonly message: string
  readonly unresolved?: boolean
}> = Schema.Struct({
  message: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Comment message' }),
  ),
  unresolved: Schema.optional(Schema.Boolean),
})
export type CommentInput = Schema.Schema.Type<typeof CommentInput>

export const ReviewInput: Schema.Schema<{
  readonly message?: string
  readonly labels?: Record<string, number>
  readonly comments?: Record<
    string,
    ReadonlyArray<{
      readonly line?: number
      readonly message: string
      readonly unresolved?: boolean
    }>
  >
}> = Schema.Struct({
  message: Schema.optional(Schema.String),
  labels: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Number })),
  comments: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Array(
        Schema.Struct({
          line: Schema.optional(Schema.Number),
          message: Schema.String,
          unresolved: Schema.optional(Schema.Boolean),
        }),
      ),
    }),
  ),
})
export type ReviewInput = Schema.Schema.Type<typeof ReviewInput>

// File and diff schemas
export const FileInfo: Schema.Schema<{
  readonly status?: 'A' | 'D' | 'R' | 'C' | 'M'
  readonly lines_inserted?: number
  readonly lines_deleted?: number
  readonly size?: number
  readonly size_delta?: number
  readonly old_path?: string
}> = Schema.Struct({
  status: Schema.optional(Schema.Literal('A', 'D', 'R', 'C', 'M')), // Added, Deleted, Renamed, Copied, Modified
  lines_inserted: Schema.optional(Schema.Number),
  lines_deleted: Schema.optional(Schema.Number),
  size_delta: Schema.optional(Schema.Number),
  size: Schema.optional(Schema.Number),
  old_path: Schema.optional(Schema.String),
})
export type FileInfo = Schema.Schema.Type<typeof FileInfo>

export const FileDiffContent: Schema.Schema<{
  readonly a?: string
  readonly b?: string
  readonly content: ReadonlyArray<{
    readonly a?: ReadonlyArray<string>
    readonly b?: ReadonlyArray<string>
    readonly ab?: ReadonlyArray<string>
    readonly edit_list?: ReadonlyArray<{
      readonly op: 'i' | 'd' | 'r'
      readonly a: ReadonlyArray<string>
      readonly b: ReadonlyArray<string>
    }>
    readonly due_to_rebase?: boolean
    readonly skip?: number
  }>
  readonly change_type?: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED' | 'COPIED'
  readonly diff_header?: ReadonlyArray<string>
}> = Schema.Struct({
  a: Schema.optional(Schema.String), // Old file content path
  b: Schema.optional(Schema.String), // New file content path
  content: Schema.Array(
    Schema.Struct({
      a: Schema.optional(Schema.Array(Schema.String)), // Lines from old file
      b: Schema.optional(Schema.Array(Schema.String)), // Lines from new file
      ab: Schema.optional(Schema.Array(Schema.String)), // Common lines
      edit_list: Schema.optional(
        Schema.Array(
          Schema.Struct({
            op: Schema.Literal('i', 'd', 'r'), // insert, delete, replace
            a: Schema.Array(Schema.String),
            b: Schema.Array(Schema.String),
          }),
        ),
      ),
      due_to_rebase: Schema.optional(Schema.Boolean),
      skip: Schema.optional(Schema.Number),
    }),
  ),
  change_type: Schema.optional(Schema.Literal('ADDED', 'MODIFIED', 'DELETED', 'RENAMED', 'COPIED')),
  diff_header: Schema.optional(Schema.Array(Schema.String)),
})
export type FileDiffContent = Schema.Schema.Type<typeof FileDiffContent>

export const RevisionInfo: Schema.Schema<{
  readonly kind?: string
  readonly _number: number
  readonly created: string
  readonly uploader: {
    readonly _account_id: number
    readonly name?: string
    readonly email?: string
  }
  readonly ref: string
  readonly fetch?: Record<string, unknown>
  readonly commit?: {
    readonly commit: string
    readonly parents: ReadonlyArray<{
      readonly commit: string
      readonly subject: string
    }>
    readonly author: {
      readonly name: string
      readonly email: string
      readonly date: string
    }
    readonly committer: {
      readonly name: string
      readonly email: string
      readonly date: string
    }
    readonly subject: string
    readonly message: string
  }
}> = Schema.Struct({
  kind: Schema.optional(Schema.String),
  _number: Schema.Number,
  created: Schema.String,
  uploader: Schema.Struct({
    _account_id: Schema.Number,
    name: Schema.optional(Schema.String),
    email: Schema.optional(Schema.String),
  }),
  ref: Schema.String,
  fetch: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  commit: Schema.optional(
    Schema.Struct({
      commit: Schema.String,
      parents: Schema.Array(
        Schema.Struct({
          commit: Schema.String,
          subject: Schema.String,
        }),
      ),
      author: Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        date: Schema.String,
      }),
      committer: Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        date: Schema.String,
      }),
      subject: Schema.String,
      message: Schema.String,
    }),
  ),
  files: Schema.optional(Schema.Record({ key: Schema.String, value: FileInfo })),
})
export type RevisionInfo = Schema.Schema.Type<typeof RevisionInfo>

// Diff output format options
export const DiffFormat: Schema.Schema<'unified' | 'json' | 'files'> = Schema.Literal(
  'unified',
  'json',
  'files',
)
export type DiffFormat = Schema.Schema.Type<typeof DiffFormat>

export const DiffOptions: Schema.Schema<{
  readonly format?: 'unified' | 'json' | 'files'
  readonly patchset?: number
  readonly file?: string
  readonly filesOnly?: boolean
  readonly fullFiles?: boolean
  readonly base?: number
  readonly target?: number
}> = Schema.Struct({
  format: Schema.optional(DiffFormat),
  patchset: Schema.optional(Schema.Number),
  file: Schema.optional(Schema.String),
  filesOnly: Schema.optional(Schema.Boolean),
  fullFiles: Schema.optional(Schema.Boolean),
  base: Schema.optional(Schema.Number),
  target: Schema.optional(Schema.Number),
})
export type DiffOptions = Schema.Schema.Type<typeof DiffOptions>

// API Response schemas
export const GerritError: Schema.Schema<{
  readonly message: string
  readonly status?: number
}> = Schema.Struct({
  message: Schema.String,
  status: Schema.optional(Schema.Number),
})
export type GerritError = Schema.Schema.Type<typeof GerritError>
