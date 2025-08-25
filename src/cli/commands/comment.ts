import { Effect, pipe } from 'effect'
import { GerritApiService } from '@/api/gerrit'
import type { ReviewInput } from '@/schemas/gerrit'

interface CommentOptions {
  message?: string
  pretty?: boolean
}

export const commentCommand = (
  changeId: string,
  options: CommentOptions,
) =>
  Effect.gen(function* () {
    const message = options.message

    if (!message) {
      yield* Effect.fail(new Error('Message is required. Use -m "your message"'))
    }

    const apiService = yield* GerritApiService

    // Get change info first
    const change = yield* apiService.getChange(changeId).pipe(
      Effect.catchTag('ApiError', (error) =>
        Effect.fail(new Error(`Failed to get change: ${error.message}`))
      )
    )

    // Post the review
    const review: ReviewInput = { message }
    yield* apiService.postReview(changeId, review).pipe(
      Effect.catchTag('ApiError', (error) =>
        Effect.fail(new Error(`Failed to post comment: ${error.message}`))
      )
    )

    // Output result
    if (options.pretty) {
      // Human-readable output
      console.log(`✓ Comment posted successfully!`)
      console.log(`Change: ${change.subject} (${change.status})`)
      console.log(`Message: ${message}`)
    } else {
      // XML output for LLM consumption
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<comment_result>`)
      console.log(`  <status>success</status>`)
      console.log(`  <change_id>${changeId}</change_id>`)
      console.log(`  <change_number>${change._number}</change_number>`)
      console.log(`  <change_subject><![CDATA[${change.subject}]]></change_subject>`)
      console.log(`  <change_status>${change.status}</change_status>`)
      console.log(`  <message><![CDATA[${message}]]></message>`)
      console.log(`</comment_result>`)
    }
  })
