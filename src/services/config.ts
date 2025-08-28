import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import { GerritCredentials } from '@/schemas/gerrit'
import { AiConfig, AppConfig, LegacyConfig } from '@/schemas/config'

export interface ConfigServiceImpl {
  readonly getCredentials: Effect.Effect<GerritCredentials, ConfigError>
  readonly saveCredentials: (credentials: GerritCredentials) => Effect.Effect<void, ConfigError>
  readonly deleteCredentials: Effect.Effect<void, ConfigError>
  readonly getAiConfig: Effect.Effect<AiConfig, ConfigError>
  readonly saveAiConfig: (config: AiConfig) => Effect.Effect<void, ConfigError>
  readonly getFullConfig: Effect.Effect<AppConfig, ConfigError>
  readonly saveFullConfig: (config: AppConfig) => Effect.Effect<void, ConfigError>
}

export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  ConfigServiceImpl
>() {}

export class ConfigError extends Schema.TaggedError<ConfigError>()('ConfigError', {
  message: Schema.String,
} as const) {}

// File-based storage
const CONFIG_DIR = path.join(os.homedir(), '.gi')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const LEGACY_CONFIG_DIR = path.join(os.homedir(), '.ger')
const LEGACY_CONFIG_FILE = path.join(LEGACY_CONFIG_DIR, 'auth.json')

// Helper to migrate legacy config if exists
const migrateLegacyConfig = (): void => {
  try {
    if (fs.existsSync(LEGACY_CONFIG_FILE) && !fs.existsSync(CONFIG_FILE)) {
      const legacyContent = fs.readFileSync(LEGACY_CONFIG_FILE, 'utf8')
      const legacyConfig = JSON.parse(legacyContent)

      // Create new config with legacy credentials
      const newConfig: AppConfig = {
        credentials: legacyConfig,
        ai: { autoDetect: true },
      }

      // Ensure new config directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
      }

      // Write new config
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8')
      fs.chmodSync(CONFIG_FILE, 0o600)

      // Remove legacy config
      fs.unlinkSync(LEGACY_CONFIG_FILE)

      // Remove legacy directory if empty
      const legacyDirContents = fs.readdirSync(LEGACY_CONFIG_DIR)
      if (legacyDirContents.length === 0) {
        fs.rmdirSync(LEGACY_CONFIG_DIR)
      }
    }
  } catch {
    // Ignore migration errors
  }
}

const readFileConfig = (): unknown | null => {
  try {
    // First attempt migration
    migrateLegacyConfig()

    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8')
      return JSON.parse(content)
    }
  } catch {
    // Ignore errors
  }
  return null
}

const writeFileConfig = (config: AppConfig): void => {
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
  // Set restrictive permissions
  fs.chmodSync(CONFIG_FILE, 0o600)
}

const deleteFileConfig = (): void => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE)
    }
  } catch {
    // Ignore errors
  }
}

export const ConfigServiceLive: Layer.Layer<ConfigService, never, never> = Layer.effect(
  ConfigService,
  Effect.sync(() => {
    const getFullConfig = Effect.gen(function* () {
      const fileContent = readFileConfig()
      if (!fileContent) {
        return yield* Effect.fail(
          new ConfigError({
            message: 'Configuration not found. Run "gi setup" to set up your credentials.',
          }),
        )
      }

      // Try to parse as full config first
      const fullConfigResult = yield* Schema.decodeUnknown(AppConfig)(fileContent).pipe(
        Effect.either,
      )

      if (fullConfigResult._tag === 'Right') {
        return fullConfigResult.right
      }

      // Try legacy format (just credentials)
      const legacyResult = yield* Schema.decodeUnknown(LegacyConfig)(fileContent).pipe(
        Effect.either,
      )

      if (legacyResult._tag === 'Right') {
        // Convert legacy to full config
        const fullConfig: AppConfig = {
          credentials: legacyResult.right,
          ai: { autoDetect: true },
        }
        // Save the upgraded config
        writeFileConfig(fullConfig)
        return fullConfig
      }

      return yield* Effect.fail(new ConfigError({ message: 'Invalid configuration format' }))
    })

    const saveFullConfig = (config: AppConfig) =>
      Effect.gen(function* () {
        // Validate config using schema
        const validatedConfig = yield* Schema.decodeUnknown(AppConfig)(config).pipe(
          Effect.mapError(() => new ConfigError({ message: 'Invalid configuration format' })),
        )

        try {
          writeFileConfig(validatedConfig)
        } catch {
          yield* Effect.fail(new ConfigError({ message: 'Failed to save configuration to file' }))
        }
      })

    const getCredentials = Effect.gen(function* () {
      const config = yield* getFullConfig
      return config.credentials
    })

    const saveCredentials = (credentials: GerritCredentials) =>
      Effect.gen(function* () {
        // Validate credentials using schema
        const validatedCredentials = yield* Schema.decodeUnknown(GerritCredentials)(
          credentials,
        ).pipe(Effect.mapError(() => new ConfigError({ message: 'Invalid credentials format' })))

        // Get existing config or create new one
        const existingConfig = yield* getFullConfig.pipe(
          Effect.orElseSucceed(
            () => ({ credentials: validatedCredentials, ai: { autoDetect: true } }) as AppConfig,
          ),
        )

        // Update credentials in config
        const updatedConfig: AppConfig = {
          ...existingConfig,
          credentials: validatedCredentials,
        }

        yield* saveFullConfig(updatedConfig)
      })

    const deleteCredentials = Effect.gen(function* () {
      try {
        deleteFileConfig()
        yield* Effect.void
      } catch {
        // Ignore errors
        yield* Effect.void
      }
    })

    const getAiConfig = Effect.gen(function* () {
      const config = yield* getFullConfig
      return config.ai || { autoDetect: true }
    })

    const saveAiConfig = (aiConfig: AiConfig) =>
      Effect.gen(function* () {
        // Validate AI config using schema
        const validatedAiConfig = yield* Schema.decodeUnknown(AiConfig)(aiConfig).pipe(
          Effect.mapError(() => new ConfigError({ message: 'Invalid AI configuration format' })),
        )

        // Get existing config
        const existingConfig = yield* getFullConfig

        // Update AI config
        const updatedConfig: AppConfig = {
          ...existingConfig,
          ai: validatedAiConfig,
        }

        yield* saveFullConfig(updatedConfig)
      })

    return {
      getCredentials,
      saveCredentials,
      deleteCredentials,
      getAiConfig,
      saveAiConfig,
      getFullConfig,
      saveFullConfig,
    }
  }),
)
