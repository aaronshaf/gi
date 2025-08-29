import { Effect, pipe, Schema } from 'effect'
import { AiService } from '@/services/ai'
import { commentCommandWithInput } from './comment'
import { Console } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import type { CommentInfo } from '@/schemas/gerrit'
import { sanitizeCDATA, escapeXML } from '@/utils/shell-safety'
import { formatDiffPretty } from '@/utils/diff-formatters'
import { formatDate } from '@/utils/formatters'
import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import * as readline from 'node:readline'

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Effect-based file reading helper
const readFileEffect = (filePath: string): Effect.Effect<string, Error, never> =>
  Effect.tryPromise({
    try: () => fs.readFile(filePath, 'utf8'),
    catch: (error) => new Error(`Failed to read file ${filePath}: ${error}`),
  })

// Load default prompts from .md files using Effect
const loadDefaultPrompts = Effect.gen(function* () {
  const defaultReviewPrompt = yield* readFileEffect(
    path.join(__dirname, '../../prompts/default-review.md'),
  )
  const inlineReviewSystemPrompt = yield* readFileEffect(
    path.join(__dirname, '../../prompts/system-inline-review.md'),
  )
  const overallReviewSystemPrompt = yield* readFileEffect(
    path.join(__dirname, '../../prompts/system-overall-review.md'),
  )

  return {
    defaultReviewPrompt,
    inlineReviewSystemPrompt,
    overallReviewSystemPrompt,
  }
})

// Helper to expand tilde in file paths
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return filePath
}

// Helper to read prompt file using Effect
const readPromptFileEffect = (filePath: string): Effect.Effect<string | null, never, never> =>
  Effect.gen(function* () {
    const expanded = expandTilde(filePath)

    // Check if file exists using sync method since Effect doesn't have a convenient async exists check
    const exists = yield* Effect.try(() => fsSync.existsSync(expanded)).pipe(
      Effect.catchAll(() => Effect.succeed(false)),
    )

    if (!exists) {
      return null
    }

    // Read file using async Effect
    const content = yield* readFileEffect(expanded).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )

    return content
  })

interface ReviewOptions {
  debug?: boolean
  dryRun?: boolean
  comment?: boolean
  yes?: boolean
  prompt?: string
}

// Schema for validating AI-generated inline comments
const InlineCommentSchema = Schema.Struct({
  file: Schema.String,
  message: Schema.String,
  side: Schema.optional(Schema.String),
  line: Schema.optional(Schema.Number),
  range: Schema.optional(
    Schema.Struct({
      start_line: Schema.Number,
      end_line: Schema.Number,
      start_character: Schema.optional(Schema.Number),
      end_character: Schema.optional(Schema.Number),
    }),
  ),
})

interface InlineComment extends Schema.Schema.Type<typeof InlineCommentSchema> {}

// Helper to validate and fix AI-generated inline comments
const validateAndFixInlineComments = (
  rawComments: unknown[],
  availableFiles: string[],
): Effect.Effect<InlineComment[], never, never> =>
  Effect.gen(function* () {
    const validComments: InlineComment[] = []

    for (const rawComment of rawComments) {
      // Validate comment structure using Effect Schema
      const parseResult = yield* Schema.decodeUnknown(InlineCommentSchema)(rawComment).pipe(
        Effect.catchTag('ParseError', (parseError) =>
          Effect.gen(function* () {
            yield* Console.warn('Skipping comment with invalid structure')
            return yield* Effect.succeed(null)
          }),
        ),
      )

      if (!parseResult) {
        continue
      }

      const comment = parseResult

      // Skip comments with invalid line formats (like ":range")
      if (!comment.line && !comment.range) {
        yield* Console.warn('Skipping comment with invalid line format')
        continue
      }

      // Try to find the correct file path
      let correctFilePath = comment.file

      // If the file path doesn't exist exactly, try to find a match
      if (!availableFiles.includes(comment.file)) {
        // Look for files that end with the provided path (secure path matching)
        const matchingFiles = availableFiles.filter((file) => {
          const normalizedFile = file.replace(/\\/g, '/')
          const normalizedComment = comment.file.replace(/\\/g, '/')

          // Only match if the comment path is a suffix of the file path with proper boundaries
          return (
            normalizedFile.endsWith(normalizedComment) &&
            (normalizedFile === normalizedComment ||
              normalizedFile.endsWith(`/${normalizedComment}`))
          )
        })

        if (matchingFiles.length === 1) {
          correctFilePath = matchingFiles[0]
          yield* Console.log(`Fixed file path: ${comment.file} -> ${correctFilePath}`)
        } else if (matchingFiles.length > 1) {
          // Multiple matches, try to pick the most likely one (exact suffix match)
          const exactMatch = matchingFiles.find((file) => file.endsWith(`/${comment.file}`))
          if (exactMatch) {
            correctFilePath = exactMatch
            yield* Console.log(
              `Fixed file path (exact match): ${comment.file} -> ${correctFilePath}`,
            )
          } else {
            yield* Console.warn(`Multiple file matches for ${comment.file}. Skipping comment.`)
            continue
          }
        } else {
          yield* Console.warn(`File not found in change: ${comment.file}. Skipping comment.`)
          continue
        }
      }

      // Update the comment with the correct file path and add to valid comments
      validComments.push({ ...comment, file: correctFilePath })
    }

    return validComments
  })

