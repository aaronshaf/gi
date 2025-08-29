import { Schema } from '@effect/schema'

// Flat Application Configuration (similar to ji structure)
export const AppConfig = Schema.Struct({
  // Gerrit credentials (flattened)
  host: Schema.String.pipe(
    Schema.pattern(/^https?:\/\/.+$/),
    Schema.annotations({ description: 'Gerrit server URL' }),
  ),
  username: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Gerrit username' }),
  ),
  password: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'HTTP password or API token' }),
  ),
  // AI configuration (flattened)
  aiTool: Schema.optional(Schema.Literal('claude', 'llm', 'opencode', 'gemini')),
  aiAutoDetect: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})

export type AppConfig = Schema.Schema.Type<typeof AppConfig>

// Legacy schemas for backward compatibility (deprecated)
export const AiConfig = Schema.Struct({
  tool: Schema.optional(Schema.Literal('claude', 'llm', 'opencode', 'gemini')),
  autoDetect: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})

export type AiConfig = Schema.Schema.Type<typeof AiConfig>

// Helper to convert from flat config to legacy AI config
export const aiConfigFromFlat = (config: AppConfig): AiConfig => ({
  tool: config.aiTool,
  autoDetect: config.aiAutoDetect,
})

// Helper to convert from legacy nested format to flat format
export const migrateFromNestedConfig = (nested: {
  credentials: { host: string; username: string; password: string }
  ai?: { tool?: 'claude' | 'llm' | 'opencode' | 'gemini'; autoDetect?: boolean }
}): AppConfig => ({
  host: nested.credentials.host,
  username: nested.credentials.username,
  password: nested.credentials.password,
  aiTool: nested.ai?.tool,
  aiAutoDetect: nested.ai?.autoDetect ?? true,
})
