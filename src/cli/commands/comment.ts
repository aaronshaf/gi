import { Schema, ParseResult, TreeFormatter } from '@effect/schema'
import { Effect, pipe } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import type { ChangeInfo, ReviewInput } from '@/schemas/gerrit'

interface CommentOptions {
  message?: string
  xml?: boolean
  file?: string
  line?: number
  unresolved?: boolean
  batch?: boolean
}

// Schema for batch input validation - array of comments
const BatchCommentSchema = Schema.Array(
  Schema.Struct({
    file: Schema.String,
    line: Schema.optional(Schema.Number), // Optional when using range
    range: Schema.optional(
      Schema.Struct({
        start_line: Schema.Number,
        end_line: Schema.Number,
        start_character: Schema.optional(Schema.Number),
        end_character: Schema.optional(Schema.Number),
      }),
    ),
    message: Schema.String,
    path: Schema.optional(Schema.String), // Support both 'file' and 'path' for flexibility
    side: Schema.optional(Schema.Literal('PARENT', 'REVISION')),
    unresolved: Schema.optional(Schema.Boolean),
  }),
)

type BatchCommentInput = Schema.Schema.Type<typeof BatchCommentSchema>

// Effect-ified stdin reader
const readStdin = Effect.async<string, Error>((callback) => {
  let data = ''

  const onData = (chunk: Buffer | string) => {
    data += chunk
  }
  const onEnd = () => callback(Effect.succeed(data))
  const onError = (error: Error) =>
    callback(Effect.fail(new Error(`Failed to read stdin: ${error.message}`)))

  process.stdin.on('data', onData)
  process.stdin.on('end', onEnd)
  process.stdin.on('error', onError)

  // Cleanup function
  return Effect.sync(() => {
    process.stdin.removeListener('data', onData)
    process.stdin.removeListener('end', onEnd)
    process.stdin.removeListener('error', onError)
  })
})

// Helper to parse JSON with better error handling
const parseJson = (data: string): Effect.Effect<unknown, Error> =>
  Effect.try({
    try: () => JSON.parse(data),
    catch: (error) =>
      new Error(`Invalid JSON input: ${error instanceof Error ? error.message : 'parse error'}`),
  })

// Helper to build ReviewInput from batch data
const buildBatchReview = (batchInput: BatchCommentInput): ReviewInput => {
  const commentsByFile = batchInput.reduce<
    Record<
      string,
      Array<{
        line?: number
        range?: {
          start_line: number
          end_line: number
          start_character?: number
          end_character?: number
        }
        message: string
        side?: 'PARENT' | 'REVISION'
        unresolved?: boolean
      }>
    >
  >((acc, comment) => {
    // Support both 'file' and 'path' properties
    const filePath = comment.file || comment.path || ''
    if (filePath && !acc[filePath]) {
      acc[filePath] = []
    }
    if (filePath) {
      acc[filePath].push({
        line: comment.line,
        range: comment.range,
        message: comment.message,
        side: comment.side,
        unresolved: comment.unresolved,
      })
    }
    return acc
  }, {})

  return {
    comments: commentsByFile,
  }
}

// Create ReviewInput based on options
const createReviewInput = (options: CommentOptions): Effect.Effect<ReviewInput, Error> => {
  // Batch mode
  if (options.batch) {
    return pipe(
      readStdin,
      Effect.flatMap(parseJson),
      Effect.flatMap(
        Schema.decodeUnknown(BatchCommentSchema, {
          errors: 'all',
          onExcessProperty: 'ignore',
        }),
      ),
      Effect.mapError((error) => {
        // Extract the actual schema validation errors
        let errorMessage = 'Invalid batch input format.\n'

        if (ParseResult.isParseError(error)) {
          // Format the parse error with details
          errorMessage += TreeFormatter.formatErrorSync(error)
          errorMessage += '\n\nExpected format: [{"file": "...", "line": ..., "message": "..."}]'
        } else if (error instanceof Error) {
          errorMessage += error.message
        } else {
          errorMessage +=
            'Expected: [{"file": "...", "line": ..., "message": "...", "side"?: "PARENT|REVISION", "range"?: {...}}]'
        }

        return new Error(errorMessage)
      }),
      Effect.map(buildBatchReview),
    )
  }

  // Line comment mode
  if (options.file && options.line) {
    return options.message
      ? Effect.succeed({
          comments: {
            [options.file]: [
              {
                line: options.line,
                message: options.message,
                unresolved: options.unresolved,
              },
            ],
          },
        })
      : Effect.fail(new Error('Message is required for line comments. Use -m "your message"'))
  }

  // Overall comment mode
  if (options.message) {
    return Effect.succeed({ message: options.message })
  }

  // If no message provided, read from stdin (for piping support)
  return pipe(
    readStdin,
    Effect.map((stdinContent) => stdinContent.trim()),
    Effect.flatMap((message) =>
      message.length > 0
        ? Effect.succeed({ message })
        : Effect.fail(
            new Error('Message is required. Use -m "your message" or pipe content to stdin'),
          ),
    ),
  )
}

