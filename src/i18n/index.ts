import { Effect } from 'effect'
import i18next from 'i18next'

// Translation resources
import en from './locales/en.json'

export const initI18n = Effect.tryPromise({
  try: async () => {
    await i18next.init({
      lng: 'en', // Default language
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // React already escapes by default
      },
      resources: {
        en: {
          translation: en,
        },
      },
    })
    return i18next
  },
  catch: () => new Error('Failed to initialize i18n system'),
})

export const t: (key: string, options?: Record<string, unknown>) => string = (
  key: string,
  options?: Record<string, unknown>,
): string => {
  const result = i18next.t(key, options)
  return typeof result === 'string' ? result : String(result)
}

export const changeLanguage = (lng: string) =>
  Effect.tryPromise({
    try: async () => {
      await i18next.changeLanguage(lng)
      return lng
    },
    catch: () => new Error('Failed to change language settings'),
  })

export { i18next }
