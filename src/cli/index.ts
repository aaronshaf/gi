#!/usr/bin/env bun

import { program } from 'commander'
import { Effect, Layer, pipe } from 'effect'
import { render } from 'ink'
import React from 'react'
import { GerritApiService, GerritApiServiceLive } from '@/api/gerrit'
import { DatabaseServiceLive } from '@/db/database'
import { initI18n, t } from '@/i18n'
import { ConfigService, ConfigServiceLive } from '@/services/config'
import { extractChangeNumber } from '@/utils/url-parser'
import { CommentCommand } from './commands/comment'
import { DiffCommand } from './commands/diff'
import { InitCommand } from './commands/init'
import { StatusCommand } from './commands/status'

const version = '0.1.0'

const MainLayer = Layer.mergeAll(
  ConfigServiceLive,
  DatabaseServiceLive,
  GerritApiServiceLive.pipe(Layer.provide(Layer.mergeAll(ConfigServiceLive, DatabaseServiceLive))),
)

// Initialize i18n on startup
await Effect.runPromise(initI18n)

program
  .name('ger')
  .description('Gerrit CLI - A modern command-line interface for Gerrit Code Review')
  .version(version)

program
  .command('init')
  .description(t('commands.init.description'))
  .action(() => {
    Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const configService = yield* ConfigService

          // Try to load existing credentials, ignore errors if none exist
          const existingCredentials = yield* configService.getCredentials.pipe(
            Effect.catchAll(() => Effect.succeed(undefined)),
          )

          const { waitUntilExit } = render(
            React.createElement(InitCommand, {
              saveCredentials: configService.saveCredentials,
              existingCredentials,
            }),
          )
          yield* Effect.promise(() => waitUntilExit())
        }),
        Effect.provide(MainLayer),
        Effect.catchAll(() => Effect.void),
      ),
    ).catch(console.error)
  })

program
  .command('status')
  .description(t('commands.status.description'))
  .action(() => {
    Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const configService = yield* ConfigService
          const apiService = yield* GerritApiService
          const { waitUntilExit } = render(
            React.createElement(StatusCommand, { configService, apiService }),
          )
          yield* Effect.promise(() => waitUntilExit())
        }),
        Effect.provide(MainLayer),
        Effect.catchAll(() => Effect.void),
      ),
    ).catch(console.error)
  })

program
  .command('comment <change-id>')
  .description(t('commands.comment.description'))
  .option('-m, --message <message>', 'Comment message')
  .action(async (changeIdOrUrl: string, options: { message?: string }) => {
    // Check if stdin is piped
    let stdinMessage: string | undefined
    if (!process.stdin.isTTY) {
      // Read from stdin
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      stdinMessage = Buffer.concat(chunks).toString().trim()
    }

    // Combine messages if both are present
    let finalMessage: string | undefined
    if (options.message && stdinMessage) {
      // Both -m and piped input: concatenate directly (no forced newline)
      finalMessage = options.message + stdinMessage
    } else {
      // Use whichever is available
      finalMessage = options.message || stdinMessage
    }

    Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const apiService = yield* GerritApiService

          // Extract change number from URL if needed
          const changeId = extractChangeNumber(changeIdOrUrl)

          // If message is provided via CLI or stdin, handle non-interactively
          if (finalMessage) {
            console.log('Posting comment...')
            try {
              yield* apiService.postReview(changeId, { message: finalMessage })
              console.log('✓ Comment posted successfully!')
            } catch (error) {
              console.error(
                '✗ Failed to post comment:',
                error instanceof Error ? error.message : String(error),
              )
              process.exit(1)
            }
          } else {
            // Interactive mode with Ink
            const { waitUntilExit } = render(
              React.createElement(CommentCommand, {
                changeId,
                message: undefined,
                apiService,
              }),
            )
            yield* Effect.promise(() => waitUntilExit())
          }
        }),
        Effect.provide(MainLayer),
        Effect.catchAll(() => Effect.void),
      ),
    ).catch(console.error)
  })

program
  .command('diff <change-id>')
  .description(t('commands.diff.description'))
  .option('--format <format>', 'Output format: unified, json, files', 'unified')
  .option('--patchset <number>', 'Patchset number (defaults to current)', parseInt)
  .option('--file <path>', 'Show diff for specific file only')
  .option('--files-only', 'List changed files only')
  .option('--full-files', 'Show full content of changed files')
  .option('--base <number>', 'Base patchset for comparison', parseInt)
  .option('--target <number>', 'Target patchset for comparison', parseInt)
  .action(
    (
      changeIdOrUrl: string,
      options: {
        format?: string
        patchset?: number
        file?: string
        filesOnly?: boolean
        fullFiles?: boolean
        base?: number
        target?: number
      },
    ) => {
      // Extract change number from URL if needed
      const changeId = extractChangeNumber(changeIdOrUrl)

      const diffOptions = {
        format: options.format as unknown as 'unified' | 'json' | 'files',
        patchset: options.patchset,
        file: options.file,
        filesOnly: options.filesOnly,
        fullFiles: options.fullFiles,
        base: options.base,
        target: options.target,
      }

      Effect.runPromise(
        pipe(
          Effect.gen(function* () {
            const apiService = yield* GerritApiService
            const { waitUntilExit } = render(
              React.createElement(DiffCommand, {
                changeId,
                options: diffOptions,
                apiService,
              }),
            )
            yield* Effect.promise(() => waitUntilExit())
          }),
          Effect.provide(MainLayer),
          Effect.catchAll(() => Effect.void),
        ),
      ).catch(console.error)
    },
  )

program.parse()
