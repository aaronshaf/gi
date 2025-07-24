import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import * as keytar from 'keytar'
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

const SERVICE_NAME = 'gerrit-cli'
const ACCOUNT_HOST = 'host'
const ACCOUNT_USERNAME = 'username'
const ACCOUNT_PASSWORD = 'password'

export const ConfigServiceLive: Layer.Layer<ConfigService, never, never> = Layer.effect(
  ConfigService,
  Effect.sync(() => {
    const getCredentials = Effect.gen(function* () {
      const host = yield* Effect.tryPromise({
        try: () => keytar.getPassword(SERVICE_NAME, ACCOUNT_HOST),
        catch: () => new ConfigError({ message: 'Failed to retrieve host from secure storage' }),
      })

      const username = yield* Effect.tryPromise({
        try: () => keytar.getPassword(SERVICE_NAME, ACCOUNT_USERNAME),
        catch: () =>
          new ConfigError({ message: 'Failed to retrieve username from secure storage' }),
      })

      const password = yield* Effect.tryPromise({
        try: () => keytar.getPassword(SERVICE_NAME, ACCOUNT_PASSWORD),
        catch: () =>
          new ConfigError({ message: 'Failed to retrieve password from secure storage' }),
      })

      if (!host || !username || !password) {
        yield* Effect.fail(
          new ConfigError({
            message: 'Credentials not found. Run "gi init" to set up your credentials.',
          }),
        )
      }

      // Validate retrieved credentials
      const credentials = { host, username, password }
      return yield* Schema.decodeUnknown(GerritCredentials)(credentials).pipe(
        Effect.mapError(() => new ConfigError({ message: 'Invalid stored credentials format' })),
      )
    })

    const saveCredentials = (credentials: GerritCredentials) =>
      Effect.gen(function* () {
        // Validate credentials using schema
        const validatedCredentials = yield* Schema.decodeUnknown(GerritCredentials)(
          credentials,
        ).pipe(Effect.mapError(() => new ConfigError({ message: 'Invalid credentials format' })))

        // Store each component separately in keychain
        yield* Effect.tryPromise({
          try: () => keytar.setPassword(SERVICE_NAME, ACCOUNT_HOST, validatedCredentials.host),
          catch: () => new ConfigError({ message: 'Failed to store host in secure storage' }),
        })

        yield* Effect.tryPromise({
          try: () =>
            keytar.setPassword(SERVICE_NAME, ACCOUNT_USERNAME, validatedCredentials.username),
          catch: () => new ConfigError({ message: 'Failed to store username in secure storage' }),
        })

        yield* Effect.tryPromise({
          try: () =>
            keytar.setPassword(SERVICE_NAME, ACCOUNT_PASSWORD, validatedCredentials.password),
          catch: () => new ConfigError({ message: 'Failed to store password in secure storage' }),
        })
      })

    const deleteCredentials = Effect.gen(function* () {
      // Delete each component, ignoring errors if entries don't exist
      yield* Effect.tryPromise({
        try: () => keytar.deletePassword(SERVICE_NAME, ACCOUNT_HOST),
        catch: () => new ConfigError({ message: 'Failed to delete host from keychain' }),
      }).pipe(Effect.catchAll(() => Effect.void))

      yield* Effect.tryPromise({
        try: () => keytar.deletePassword(SERVICE_NAME, ACCOUNT_USERNAME),
        catch: () => new ConfigError({ message: 'Failed to delete username from keychain' }),
      }).pipe(Effect.catchAll(() => Effect.void))

      yield* Effect.tryPromise({
        try: () => keytar.deletePassword(SERVICE_NAME, ACCOUNT_PASSWORD),
        catch: () => new ConfigError({ message: 'Failed to delete password from keychain' }),
      }).pipe(Effect.catchAll(() => Effect.void))
    })

    return {
      getCredentials,
      saveCredentials,
      deleteCredentials,
    }
  }),
)
