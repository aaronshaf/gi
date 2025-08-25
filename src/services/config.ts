import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { GerritCredentials } from '@/schemas/gerrit'

export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly getCredentials: Effect.Effect<GerritCredentials, ConfigError>
    readonly saveCredentials: (credentials: GerritCredentials) => Effect.Effect<void, ConfigError>
    readonly deleteCredentials: Effect.Effect<void, ConfigError>
  }
>() {}

export class ConfigError extends Schema.TaggedError<ConfigError>()('ConfigError', {
  message: Schema.String,
}) {}

// File-based storage
const CONFIG_DIR = path.join(os.homedir(), '.ger')
const CONFIG_FILE = path.join(CONFIG_DIR, 'auth.json')

const readFileConfig = (): GerritCredentials | null => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8')
      return JSON.parse(content)
    }
  } catch (e) {
    // Ignore errors
  }
  return null
}

const writeFileConfig = (credentials: GerritCredentials): void => {
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(credentials, null, 2), 'utf8')
  // Set restrictive permissions
  fs.chmodSync(CONFIG_FILE, 0o600)
}

const deleteFileConfig = (): void => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE)
    }
  } catch (e) {
    // Ignore errors
  }
}

export const ConfigServiceLive: Layer.Layer<ConfigService, never, never> = Layer.effect(
  ConfigService,
  Effect.sync(() => {
    const getCredentials = Effect.gen(function* () {
      // Use file-based config
      const fileConfig = readFileConfig()
      if (fileConfig) {
        return yield* Schema.decodeUnknown(GerritCredentials)(fileConfig).pipe(
          Effect.mapError(() => new ConfigError({ message: 'Invalid stored credentials format' })),
        )
      }

      // No credentials found
      yield* Effect.fail(
        new ConfigError({
          message: 'Credentials not found. Run "ger init" to set up your credentials.',
        }),
      )
    })

    const saveCredentials = (credentials: GerritCredentials) =>
      Effect.gen(function* () {
        // Validate credentials using schema
        const validatedCredentials = yield* Schema.decodeUnknown(GerritCredentials)(
          credentials,
        ).pipe(Effect.mapError(() => new ConfigError({ message: 'Invalid credentials format' })))

        // Use file-based storage
        try {
          writeFileConfig(validatedCredentials)
        } catch (e) {
          yield* Effect.fail(new ConfigError({ message: 'Failed to save credentials to file' }))
        }
      })

    const deleteCredentials = Effect.gen(function* () {
      // Delete file config
      try {
        deleteFileConfig()
      } catch (e) {
        // Ignore errors
      }
    })

    return {
      getCredentials,
      saveCredentials,
      deleteCredentials,
    }
  }),
)