export const commentCommand = (
  changeId: string,
  options: CommentOptions,
): Effect.Effect<void, ApiError | Error, GerritApiService> =>
  Effect.gen(function* () {
    const apiService = yield* GerritApiService

    // Build the review input
    const review = yield* createReviewInput(options)

    // Execute the API calls in sequence
    const change = yield* pipe(
      apiService.getChange(changeId),
      Effect.mapError((error) =>
        error._tag === 'ApiError' ? new Error(`Failed to get change: ${error.message}`) : error,
      ),
    )

    yield* pipe(
      apiService.postReview(changeId, review),
      Effect.mapError((error) =>
        error._tag === 'ApiError' ? new Error(`Failed to post comment: ${error.message}`) : error,
      ),
    )

    // Format and display output
    yield* formatOutput(change, review, options, changeId)
  })

// Helper to format XML output
const formatXmlOutput = (
  change: ChangeInfo,
  review: ReviewInput,
  options: CommentOptions,
  changeId: string,
): Effect.Effect<void> =>
  Effect.sync(() => {
    const lines: string[] = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<comment_result>`,
      `  <status>success</status>`,
      `  <change_id>${changeId}</change_id>`,
      `  <change_number>${change._number}</change_number>`,
      `  <change_subject><![CDATA[${change.subject}]]></change_subject>`,
      `  <change_status>${change.status}</change_status>`,
    ]

    if (options.batch && review.comments) {
      lines.push(`  <comments>`)
      for (const [file, comments] of Object.entries(review.comments)) {
        for (const comment of comments) {
          lines.push(`    <comment>`)
          lines.push(`      <file>${file}</file>`)
          if (comment.line) lines.push(`      <line>${comment.line}</line>`)
          lines.push(`      <message><![CDATA[${comment.message}]]></message>`)
          if (comment.unresolved) lines.push(`      <unresolved>true</unresolved>`)
          lines.push(`    </comment>`)
        }
      }
      lines.push(`  </comments>`)
    } else if (options.file && options.line) {
      lines.push(`  <comment>`)
      lines.push(`    <file>${options.file}</file>`)
      lines.push(`    <line>${options.line}</line>`)
      lines.push(`    <message><![CDATA[${options.message}]]></message>`)
      if (options.unresolved) lines.push(`    <unresolved>true</unresolved>`)
      lines.push(`  </comment>`)
    } else {
      lines.push(`  <message><![CDATA[${options.message}]]></message>`)
    }

    lines.push(`</comment_result>`)
    for (const line of lines) {
      console.log(line)
    }
  })

// Helper to format human-readable output
const formatHumanOutput = (
  change: ChangeInfo,
  review: ReviewInput,
  options: CommentOptions,
): Effect.Effect<void> =>
  Effect.sync(() => {
    console.log(`✓ Comment posted successfully!`)
    console.log(`Change: ${change.subject} (${change.status})`)

    if (options.batch && review.comments) {
      const totalComments = Object.values(review.comments).reduce(
        (sum, comments) => sum + comments.length,
        0,
      )
      console.log(`Posted ${totalComments} line comment(s)`)
    } else if (options.file && options.line) {
      console.log(`File: ${options.file}, Line: ${options.line}`)
      console.log(`Message: ${options.message}`)
      if (options.unresolved) console.log(`Status: Unresolved`)
    } else {
      console.log(`Message: ${review.message}`)
    }
  })

// Main output formatter
const formatOutput = (
  change: ChangeInfo,
  review: ReviewInput,
  options: CommentOptions,
  changeId: string,
): Effect.Effect<void> =>
  options.xml
    ? formatXmlOutput(change, review, options, changeId)
    : formatHumanOutput(change, review, options)
