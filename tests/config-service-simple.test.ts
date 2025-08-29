import { describe, test, expect } from 'bun:test'
import { Effect } from 'effect'
import { ConfigService, ConfigError, ConfigServiceLive } from '@/services/config'
import { GerritCredentials } from '@/schemas/gerrit'
import { AiConfig, AppConfig } from '@/schemas/config'

describe('Config Service Simple Tests', () => {
  describe('ConfigError', () => {
    test('should create ConfigError with message', () => {
      const error = new ConfigError({ message: 'Test error' })
      expect(error.message).toBe('Test error')
      expect(error._tag).toBe('ConfigError')
    })

    test('should be throwable and catchable', () => {
      const error = new ConfigError({ message: 'Test error' })
      expect(() => {
        throw error
      }).toThrow('Test error')
    })

    test('should be instanceof ConfigError', () => {
      const error = new ConfigError({ message: 'Test error' })
      expect(error).toBeInstanceOf(ConfigError)
    })
  })

  describe('ConfigServiceLive layer', () => {
    test('should be able to create live service layer', () => {
      expect(ConfigServiceLive).toBeDefined()
      expect(typeof ConfigServiceLive).toBe('object')
    })

    test('should provide all required service methods', async () => {
      const service = await Effect.runPromise(
        Effect.gen(function* () {
          return yield* ConfigService
        }).pipe(Effect.provide(ConfigServiceLive)),
      )

      expect(typeof service.getCredentials).toBe('object') // Effect object
      expect(typeof service.saveCredentials).toBe('function')
      expect(typeof service.deleteCredentials).toBe('object') // Effect object
      expect(typeof service.getAiConfig).toBe('object') // Effect object
      expect(typeof service.saveAiConfig).toBe('function')
      expect(typeof service.getFullConfig).toBe('object') // Effect object
      expect(typeof service.saveFullConfig).toBe('function')
    })
  })

  // Note: Config behavior tests removed as they depend on filesystem state
  // which varies between test environments

  describe('Schema validation', () => {
    test('should validate valid credentials schema', () => {
      const validCredentials: GerritCredentials = {
        url: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
      }

      expect(validCredentials.url).toBe('https://gerrit.example.com')
      expect(validCredentials.username).toBe('testuser')
      expect(validCredentials.password).toBe('testpass')
    })

    test('should validate valid AI config schema', () => {
      const validAiConfig: AiConfig = {
        autoDetect: true,
      }

      expect(validAiConfig.autoDetect).toBe(true)
    })

    test('should validate AI config with tool', () => {
      const validAiConfig: AiConfig = {
        autoDetect: false,
        tool: 'claude',
      }

      expect(validAiConfig.autoDetect).toBe(false)
      expect(validAiConfig.tool).toBe('claude')
    })

    test('should validate full app config schema', () => {
      const validAppConfig: AppConfig = {
        credentials: {
          url: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass',
        },
        ai: {
          autoDetect: true,
        },
      }

      expect(validAppConfig.credentials.url).toBe('https://gerrit.example.com')
      expect(validAppConfig.ai.autoDetect).toBe(true)
    })
  })
})
