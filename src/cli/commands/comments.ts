import { Effect } from 'effect'
import { ApiError, GerritApiService } from '@/api/gerrit'
import type { CommentInfo } from '@/schemas/gerrit'
import { formatDate, colors } from '@/utils/formatters'

interface CommentsOptions {
  xml?: boolean
}

interface CommentWithContext {
  comment: CommentInfo
  context?: {
    before: string[]
    line?: string
    after: string[]
  }
}

const getCommentsForChange = (
  changeId: string
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
          path: path === '/COMMIT_MSG' ? 'Commit Message' : path
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

const getDiffContext = (
  changeId: string,
  path: string,
  line?: number
): Effect.Effect<{ before: string[], line?: string, after: string[] }, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    if (!line || path === 'Commit Message') {
      return { before: [], after: [] }
    }
    
    const gerritApi = yield* GerritApiService
    try {
      // Get the file diff
      const diff = yield* gerritApi.getFileDiff(changeId, path)
      
      // Extract context around the line
      let currentLine = 0
      const contextBefore: string[] = []
      const contextAfter: string[] = []
      let targetLine: string | undefined
      let foundLine = false
      
      for (const section of diff.content) {
        if (section.ab) {
          for (const l of section.ab) {
            currentLine++
            if (currentLine === line - 2) contextBefore.push(l)
            else if (currentLine === line - 1) contextBefore.push(l)
            else if (currentLine === line) {
              targetLine = l
              foundLine = true
            }
            else if (currentLine === line + 1) contextAfter.push(l)
            else if (currentLine === line + 2) contextAfter.push(l)
          }
        }
        if (section.b) {
          for (const l of section.b) {
            currentLine++
            if (currentLine === line - 2) contextBefore.push(l)
            else if (currentLine === line - 1) contextBefore.push(l)
            else if (currentLine === line) {
              targetLine = l
              foundLine = true
            }
            else if (currentLine === line + 1) contextAfter.push(l)
            else if (currentLine === line + 2) contextAfter.push(l)
          }
        }
        if (foundLine && contextAfter.length >= 2) break
      }
      
      return { before: contextBefore, line: targetLine, after: contextAfter }
    } catch {
      // If we can't get the diff, just return empty context
      return { before: [], after: [] }
    }
  })

const formatCommentsPretty = (comments: CommentWithContext[]): void => {
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

const formatCommentsXml = (changeId: string, comments: CommentWithContext[]): void => {
  console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
  console.log(`<comments_result>`)
  console.log(`  <change_id>${changeId}</change_id>`)
  console.log(`  <comment_count>${comments.length}</comment_count>`)
  console.log(`  <comments>`)
  
  for (const { comment, context } of comments) {
    console.log(`    <comment>`)
    console.log(`      <id>${comment.id}</id>`)
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
        console.log(`        <email>${comment.author.email}</email>`)
      }
      if (comment.author._account_id !== undefined) {
        console.log(`        <account_id>${comment.author._account_id}</account_id>`)
      }
      console.log(`      </author>`)
    }
    if (comment.updated) {
      console.log(`      <updated>${comment.updated}</updated>`)
    }
    if (comment.unresolved !== undefined) {
      console.log(`      <unresolved>${comment.unresolved}</unresolved>`)
    }
    if (comment.in_reply_to) {
      console.log(`      <in_reply_to>${comment.in_reply_to}</in_reply_to>`)
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

export const commentsCommand = (
  changeId: string,
  options: CommentsOptions
): Effect.Effect<void, ApiError | Error, GerritApiService> =>
  Effect.gen(function* () {
    // Get all comments
    const comments = yield* getCommentsForChange(changeId)
    
    // Get context for each comment
    const commentsWithContext: CommentWithContext[] = []
    for (const comment of comments) {
      const context = comment.path && comment.line
        ? yield* getDiffContext(changeId, comment.path, comment.line)
        : undefined
      
      commentsWithContext.push({ comment, context })
    }
    
    // Format output
    if (options.xml) {
      formatCommentsXml(changeId, commentsWithContext)
    } else {
      formatCommentsPretty(commentsWithContext)
    }
  })