// Helper to get change data and format as XML string
const getChangeDataAsXml = (changeId: string): Effect.Effect<string, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService

    // Fetch all data
    const change = yield* gerritApi.getChange(changeId)
    const diffResult = yield* gerritApi.getDiff(changeId)
    const diff = typeof diffResult === 'string' ? diffResult : JSON.stringify(diffResult)
    const commentsMap = yield* gerritApi.getComments(changeId)
    const messages = yield* gerritApi.getMessages(changeId)

    // Flatten comments from all files
    const comments: CommentInfo[] = []
    for (const [path, fileComments] of Object.entries(commentsMap)) {
      for (const comment of fileComments) {
        comments.push({ ...comment, path })
      }
    }

    // Build XML string
    const xmlLines: string[] = []
    xmlLines.push(`<?xml version="1.0" encoding="UTF-8"?>`)
    xmlLines.push(`<show_result>`)
    xmlLines.push(`  <status>success</status>`)
    xmlLines.push(`  <change>`)
    xmlLines.push(`    <id>${escapeXML(change.change_id)}</id>`)
    xmlLines.push(`    <number>${change._number}</number>`)
    xmlLines.push(`    <subject><![CDATA[${sanitizeCDATA(change.subject)}]]></subject>`)
    xmlLines.push(`    <status>${escapeXML(change.status)}</status>`)
    xmlLines.push(`    <project>${escapeXML(change.project)}</project>`)
    xmlLines.push(`    <branch>${escapeXML(change.branch)}</branch>`)
    xmlLines.push(`    <owner>`)
    if (change.owner?.name) {
      xmlLines.push(`      <name><![CDATA[${sanitizeCDATA(change.owner.name)}]]></name>`)
    }
    if (change.owner?.email) {
      xmlLines.push(`      <email>${escapeXML(change.owner.email)}</email>`)
    }
    xmlLines.push(`    </owner>`)
    xmlLines.push(`    <created>${escapeXML(change.created || '')}</created>`)
    xmlLines.push(`    <updated>${escapeXML(change.updated || '')}</updated>`)
    xmlLines.push(`  </change>`)
    xmlLines.push(`  <diff><![CDATA[${sanitizeCDATA(diff)}]]></diff>`)

    // Comments section
    xmlLines.push(`  <comments>`)
    xmlLines.push(`    <count>${comments.length}</count>`)
    for (const comment of comments) {
      xmlLines.push(`    <comment>`)
      if (comment.id) xmlLines.push(`      <id>${escapeXML(comment.id)}</id>`)
      if (comment.path)
        xmlLines.push(`      <path><![CDATA[${sanitizeCDATA(comment.path)}]]></path>`)
      if (comment.line) xmlLines.push(`      <line>${comment.line}</line>`)
      if (comment.author?.name) {
        xmlLines.push(`      <author><![CDATA[${sanitizeCDATA(comment.author.name)}]]></author>`)
      }
      if (comment.updated) xmlLines.push(`      <updated>${escapeXML(comment.updated)}</updated>`)
      if (comment.message) {
        xmlLines.push(`      <message><![CDATA[${sanitizeCDATA(comment.message)}]]></message>`)
      }
      if (comment.unresolved) xmlLines.push(`      <unresolved>true</unresolved>`)
      xmlLines.push(`    </comment>`)
    }
    xmlLines.push(`  </comments>`)

    // Messages section
    xmlLines.push(`  <messages>`)
    xmlLines.push(`    <count>${messages.length}</count>`)
    for (const message of messages) {
      xmlLines.push(`    <message>`)
      xmlLines.push(`      <id>${escapeXML(message.id)}</id>`)
      if (message.author?.name) {
        xmlLines.push(`      <author><![CDATA[${sanitizeCDATA(message.author.name)}]]></author>`)
      }
      if (message.author?._account_id) {
        xmlLines.push(`      <author_id>${message.author._account_id}</author_id>`)
      }
      xmlLines.push(`      <date>${escapeXML(message.date)}</date>`)
      if (message._revision_number) {
        xmlLines.push(`      <revision>${message._revision_number}</revision>`)
      }
      if (message.tag) {
        xmlLines.push(`      <tag>${escapeXML(message.tag)}</tag>`)
      }
      xmlLines.push(`      <message><![CDATA[${sanitizeCDATA(message.message)}]]></message>`)
      xmlLines.push(`    </message>`)
    }
    xmlLines.push(`  </messages>`)
    xmlLines.push(`</show_result>`)

    return xmlLines.join('\n')
  })

