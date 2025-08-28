import { Effect, pipe } from 'effect'
import { AiService } from '@/services/ai'
import { INLINE_REVIEW_PROMPT } from '@/prompts/inline-review'
import { OVERALL_REVIEW_PROMPT } from '@/prompts/overall-review'
import { commentCommand } from './comment'
import { Console } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import type { CommentInfo, MessageInfo } from '@/schemas/gerrit'
import { getDiffContext } from '@/utils/diff-context'
import { sanitizeCDATA, escapeXML } from '@/utils/shell-safety'
import { formatDiffPretty } from '@/utils/diff-formatters'
import { formatCommentsPretty } from '@/utils/comment-formatters'
import { formatDate } from '@/utils/formatters'

interface ReviewOptions {
  debug?: boolean
  dryRun?: boolean
}

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

export const reviewCommand = (changeId: string, options: ReviewOptions = {}) =>
  Effect.gen(function* () {
    const aiService = yield* AiService
    const gerritApi = yield* GerritApiService

    // Check for AI tool availability first
    yield* Console.log('→ Checking for AI tool availability...')
    const aiTool = yield* aiService
      .detectAiTool()
      .pipe(Effect.catchTag('NoAiToolFoundError', (error) => Effect.fail(new Error(error.message))))
    yield* Console.log(`✓ Found AI tool: ${aiTool}`)

    yield* Console.log(`→ Fetching change data for ${changeId}...`)

    // Stage 1: Generate inline comments
    yield* Console.log(`→ Generating inline comments for change ${changeId}...`)

    // Get change data in XML format for inline review
    const xmlData = yield* getChangeDataAsXml(changeId)

    if (options.debug) {
      yield* Console.log('[DEBUG] Running AI for inline comments...')
    }

    // Run inline review
    const inlineResponse = yield* aiService.runPrompt(INLINE_REVIEW_PROMPT, xmlData).pipe(
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

    // Parse JSON array from response
    let inlineComments: any[]
    try {
      inlineComments = JSON.parse(inlineResponse)
      if (!Array.isArray(inlineComments)) {
        throw new Error('Response is not an array')
      }
    } catch (error) {
      yield* Console.error(`✗ Failed to parse inline comments JSON: ${error}`)
      if (!options.debug) {
        yield* Console.error('Run with --debug to see raw AI output')
      }
      return yield* Effect.fail(new Error('Invalid inline comments format'))
    }

    if (inlineComments.length > 0) {
      if (options.dryRun) {
        yield* Console.log('→ [DRY RUN] Would post inline comments:')
        yield* Console.log(JSON.stringify(inlineComments, null, 2))
      } else {
        // Write comments to stdin and post using batch comment
        // We need to simulate stdin input for the comment command
        const originalStdin = process.stdin
        const { Readable } = require('stream')
        const stdinStream = new Readable()
        stdinStream.push(JSON.stringify(inlineComments))
        stdinStream.push(null)
        Object.defineProperty(process, 'stdin', {
          value: stdinStream,
          configurable: true,
        })

        yield* pipe(
          commentCommand(changeId, { batch: true }),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Console.error(`✗ Failed to post inline comments: ${error}`)
              return yield* Effect.fail(error)
            }),
          ),
          Effect.ensuring(
            Effect.sync(() => {
              Object.defineProperty(process, 'stdin', {
                value: originalStdin,
                configurable: true,
              })
            }),
          ),
        )
        yield* Console.log(`✓ Inline comments posted for ${changeId}`)
      }
    } else {
      yield* Console.log('→ No inline comments to post')
    }

    // Stage 2: Generate overall review comment
    yield* Console.log(`→ Generating overall review comment for change ${changeId}...`)

    // Get change data in regular format for overall review
    const prettyData = yield* getChangeDataAsPretty(changeId)

    if (options.debug) {
      yield* Console.log('[DEBUG] Running AI for overall review...')
    }

    // Run overall review
    const overallResponse = yield* aiService.runPrompt(OVERALL_REVIEW_PROMPT, prettyData).pipe(
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

    if (options.dryRun) {
      yield* Console.log('→ [DRY RUN] Would post overall review:')
      yield* Console.log(overallResponse)
    } else {
      // Post overall comment
      const originalStdin = process.stdin
      const { Readable } = require('stream')
      const stdinStream = new Readable()
      stdinStream.push(overallResponse)
      stdinStream.push(null)
      Object.defineProperty(process, 'stdin', {
        value: stdinStream,
        configurable: true,
      })

      yield* pipe(
        commentCommand(changeId, {}),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Console.error(`✗ Failed to post review comment: ${error}`)
            return yield* Effect.fail(error)
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            Object.defineProperty(process, 'stdin', {
              value: originalStdin,
              configurable: true,
            })
          }),
        ),
      )
      yield* Console.log(`✓ Review comment posted for ${changeId}`)
    }

    yield* Console.log(`✓ Complete review finished for ${changeId}`)
  })
