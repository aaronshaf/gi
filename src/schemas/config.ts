import { Schema } from '@effect/schema'
import { GerritCredentials } from './gerrit'

// AI Configuration Schema
export const AiConfig = Schema.Struct({
  tool: Schema.optional(Schema.Literal('claude', 'llm', 'opencode', 'gemini')),
  reviewPromptPath: Schema.optional(Schema.String),
  autoDetect: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})

export type AiConfig = Schema.Schema.Type<typeof AiConfig>

// Full Application Configuration
export const AppConfig = Schema.Struct({
  credentials: GerritCredentials,
  ai: Schema.optionalWith(AiConfig, { default: () => ({ autoDetect: true }) }),
})

export type AppConfig = Schema.Schema.Type<typeof AppConfig>
