#!/usr/bin/env bun

import { program } from 'commander'
import { Effect, Layer, pipe } from 'effect'
import { render } from 'ink'
import React from 'react'
import { GerritApiService, GerritApiServiceLive } from '@/api/gerrit'
import { DatabaseServiceLive } from '@/db/database'
import { initI18n, t } from '@/i18n'
import { ConfigService, ConfigServiceLive } from '@/services/config'
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
          const { waitUntilExit } = render(
            React.createElement(InitCommand, {
              saveCredentials: configService.saveCredentials,
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
  .action((changeId: string, options: { message?: string }) => {
    Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const apiService = yield* GerritApiService
          const { waitUntilExit } = render(
            React.createElement(CommentCommand, {
              changeId,
              message: options.message,
              apiService,
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
      changeId: string,
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
      const diffOptions = {
        format: options.format as 'unified' | 'json' | 'files',
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