// Helper to get change data and format as pretty string
const getChangeDataAsPretty = (
  changeId: string,
): Effect.Effect<string, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService

    // Fetch all data
    const change = yield* gerritApi.getChange(changeId)
    const diffResult = yield* gerritApi.getDiff(changeId)
    const diff = typeof diffResult === 'string' ? diffResult : JSON.stringify(diffResult)
    const commentsMap = yield* gerritApi.getComments(changeId)
    const messages = yield* gerritApi.getMessages(changeId)

    // Flatten comments from all files
    const comments: CommentInfo[] = []
    for (const [path, fileComments] of Object.entries(commentsMap)) {
      for (const comment of fileComments) {
        comments.push({ ...comment, path })
      }
    }

    // Build pretty string
    const lines: string[] = []

    // Change details header
    lines.push('━'.repeat(80))
    lines.push(`📋 Change ${change._number}: ${change.subject}`)
    lines.push('━'.repeat(80))
    lines.push('')

    // Metadata
    lines.push('📝 Details:')
    lines.push(`   Project: ${change.project}`)
    lines.push(`   Branch: ${change.branch}`)
    lines.push(`   Status: ${change.status}`)
    lines.push(`   Owner: ${change.owner?.name || change.owner?.email || 'Unknown'}`)
    lines.push(`   Created: ${change.created ? formatDate(change.created) : 'Unknown'}`)
    lines.push(`   Updated: ${change.updated ? formatDate(change.updated) : 'Unknown'}`)
    lines.push(`   Change-Id: ${change.change_id}`)
    lines.push('')

    // Diff section
    lines.push('🔍 Diff:')
    lines.push('─'.repeat(40))
    lines.push(formatDiffPretty(diff))
    lines.push('')

    // Comments section
    if (comments.length > 0) {
      lines.push('💬 Inline Comments:')
      lines.push('─'.repeat(40))
      for (const comment of comments) {
        const author = comment.author?.name || 'Unknown'
        const date = comment.updated ? formatDate(comment.updated) : 'Unknown'
        lines.push(`📅 ${date} - ${author}`)
        if (comment.path) lines.push(`   File: ${comment.path}`)
        if (comment.line) lines.push(`   Line: ${comment.line}`)
        lines.push(`   ${comment.message}`)
        if (comment.unresolved) lines.push(`   ⚠️ Unresolved`)
        lines.push('')
      }
    }

    // Messages section
    if (messages.length > 0) {
      lines.push('📝 Review Activity:')
      lines.push('─'.repeat(40))
      for (const message of messages) {
        const author = message.author?.name || 'Unknown'
        const date = formatDate(message.date)
        const cleanMessage = message.message.trim()

        // Skip very short automated messages
        if (
          cleanMessage.length < 10 &&
          (cleanMessage.includes('Build') || cleanMessage.includes('Patch'))
        ) {
          continue
        }

        lines.push(`📅 ${date} - ${author}`)
        lines.push(`   ${cleanMessage}`)
        lines.push('')
      }
    }

    return lines.join('\n')
  })

