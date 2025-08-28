import { Effect, pipe, Console } from 'effect'
import { ConfigService, ConfigError } from '@/services/config'
import { GerritApiService, ApiError } from '@/api/gerrit'
import type { GerritCredentials } from '@/schemas/gerrit'
import type { AiConfig, AppConfig } from '@/schemas/config'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// Helper to expand tilde in file paths
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return filePath
}

// Helper to validate file exists
const validateFilePath = (filePath: string): string | null => {
  if (!filePath) return null
  const expanded = expandTilde(filePath)
  if (fs.existsSync(expanded)) {
    return filePath // Return original path with tilde
  }
  return null
}

// Helper to detect available AI tools
const detectAvailableAiTools = Effect.gen(function* () {
  const tools = ['claude', 'llm', 'opencode', 'gemini']
  const available: string[] = []

  for (const tool of tools) {
    const result = yield* Effect.tryPromise({
      try: async () => {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        return await execAsync(`which ${tool}`)
      },
      catch: () => null,
    }).pipe(Effect.orElseSucceed(() => null))

    if (result && result.stdout?.trim()) {
      available.push(tool)
    }
  }

  return available
})

// Test connection with credentials
const testConnection = (
  credentials: GerritCredentials,
): Effect.Effect<boolean, ConfigError, GerritApiService> =>
  Effect.gen(function* () {
    const api = yield* GerritApiService
    const result = yield* api.testConnection.pipe(
      Effect.map(() => true),
      Effect.catchAll(() => Effect.succeed(false)),
    )
    return result
  })

