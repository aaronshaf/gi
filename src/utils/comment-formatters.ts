import type { CommentInfo } from '@/schemas/gerrit'
import { colors, formatDate } from './formatters'

export interface CommentWithContext {
  comment: CommentInfo
  context?: {
    before: string[]
    line?: string
    after: string[]
  }
}

export const formatCommentsPretty = (comments: CommentWithContext[]): void => {
  if (comments.length === 0) {
    console.log('No comments found on this change')
    return
  }

  console.log(`Found ${comments.length} comment${comments.length === 1 ? '' : 's'}:\n`)

  let currentPath: string | undefined

  for (const { comment, context } of comments) {
    // Group by file
    if (comment.path !== currentPath) {
      currentPath = comment.path
      console.log(`${colors.blue}═══ ${currentPath} ═══${colors.reset}`)
    }

    // Comment metadata
    const author = comment.author?.name || 'Unknown'
    const date = comment.updated ? formatDate(comment.updated) : ''
    const status = comment.unresolved ? `${colors.yellow}[UNRESOLVED]${colors.reset} ` : ''

    console.log(`\n${status}${colors.dim}${author} • ${date}${colors.reset}`)

    if (comment.line) {
      console.log(`${colors.dim}Line ${comment.line}:${colors.reset}`)

      // Show context if available
      if (context && (context.before.length > 0 || context.line || context.after.length > 0)) {
        console.log(`${colors.dim}───────────────────${colors.reset}`)
        for (const line of context.before) {
          console.log(`${colors.dim}  ${line}${colors.reset}`)
        }
        if (context.line) {
          console.log(`${colors.green}> ${context.line}${colors.reset}`)
        }
        for (const line of context.after) {
          console.log(`${colors.dim}  ${line}${colors.reset}`)
        }
        console.log(`${colors.dim}───────────────────${colors.reset}`)
      }
    }

    // Comment message (indent each line)
    const messageLines = comment.message.split('\n')
    for (const line of messageLines) {
      console.log(`  ${line}`)
    }
  }
}

// Escape special XML characters to prevent XSS
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const formatCommentsXml = (changeId: string, comments: CommentWithContext[]): void => {
  console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
  console.log(`<comments_result>`)
  console.log(`  <change_id>${escapeXml(changeId)}</change_id>`)
  console.log(`  <comment_count>${comments.length}</comment_count>`)
  console.log(`  <comments>`)

  for (const { comment, context } of comments) {
    console.log(`    <comment>`)
    console.log(`      <id>${escapeXml(comment.id)}</id>`)
    if (comment.path) {
      console.log(`      <path><![CDATA[${comment.path}]]></path>`)
    }
    if (comment.line) {
      console.log(`      <line>${comment.line}</line>`)
    }
    if (comment.range) {
      console.log(`      <range>`)
      console.log(`        <start_line>${comment.range.start_line}</start_line>`)
      console.log(`        <end_line>${comment.range.end_line}</end_line>`)
      if (comment.range.start_character !== undefined) {
        console.log(`        <start_character>${comment.range.start_character}</start_character>`)
      }
      if (comment.range.end_character !== undefined) {
        console.log(`        <end_character>${comment.range.end_character}</end_character>`)
      }
      console.log(`      </range>`)
    }
    if (comment.author) {
      console.log(`      <author>`)
      if (comment.author.name) {
        console.log(`        <name><![CDATA[${comment.author.name}]]></name>`)
      }
      if (comment.author.email) {
        console.log(`        <email>${escapeXml(comment.author.email)}</email>`)
      }
      if (comment.author._account_id !== undefined) {
        console.log(`        <account_id>${comment.author._account_id}</account_id>`)
      }
      console.log(`      </author>`)
    }
    if (comment.updated) {
      console.log(`      <updated>${escapeXml(comment.updated)}</updated>`)
    }
    if (comment.unresolved !== undefined) {
      console.log(`      <unresolved>${comment.unresolved}</unresolved>`)
    }
    if (comment.in_reply_to) {
      console.log(`      <in_reply_to>${escapeXml(comment.in_reply_to)}</in_reply_to>`)
    }
    console.log(`      <message><![CDATA[${comment.message}]]></message>`)

    if (context && (context.before.length > 0 || context.line || context.after.length > 0)) {
      console.log(`      <diff_context>`)
      if (context.before.length > 0) {
        console.log(`        <before>`)
        for (const line of context.before) {
          console.log(`          <line><![CDATA[${line}]]></line>`)
        }
        console.log(`        </before>`)
      }
      if (context.line) {
        console.log(`        <target_line><![CDATA[${context.line}]]></target_line>`)
      }
      if (context.after.length > 0) {
        console.log(`        <after>`)
        for (const line of context.after) {
          console.log(`          <line><![CDATA[${line}]]></line>`)
        }
        console.log(`        </after>`)
      }
      console.log(`      </diff_context>`)
    }

    console.log(`    </comment>`)
  }

  console.log(`  </comments>`)
  console.log(`</comments_result>`)
}
