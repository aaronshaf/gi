import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import type { CommentInfo } from '@/schemas/gerrit'
import { formatCommentsPretty } from '@/utils/comment-formatters'
import { getDiffContext } from '@/utils/diff-context'
import { formatDiffPretty } from '@/utils/diff-formatters'
import { sanitizeCDATA, escapeXML } from '@/utils/shell-safety'
import { formatDate } from '@/utils/formatters'

interface ShowOptions {
  xml?: boolean
}

interface ChangeDetails {
  id: string
  number: number
  subject: string
  status: string
  project: string
  branch: string
  owner: {
    name?: string
    email?: string
  }
  created?: string
  updated?: string
  commitMessage: string
}

const getChangeDetails = (
  changeId: string,
): Effect.Effect<ChangeDetails, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    const change = yield* gerritApi.getChange(changeId)

    return {
      id: change.change_id,
      number: change._number,
      subject: change.subject,
      status: change.status,
      project: change.project,
      branch: change.branch,
      owner: {
        name: change.owner?.name,
        email: change.owner?.email,
      },
      created: change.created,
      updated: change.updated,
      commitMessage: change.subject, // For now, using subject as commit message
    }
  })

const getDiffForChange = (changeId: string): Effect.Effect<string, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    const diff = yield* gerritApi.getDiff(changeId, { format: 'unified' })
    return typeof diff === 'string' ? diff : JSON.stringify(diff, null, 2)
  })

const getCommentsForChange = (
  changeId: string,
): Effect.Effect<CommentInfo[], ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService

    // Get all comments for the change
    const comments = yield* gerritApi.getComments(changeId)

    // Flatten all comments from all files
    const allComments: CommentInfo[] = []
    for (const [path, fileComments] of Object.entries(comments)) {
      for (const comment of fileComments) {
        allComments.push({
          ...comment,
          path: path === '/COMMIT_MSG' ? 'Commit Message' : path,
        })
      }
    }

    // Sort by path and then by line number
    allComments.sort((a, b) => {
      const pathCompare = (a.path || '').localeCompare(b.path || '')
      if (pathCompare !== 0) return pathCompare
      return (a.line || 0) - (b.line || 0)
    })

    return allComments
  })

const formatShowPretty = (
  changeDetails: ChangeDetails,
  diff: string,
  commentsWithContext: Array<{ comment: CommentInfo; context?: any }>,
): void => {
  // Change details header
  console.log('━'.repeat(80))
  console.log(`📋 Change ${changeDetails.number}: ${changeDetails.subject}`)
  console.log('━'.repeat(80))
  console.log()

  // Metadata
  console.log('📝 Details:')
  console.log(`   Project: ${changeDetails.project}`)
  console.log(`   Branch: ${changeDetails.branch}`)
  console.log(`   Status: ${changeDetails.status}`)
  console.log(`   Owner: ${changeDetails.owner.name || changeDetails.owner.email || 'Unknown'}`)
  console.log(
    `   Created: ${changeDetails.created ? formatDate(changeDetails.created) : 'Unknown'}`,
  )
  console.log(
    `   Updated: ${changeDetails.updated ? formatDate(changeDetails.updated) : 'Unknown'}`,
  )
  console.log(`   Change-Id: ${changeDetails.id}`)
  console.log()

  // Diff section
  console.log('🔍 Diff:')
  console.log('─'.repeat(40))
  console.log(formatDiffPretty(diff))
  console.log()

  // Comments section
  if (commentsWithContext.length > 0) {
    console.log('💬 Comments:')
    console.log('─'.repeat(40))
    formatCommentsPretty(commentsWithContext)
  } else {
    console.log('💬 Comments:')
    console.log('─'.repeat(40))
    console.log('No comments found.')
  }
}