export const setupCommand = () =>
  Effect.gen(function* () {
    const configService = yield* ConfigService

    yield* Console.log('🔧 Gerrit CLI Setup\n')

    // Check for existing config
    const existingConfig = yield* configService.getFullConfig.pipe(Effect.orElseSucceed(() => null))

    if (existingConfig) {
      yield* Console.log('📝 Existing configuration found')
      yield* Console.log('   (Press Enter to keep existing values)\n')
    }

    const rl = readline.createInterface({ input, output })

    try {
      // Gerrit Credentials Section
      yield* Console.log('━━━ Gerrit Credentials ━━━')

      const host = yield* Effect.promise(async () => {
        const answer = await rl.question(
          `Gerrit Host URL${existingConfig ? ` [${existingConfig.credentials.host}]` : ''}: `,
        )
        return answer || existingConfig?.credentials.host || ''
      })

      const username = yield* Effect.promise(async () => {
        const answer = await rl.question(
          `Username${existingConfig ? ` [${existingConfig.credentials.username}]` : ''}: `,
        )
        return answer || existingConfig?.credentials.username || ''
      })

      // For password, don't show existing value
      const password = yield* Effect.promise(async () => {
        if (existingConfig?.credentials.password && !process.env.CI) {
          const answer = await rl.question(`HTTP Password (press Enter to keep existing): `)
          return answer || existingConfig.credentials.password
        } else {
          return await rl.question(`HTTP Password: `)
        }
      })

      // Validate required fields
      if (!host || !username || !password) {
        yield* Console.error('✗ All Gerrit credential fields are required')
        return yield* Effect.fail(new ConfigError({ message: 'Missing required credentials' }))
      }

      const credentials: GerritCredentials = {
        host: host.replace(/\/$/, ''), // Remove trailing slash
        username,
        password,
      }

      // Test connection
      yield* Console.log('\n→ Testing Gerrit connection...')
      const connectionOk = yield* testConnection(credentials).pipe(
        Effect.provideService(GerritApiService, {
          getChange: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          listChanges: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          postReview: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          abandonChange: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          testConnection: Effect.gen(function* () {
            const response = yield* Effect.tryPromise({
              try: async () => {
                const auth = Buffer.from(
                  `${credentials.username}:${credentials.password}`,
                ).toString('base64')
                return await fetch(`${credentials.host}/a/config/server/version`, {
                  headers: { Authorization: `Basic ${auth}` },
                })
              },
              catch: (error) => new ApiError({ message: `Connection failed: ${error}` }),
            })
            return response.ok
          }),
          getRevision: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          getFiles: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          getFileDiff: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          getFileContent: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          getPatch: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          getDiff: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          getComments: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
          getMessages: () => Effect.fail(new ApiError({ message: 'Not implemented' })),
        }),
        Effect.orElse(() => Effect.succeed(false)),
      )

      if (!connectionOk) {
        yield* Console.error('✗ Failed to connect to Gerrit. Please check your credentials.')
        const retry = yield* Effect.promise(async () => {
          const answer = await rl.question('Would you like to continue anyway? (y/N): ')
          return answer.toLowerCase() === 'y'
        })

        if (!retry) {
          return yield* Effect.fail(new ConfigError({ message: 'Connection test failed' }))
        }
      } else {
        yield* Console.log('✓ Successfully connected to Gerrit')
      }

      // AI Configuration Section
      yield* Console.log('\n━━━ AI Tool Configuration (Optional) ━━━')

      const availableTools = yield* detectAvailableAiTools

      if (availableTools.length > 0) {
        yield* Console.log(`✓ Detected AI tools: ${availableTools.join(', ')}`)
      } else {
        yield* Console.log(
          'ℹ No AI tools detected. You can install claude, llm, opencode, or gemini.',
        )
      }

      const aiTool = yield* Effect.promise(async () => {
        const defaultTool = existingConfig?.ai?.tool || availableTools[0] || ''
        const answer = await rl.question(
          `Preferred AI tool (claude/llm/opencode/gemini)${defaultTool ? ` [${defaultTool}]` : ''}: `,
        )
        return answer || defaultTool
      })

      const inlinePromptPath = yield* Effect.promise(async () => {
        const existing = existingConfig?.ai?.inlinePromptPath || ''
        const answer = await rl.question(
          `Custom inline review prompt file${existing ? ` [${existing}]` : ''}: `,
        )
        return answer || existing
      })

      const overallPromptPath = yield* Effect.promise(async () => {
        const existing = existingConfig?.ai?.overallPromptPath || ''
        const answer = await rl.question(
          `Custom overall review prompt file${existing ? ` [${existing}]` : ''}: `,
        )
        return answer || existing
      })

      // Validate prompt files if provided
      const validatedInlinePath = validateFilePath(inlinePromptPath)
      const validatedOverallPath = validateFilePath(overallPromptPath)

      if (inlinePromptPath && !validatedInlinePath) {
        yield* Console.log(`⚠️  Inline prompt file not found: ${inlinePromptPath}`)
      }

      if (overallPromptPath && !validatedOverallPath) {
        yield* Console.log(`⚠️  Overall prompt file not found: ${overallPromptPath}`)
      }

      // Build AI config
      const aiConfig: AiConfig = {
        ...(aiTool && { tool: aiTool as 'claude' | 'llm' | 'opencode' | 'gemini' }),
        ...(validatedInlinePath && { inlinePromptPath: validatedInlinePath }),
        ...(validatedOverallPath && { overallPromptPath: validatedOverallPath }),
        autoDetect: !aiTool,
      }

      // Build full config
      const fullConfig: AppConfig = {
        credentials,
        ai: aiConfig,
      }

      // Save configuration
      yield* Console.log('\n→ Saving configuration...')
      yield* configService.saveFullConfig(fullConfig)

      yield* Console.log('✓ Configuration saved to ~/.gi/config.json')
      yield* Console.log('\n🎉 Setup complete! You can now use gi commands.')

      if (!aiTool && availableTools.length === 0) {
        yield* Console.log('\nℹ️  To use AI features (gi review), install one of:')
        yield* Console.log('   - claude: https://claude.ai/cli')
        yield* Console.log('   - llm: https://llm.datasette.io/')
        yield* Console.log('   - opencode: npm install -g opencode')
      }
    } finally {
      rl.close()
    }
  })
