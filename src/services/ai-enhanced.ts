import { Effect, Layer, pipe } from 'effect'
import { AiService, AiServiceError, NoAiToolFoundError, AiResponseParseError } from './ai'
import { ConfigService, ConfigServiceLive } from './config'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
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

// Enhanced AI Service that uses configuration
export const AiServiceEnhanced = Layer.effect(
  AiService,
  Effect.gen(function* () {
    const configService = yield* ConfigService

    const detectAiTool = () =>
      Effect.gen(function* () {
        // First check configured preference
        const aiConfig = yield* configService.getAiConfig.pipe(
          Effect.orElseSucceed(() => ({ autoDetect: true })),
        )

        if ('tool' in aiConfig && aiConfig.tool && !aiConfig.autoDetect) {
          // Check if configured tool is available
          const result = yield* Effect.tryPromise({
            try: () => execAsync(`which ${aiConfig.tool}`),
            catch: () => null,
          }).pipe(Effect.orElseSucceed(() => null))

          if (result && result.stdout.trim()) {
            return aiConfig.tool
          }

          // Configured tool not available, fall back to auto-detect
          yield* Effect.logWarning(
            `Configured AI tool '${aiConfig.tool}' not found, auto-detecting...`,
          )
        }

        // Auto-detect available tools
        const tools =
          'tool' in aiConfig && aiConfig.tool
            ? [aiConfig.tool, 'claude', 'llm', 'opencode', 'gemini'].filter(
                (v, i, a) => a.indexOf(v) === i,
              )
            : ['claude', 'llm', 'opencode', 'gemini']

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

    const extractResponseTag = (output: string) =>
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
      })

    const runPrompt = (prompt: string, input: string) =>
      Effect.gen(function* () {
        // Check for custom prompt file overrides
        const aiConfig = yield* configService.getAiConfig.pipe(
          Effect.orElseSucceed(() => ({ autoDetect: true })),
        )

        // Use custom prompt if configured and this is a review prompt
        let actualPrompt = prompt
        if (
          prompt.includes('Code Review Prompt for Inline Comments') &&
          'inlinePromptPath' in aiConfig &&
          aiConfig.inlinePromptPath
        ) {
          const customPrompt = readPromptFile(aiConfig.inlinePromptPath)
          if (customPrompt) {
            actualPrompt = customPrompt
            yield* Effect.logInfo(`Using custom inline prompt from ${aiConfig.inlinePromptPath}`)
          }
        } else if (
          prompt.includes('Code Review Prompt') &&
          'overallPromptPath' in aiConfig &&
          aiConfig.overallPromptPath
        ) {
          const customPrompt = readPromptFile(aiConfig.overallPromptPath)
          if (customPrompt) {
            actualPrompt = customPrompt
            yield* Effect.logInfo(`Using custom overall prompt from ${aiConfig.overallPromptPath}`)
          }
        }

        const tool = yield* detectAiTool()

        // Prepare the command based on the tool
        const fullInput = `${actualPrompt}\n\n${input}`
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
          case 'gemini':
            // Gemini CLI syntax (adjust as needed)
            command = 'gemini'
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
        return yield* extractResponseTag(result.stdout)
      })

    return AiService.of({
      detectAiTool,
      extractResponseTag,
      runPrompt,
    })
  }),
).pipe(Layer.provide(ConfigServiceLive))

// Export a simpler Live layer for backward compatibility
export const AiServiceLive = AiServiceEnhanced