// Helper function to prompt user for confirmation
const promptUser = (message: string): Effect.Effect<boolean, never> =>
  Effect.async<boolean, never>((resume) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(`${message} [y/N]: `, (answer: string) => {
      rl.close()
      resume(Effect.succeed(answer.toLowerCase() === 'y'))
    })
  })

export const reviewCommand = (changeId: string, options: ReviewOptions = {}) =>
  Effect.gen(function* () {
    const aiService = yield* AiService

    // Load default prompts first
    const prompts = yield* loadDefaultPrompts

    // Check for AI tool availability first
    yield* Console.log('→ Checking for AI tool availability...')
    const aiTool = yield* aiService
      .detectAiTool()
      .pipe(Effect.catchTag('NoAiToolFoundError', (error) => Effect.fail(new Error(error.message))))
    yield* Console.log(`✓ Found AI tool: ${aiTool}`)

    // Load custom review prompt if provided via --prompt option
    let userReviewPrompt = prompts.defaultReviewPrompt

    if (options.prompt) {
      const customPrompt = yield* readPromptFileEffect(options.prompt)
      if (customPrompt) {
        userReviewPrompt = customPrompt
        yield* Console.log(`✓ Using custom review prompt from ${options.prompt}`)
      } else {
        yield* Console.log(`⚠ Could not read custom prompt file: ${options.prompt}`)
        yield* Console.log('→ Using default review prompt')
      }
    }

    // Combine user prompt with system prompts for each stage
    const inlinePrompt = `${userReviewPrompt}\n\n${prompts.inlineReviewSystemPrompt}`
    const overallPrompt = `${userReviewPrompt}\n\n${prompts.overallReviewSystemPrompt}`

    yield* Console.log(`→ Fetching change data for ${changeId}...`)

    // Stage 1: Generate inline comments
    yield* Console.log(`→ Generating inline comments for change ${changeId}...`)

    // Get change data in XML format for inline review
    const xmlData = yield* getChangeDataAsXml(changeId)

    if (options.debug) {
      yield* Console.log('[DEBUG] Running AI for inline comments...')
    }

    // Run inline review
    const inlineResponse = yield* aiService.runPrompt(inlinePrompt, xmlData).pipe(
      Effect.catchTag('AiResponseParseError', (error) =>
        Effect.gen(function* () {
          if (options.debug) {
            yield* Console.error(`[DEBUG] AI output:\n${error.rawOutput}`)
          }
          return yield* Effect.fail(error)
        }),
      ),
      Effect.catchTag('AiServiceError', (error) =>
        Effect.die(new Error(`AI service error: ${error.message}`)),
      ),
    )

    if (options.debug) {
      yield* Console.log(`[DEBUG] Inline response:\n${inlineResponse}`)
    }

    // Parse JSON array from response using Effect
    const inlineCommentsArray = yield* Effect.tryPromise({
      try: () => Promise.resolve(JSON.parse(inlineResponse)),
      catch: (error) => new Error(`Invalid JSON response: ${error}`),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(`✗ Failed to parse inline comments JSON: ${error}`)
          if (!options.debug) {
            yield* Console.error('Run with --debug to see raw AI output')
          }
          return yield* Effect.fail(error)
        }),
      ),
    )

    // Validate that the response is an array
    if (!Array.isArray(inlineCommentsArray)) {
      yield* Console.error('✗ AI response is not an array of comments')
      return yield* Effect.fail(new Error('Invalid inline comments format'))
    }

    // Get available files for validation
    const gerritApi = yield* GerritApiService
    const files = yield* gerritApi.getFiles(changeId)
    const availableFiles = Object.keys(files)

    // Validate and fix inline comments
    const originalCount = inlineCommentsArray.length
    const inlineComments = yield* validateAndFixInlineComments(inlineCommentsArray, availableFiles)
    const validCount = inlineComments.length

    if (originalCount > validCount) {
      yield* Console.log(
        `→ Filtered ${originalCount - validCount} invalid comments, ${validCount} remain`,
      )
    }

    // If not in comment mode, just output the inline comments
    if (!options.comment) {
      if (inlineComments.length > 0) {
        yield* Console.log('\n━━━━━━ INLINE COMMENTS ━━━━━━')
        for (const comment of inlineComments) {
          yield* Console.log(`\n📍 ${comment.file}${comment.line ? `:${comment.line}` : ''}`)
          yield* Console.log(comment.message)
        }
      } else {
        yield* Console.log('\n→ No inline comments')
      }
    } else {
      // In comment mode, handle posting
      if (inlineComments.length > 0) {
        yield* Console.log('\n━━━━━━ INLINE COMMENTS TO POST ━━━━━━')
        for (const comment of inlineComments) {
          yield* Console.log(`\n📍 ${comment.file}${comment.line ? `:${comment.line}` : ''}`)
          yield* Console.log(comment.message)
        }
        yield* Console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        // Ask for confirmation unless --yes is provided
        const shouldPost = options.yes
          ? true
          : yield* promptUser('\nPost these inline comments to Gerrit?')

        if (shouldPost) {
          if (inlineComments.length === 0) {
            yield* Console.log('→ No valid comments to post after validation')
          } else {
            // Post inline comments using the new direct input method
            yield* pipe(
              commentCommandWithInput(changeId, JSON.stringify(inlineComments), { batch: true }),
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  yield* Console.error(`✗ Failed to post inline comments: ${error}`)
                  return yield* Effect.fail(error)
                }),
              ),
            )
            yield* Console.log(`✓ Inline comments posted for ${changeId}`)
          }
        } else {
          yield* Console.log('→ Inline comments not posted')
        }
      } else {
        yield* Console.log('\n→ No valid inline comments to post')
      }
    }

    // Stage 2: Generate overall review comment
    yield* Console.log(`→ Generating overall review comment for change ${changeId}...`)

    // Get change data in regular format for overall review
    const prettyData = yield* getChangeDataAsPretty(changeId)

    if (options.debug) {
      yield* Console.log('[DEBUG] Running AI for overall review...')
    }

    // Run overall review
    const overallResponse = yield* aiService.runPrompt(overallPrompt, prettyData).pipe(
      Effect.catchTag('AiResponseParseError', (error) =>
        Effect.gen(function* () {
          if (options.debug) {
            yield* Console.error(`[DEBUG] AI output:\n${error.rawOutput}`)
          }
          return yield* Effect.fail(error)
        }),
      ),
      Effect.catchTag('AiServiceError', (error) =>
        Effect.die(new Error(`AI service error: ${error.message}`)),
      ),
    )

    if (options.debug) {
      yield* Console.log(`[DEBUG] Overall response:\n${overallResponse}`)
    }

    // If not in comment mode, just output the review
    if (!options.comment) {
      yield* Console.log('\n━━━━━━ OVERALL REVIEW ━━━━━━')
      yield* Console.log(overallResponse)
      yield* Console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      // In comment mode, handle posting
      yield* Console.log('\n━━━━━━ OVERALL REVIEW TO POST ━━━━━━')
      yield* Console.log(overallResponse)
      yield* Console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // Ask for confirmation unless --yes is provided
      const shouldPost = options.yes
        ? true
        : yield* promptUser('\nPost this overall review to Gerrit?')

      if (shouldPost) {
        // Post overall comment using the new direct input method
        yield* pipe(
          commentCommandWithInput(changeId, overallResponse, {}),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Console.error(`✗ Failed to post review comment: ${error}`)
              return yield* Effect.fail(error)
            }),
          ),
        )
        yield* Console.log(`✓ Overall review posted for ${changeId}`)
      } else {
        yield* Console.log('→ Overall review not posted')
      }
    }

    yield* Console.log(`✓ Review complete for ${changeId}`)
  })
