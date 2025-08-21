#!/usr/bin/env bun

import { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { ConfigServiceLive } from '@/services/config'
import { commentCommand } from './commands/comment'
import { initCommand } from './commands/init'
import { statusCommand } from './commands/status'
import { diffCommand } from './commands/diff'

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
    } catch (error: any) {
      console.error('Error:', error.message || error)
      process.exit(1)
    }
  })

// status command
program
  .command('status')
  .description('Check connection status')
  .option('--pretty', 'Human-readable output')
  .action(async (options) => {
    try {
      const effect = statusCommand(options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error: any) {
      console.error('Error:', error.message || error)
      process.exit(1)
    }
  })

// comment command
program
  .command('comment <change-id>')
  .description('Post a comment on a change')
  .option('-m, --message <message>', 'Comment message')
  .option('--pretty', 'Human-readable output instead of XML')
  .action(async (changeId, options) => {
    try {
      const effect = commentCommand(changeId, options).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(ConfigServiceLive)
      )
      await Effect.runPromise(effect)
    } catch (error: any) {
      if (options.pretty) {
        console.error('✗ Error:', error.message || error)
      } else {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<comment_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error.message || error}]]></error>`)
        console.log(`</comment_result>`)
      }
      process.exit(1)
    }
  })

// diff command
program
  .command('diff <change-id>')
  .description('Get diff for a change')
  .option('--pretty', 'Human-readable output instead of XML')
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
    } catch (error: any) {
      if (options.pretty) {
        console.error('✗ Error:', error.message || error)
      } else {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<diff_result>`)
        console.log(`  <status>error</status>`)
        console.log(`  <error><![CDATA[${error.message || error}]]></error>`)
        console.log(`</diff_result>`)
      }
      process.exit(1)
    }
  })

program.parse(process.argv)