const formatShowXml = (
  changeDetails: ChangeDetails,
  diff: string,
  commentsWithContext: Array<{ comment: CommentInfo; context?: any }>,
): void => {
  console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
  console.log(`<show_result>`)
  console.log(`  <status>success</status>`)
  console.log(`  <change>`)
  console.log(`    <id>${escapeXML(changeDetails.id)}</id>`)
  console.log(`    <number>${changeDetails.number}</number>`)
  console.log(`    <subject><![CDATA[${sanitizeCDATA(changeDetails.subject)}]]></subject>`)
  console.log(`    <status>${escapeXML(changeDetails.status)}</status>`)
  console.log(`    <project>${escapeXML(changeDetails.project)}</project>`)
  console.log(`    <branch>${escapeXML(changeDetails.branch)}</branch>`)
  console.log(`    <owner>`)
  if (changeDetails.owner.name) {
    console.log(`      <name><![CDATA[${sanitizeCDATA(changeDetails.owner.name)}]]></name>`)
  }
  if (changeDetails.owner.email) {
    console.log(`      <email>${escapeXML(changeDetails.owner.email)}</email>`)
  }
  console.log(`    </owner>`)
  console.log(`    <created>${escapeXML(changeDetails.created || '')}</created>`)
  console.log(`    <updated>${escapeXML(changeDetails.updated || '')}</updated>`)
  console.log(`  </change>`)
  console.log(`  <diff><![CDATA[${sanitizeCDATA(diff)}]]></diff>`)

  // Comments section
  console.log(`  <comments>`)
  console.log(`    <count>${commentsWithContext.length}</count>`)
  for (const { comment } of commentsWithContext) {
    console.log(`    <comment>`)
    if (comment.id) console.log(`      <id>${escapeXML(comment.id)}</id>`)
    if (comment.path) console.log(`      <path><![CDATA[${sanitizeCDATA(comment.path)}]]></path>`)
    if (comment.line) console.log(`      <line>${comment.line}</line>`)
    if (comment.author?.name) {
      console.log(`      <author><![CDATA[${sanitizeCDATA(comment.author.name)}]]></author>`)
    }
    if (comment.updated) console.log(`      <updated>${escapeXML(comment.updated)}</updated>`)
    if (comment.message) {
      console.log(`      <message><![CDATA[${sanitizeCDATA(comment.message)}]]></message>`)
    }
    if (comment.unresolved) console.log(`      <unresolved>true</unresolved>`)
    console.log(`    </comment>`)
  }
  console.log(`  </comments>`)
  console.log(`</show_result>`)
}

export const showCommand = (
  changeId: string,
  options: ShowOptions,
): Effect.Effect<void, ApiError | Error, GerritApiService> =>
  Effect.gen(function* () {
    // Fetch all data concurrently
    const [changeDetails, diff, comments] = yield* Effect.all(
      [getChangeDetails(changeId), getDiffForChange(changeId), getCommentsForChange(changeId)],
      { concurrency: 'unbounded' },
    )

    // Get context for each comment using concurrent requests
    const contextEffects = comments.map((comment) =>
      comment.path && comment.line
        ? getDiffContext(changeId, comment.path, comment.line).pipe(
            Effect.map((context) => ({ comment, context })),
            // Graceful degradation for diff fetch failures
            Effect.catchAll(() => Effect.succeed({ comment, context: undefined })),
          )
        : Effect.succeed({ comment, context: undefined }),
    )

    // Execute all context fetches concurrently
    const commentsWithContext = yield* Effect.all(contextEffects, {
      concurrency: 'unbounded',
    })

    // Format output
    if (options.xml) {
      formatShowXml(changeDetails, diff, commentsWithContext)
    } else {
      formatShowPretty(changeDetails, diff, commentsWithContext)
    }
  }).pipe(
    // Regional error boundary for the entire command
    Effect.catchTag('ApiError', (error) => {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<show_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error.message}]]></error>`)
        console.log(`</show_result>`)
      } else {
        console.error(`✗ Failed to fetch change details: ${error.message}`)
      }
      return Effect.succeed(undefined)
    }),
  )
