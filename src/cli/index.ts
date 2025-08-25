#!/usr/bin/env bun

import { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { ConfigServiceLive } from '@/services/config'
import { commentCommand } from './commands/comment'
import { initCommand } from './commands/init'
import { statusCommand } from './commands/status'
import { diffCommand } from './commands/diff'
import { mineCommand } from './commands/mine'
import { incomingCommand } from './commands/incoming'
import { workspaceCommand } from './commands/workspace'
import { abandonCommand } from './commands/abandon'
import { commentsCommand } from './commands/comments'

const program = new Command()

program
  .name('ger')
  .description('LLM-centric Gerrit CLI tool')
  .version('0.1.0')

// init command
program
  .command('init')
  .description('Initialize Gerrit credentials')
  .action(async () => {
    try {
      const effect = initCommand().pipe(
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// status command
program
  .command('status')
  .description('Check connection status')
  .option('--xml', 'XML output for LLM consumption')
  .action(async (options) => {
    try {
      const effect = statusCommand(options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// comment command
program
  .command('comment <change-id>')
  .description('Post a comment on a change')
  .option('-m, --message <message>', 'Comment message')
  .option('--xml', 'XML output for LLM consumption')
  .action(async (changeId, options) => {
    try {
      const effect = commentCommand(changeId, options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<comment_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error instanceof Error ? error.message : String(error)}]]></error>`)
        console.log(`</comment_result>`)
      } else {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }
  })

// diff command
program
  .command('diff <change-id>')
  .description('Get diff for a change')
  .option('--xml', 'XML output for LLM consumption')
  .option('--file <file>', 'Specific file to diff')
  .option('--files-only', 'List changed files only')
  .option('--format <format>', 'Output format (unified, json, files)')
  .action(async (changeId, options) => {
    try {
      const effect = diffCommand(changeId, options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<diff_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error instanceof Error ? error.message : String(error)}]]></error>`)
        console.log(`</diff_result>`)
      } else {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }
  })

// mine command
program
  .command('mine')
  .description('Show your open changes')
  .option('--xml', 'XML output for LLM consumption')
  .action(async (options) => {
    try {
      const effect = mineCommand(options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<mine_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error instanceof Error ? error.message : String(error)}]]></error>`)
        console.log(`</mine_result>`)
      } else {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }
  })

// workspace command
program
  .command('workspace <change-id>')
  .description('Create or switch to a git worktree for a Gerrit change')
  .option('--xml', 'XML output for LLM consumption')
  .action(async (changeId, options) => {
    try {
      const effect = workspaceCommand(changeId, options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<workspace_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error instanceof Error ? error.message : String(error)}]]></error>`)
        console.log(`</workspace_result>`)
      } else {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }
  })

// incoming command
program
  .command('incoming')
  .description('Show incoming changes for review (where you are a reviewer)')
  .option('--xml', 'XML output for LLM consumption')
  .action(async (options) => {
    try {
      const effect = incomingCommand(options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive),
      )
      await Effect.runPromise(effect)
    } catch (error) {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<incoming_result>`)
        console.log(`  <status>error</status>`)
        console.log(
          `  <error><![CDATA[${error instanceof Error ? error.message : String(error)}]]></error>`,
        )
        console.log(`</incoming_result>`)
      } else {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }
  })

// abandon command
program
  .command('abandon [change-id]')
  .description('Abandon a change (interactive mode if no change-id provided)')
  .option('-m, --message <message>', 'Abandon message')
  .option('--xml', 'XML output for LLM consumption')
  .action(async (changeId, options) => {
    try {
      const effect = abandonCommand(changeId, options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<abandon_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error instanceof Error ? error.message : String(error)}]]></error>`)
        console.log(`</abandon_result>`)
      } else {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }
  })

// comments command
program
  .command('comments <change-id>')
  .description('Show all comments on a change with diff context')
  .option('--xml', 'XML output for LLM consumption')
  .action(async (changeId, options) => {
    try {
      const effect = commentsCommand(changeId, options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error) {
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<comments_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error instanceof Error ? error.message : String(error)}]]></error>`)
        console.log(`</comments_result>`)
      } else {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }
  })

program.parse(process.argv)
