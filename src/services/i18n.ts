import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import { changeLanguage, initI18n, t as translate } from '@/i18n'

export class I18nService extends Context.Tag('I18nService')<
  I18nService,
  {
    readonly t: (key: string, options?: Record<string, unknown>) => string
    readonly changeLanguage: (lng: string) => Effect.Effect<void, I18nError>
    readonly getCurrentLanguage: Effect.Effect<string, never>
  }
>() {}

export class I18nError extends Schema.TaggedError<I18nError>()('I18nError', {
  message: Schema.String,
}) {}

export const I18nServiceLive = Layer.effect(
  I18nService,
  Effect.gen(function* () {
    // Initialize i18n
    yield* initI18n

    const t = (key: string, options?: Record<string, unknown>): string => {
      return translate(key, options)
    }

    const changeLanguageEffect = (lng: string) =>
      changeLanguage(lng).pipe(
        Effect.mapError((error) => new I18nError({ message: error.message })),
      )

    const getCurrentLanguage = Effect.sync(() => {
      // Assuming i18next instance is available
      return 'en' // Default for now
    })

    return {
      t,
      changeLanguage: changeLanguageEffect,
      getCurrentLanguage,
    }
  }),
)
