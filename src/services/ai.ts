import { Context, Data, Effect, Layer, pipe } from 'effect'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { ConfigService } from './config'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const execAsync = promisify(exec)

// Helper to expand tilde in file paths
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return filePath
}

// Helper to read prompt file
const readPromptFile = (filePath: string): string | null => {
  try {
    const expanded = expandTilde(filePath)
    if (fs.existsSync(expanded)) {
      return fs.readFileSync(expanded, 'utf8')
    }
  } catch {
    // Ignore errors
  }
  return null
}

// Error types
export class AiServiceError extends Data.TaggedError('AiServiceError')<{
  message: string
  cause?: unknown
}> {}

export class NoAiToolFoundError extends Data.TaggedError('NoAiToolFoundError')<{
  message: string
}> {}

export class AiResponseParseError extends Data.TaggedError('AiResponseParseError')<{
  message: string
  rawOutput: string
}> {}

// Service interface
export class AiService extends Context.Tag('AiService')<
  AiService,
  {
    readonly runPrompt: (
      prompt: string,
      input: string,
    ) => Effect.Effect<string, AiServiceError | NoAiToolFoundError | AiResponseParseError>
    readonly detectAiTool: () => Effect.Effect<string, NoAiToolFoundError>
    readonly extractResponseTag: (output: string) => Effect.Effect<string, AiResponseParseError>
  }
>() {}

// Service implementation
export const AiServiceLive = Layer.succeed(
  AiService,
  AiService.of({
    detectAiTool: () =>
      Effect.gen(function* () {
        // Try to detect available AI tools in order of preference
        const tools = ['claude', 'llm', 'opencode', 'gemini']

        for (const tool of tools) {
          const result = yield* Effect.tryPromise({
            try: () => execAsync(`which ${tool}`),
            catch: () => null,
          }).pipe(Effect.orElseSucceed(() => null))

          if (result && result.stdout.trim()) {
            return tool
          }
        }

        return yield* Effect.fail(
          new NoAiToolFoundError({
            message: 'No AI tool found. Please install claude, llm, opencode, or gemini CLI.',
          }),
        )
      }),

    extractResponseTag: (output: string) =>
      Effect.gen(function* () {
        // Extract content between <response> tags
        const responseMatch = output.match(/<response>([\s\S]*?)<\/response>/i)

        if (!responseMatch || !responseMatch[1]) {
          return yield* Effect.fail(
            new AiResponseParseError({
              message: 'No <response> tag found in AI output',
              rawOutput: output,
            }),
          )
        }

        return responseMatch[1].trim()
      }),

    runPrompt: (prompt: string, input: string) =>
      Effect.gen(function* () {
        const tool = yield* Effect.gen(function* () {
          // Try to detect available AI tools in order of preference
          const tools = ['claude', 'llm', 'opencode', 'gemini']

          for (const tool of tools) {
            const result = yield* Effect.tryPromise({
              try: () => execAsync(`which ${tool}`),
              catch: () => null,
            }).pipe(Effect.orElseSucceed(() => null))

            if (result && result.stdout.trim()) {
              return tool
            }
          }

          return yield* Effect.fail(
            new NoAiToolFoundError({
              message: 'No AI tool found. Please install claude, llm, opencode, or gemini CLI.',
            }),
          )
        })

        // Prepare the command based on the tool
        const fullInput = `${prompt}\n\n${input}`
        let command: string

        switch (tool) {
          case 'claude':
            // Claude CLI uses -p flag for piped input
            command = 'claude -p'
            break
          case 'llm':
            // LLM CLI syntax
            command = 'llm'
            break
          case 'opencode':
            // Opencode CLI syntax
            command = 'opencode'
            break
          default:
            command = tool
        }

        // Run the AI tool with the prompt and input
        const result = yield* Effect.tryPromise({
          try: async () => {
            const child = require('node:child_process').spawn(command, {
              shell: true,
              stdio: ['pipe', 'pipe', 'pipe'],
            })

            // Write input to stdin
            child.stdin.write(fullInput)
            child.stdin.end()

            // Collect output
            let stdout = ''
            let stderr = ''

            child.stdout.on('data', (data: Buffer) => {
              stdout += data.toString()
            })

            child.stderr.on('data', (data: Buffer) => {
              stderr += data.toString()
            })

            return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
              child.on('close', (code: number) => {
                if (code !== 0) {
                  reject(new Error(`AI tool exited with code ${code}: ${stderr}`))
                } else {
                  resolve({ stdout, stderr })
                }
              })

              child.on('error', reject)
            })
          },
          catch: (error) =>
            new AiServiceError({
              message: `Failed to run AI tool: ${error instanceof Error ? error.message : String(error)}`,
              cause: error,
            }),
        })

        // Extract response tag
        const responseMatch = result.stdout.match(/<response>([\s\S]*?)<\/response>/i)

        if (!responseMatch || !responseMatch[1]) {
          return yield* Effect.fail(
            new AiResponseParseError({
              message: 'No <response> tag found in AI output',
              rawOutput: result.stdout,
            }),
          )
        }

        return responseMatch[1].trim()
      }),
  }),
)
