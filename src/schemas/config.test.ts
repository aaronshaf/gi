import { describe, expect, test } from 'bun:test'
import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import { AppConfig, AiConfig, aiConfigFromFlat, migrateFromNestedConfig } from './config'

describe('Config Schemas', () => {
  describe('AppConfig (Flat Structure)', () => {
    test('validates complete flat config', () => {
      const validConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude' as const,
        aiAutoDetect: true,
      }

      const result = Schema.decodeUnknownSync(AppConfig)(validConfig)
      expect(result).toEqual(validConfig)
    })

    test('validates minimal flat config with defaults', () => {
      const minimalConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
      }

      const result = Schema.decodeUnknownSync(AppConfig)(minimalConfig)
      expect(result).toEqual({
        ...minimalConfig,
        aiAutoDetect: true, // default value
        aiTool: undefined,
      })
    })

    test('rejects invalid host URL', () => {
      const invalidConfig = {
        host: 'not-a-url',
        username: 'testuser',
        password: 'testpass123',
      }

      expect(() => Schema.decodeUnknownSync(AppConfig)(invalidConfig)).toThrow()
    })

    test('rejects empty username', () => {
      const invalidConfig = {
        host: 'https://gerrit.example.com',
        username: '',
        password: 'testpass123',
      }

      expect(() => Schema.decodeUnknownSync(AppConfig)(invalidConfig)).toThrow()
    })

    test('rejects empty password', () => {
      const invalidConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: '',
      }

      expect(() => Schema.decodeUnknownSync(AppConfig)(invalidConfig)).toThrow()
    })

    test('validates all AI tool options', () => {
      const tools = ['claude', 'llm', 'opencode', 'gemini'] as const

      tools.forEach((tool) => {
        const config = {
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass123',
          aiTool: tool,
        }

        const result = Schema.decodeUnknownSync(AppConfig)(config)
        expect(result.aiTool).toBe(tool)
      })
    })

    test('rejects invalid AI tool', () => {
      const invalidConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'invalid-tool',
      }

      expect(() => Schema.decodeUnknownSync(AppConfig)(invalidConfig)).toThrow()
    })
  })

  describe('Legacy AiConfig (Backward Compatibility)', () => {
    test('validates legacy AI config structure', () => {
      const validAiConfig = {
        tool: 'claude' as const,
        autoDetect: false,
      }

      const result = Schema.decodeUnknownSync(AiConfig)(validAiConfig)
      expect(result).toEqual(validAiConfig)
    })

    test('validates minimal legacy AI config with defaults', () => {
      const minimalAiConfig = {}

      const result = Schema.decodeUnknownSync(AiConfig)(minimalAiConfig)
      expect(result).toEqual({
        autoDetect: true, // default value
        tool: undefined,
      })
    })
  })

  describe('Helper Functions', () => {
    test('aiConfigFromFlat converts flat config to legacy AI config', () => {
      const flatConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude' as const,
        aiAutoDetect: false,
      }

      const aiConfig = aiConfigFromFlat(flatConfig)
      expect(aiConfig).toEqual({
        tool: 'claude',
        autoDetect: false,
      })
    })

    test('aiConfigFromFlat handles undefined AI options', () => {
      const flatConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiAutoDetect: true,
      }

      const aiConfig = aiConfigFromFlat(flatConfig)
      expect(aiConfig).toEqual({
        tool: undefined,
        autoDetect: true,
      })
    })

    test('migrateFromNestedConfig converts old nested format', () => {
      const nestedConfig = {
        credentials: {
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass123',
        },
        ai: {
          tool: 'claude' as const,
          autoDetect: false,
        },
      }

      const flatConfig = migrateFromNestedConfig(nestedConfig)
      expect(flatConfig).toEqual({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude',
        aiAutoDetect: false,
      })
    })

    test('migrateFromNestedConfig handles missing AI config', () => {
      const nestedConfig = {
        credentials: {
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass123',
        },
      }

      const flatConfig = migrateFromNestedConfig(nestedConfig)
      expect(flatConfig).toEqual({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: undefined,
        aiAutoDetect: true, // default
      })
    })

    test('migrateFromNestedConfig handles partial AI config', () => {
      const nestedConfig = {
        credentials: {
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass123',
        },
        ai: {
          tool: 'llm' as const,
          // autoDetect missing
        },
      }

      const flatConfig = migrateFromNestedConfig(nestedConfig)
      expect(flatConfig).toEqual({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'llm',
        aiAutoDetect: true, // default when missing
      })
    })
  })

  describe('Effect Schema Integration', () => {
    test('Effect.gen with valid flat config', async () => {
      const config = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude' as const,
        aiAutoDetect: true,
      }

      const result = await Effect.gen(function* () {
        return yield* Schema.decodeUnknown(AppConfig)(config)
      }).pipe(Effect.runPromise)

      expect(result).toEqual(config)
    })

    test('Effect.gen with validation error', async () => {
      const invalidConfig = {
        host: 'not-a-url',
        username: 'testuser',
        password: 'testpass123',
      }

      await expect(
        Effect.gen(function* () {
          return yield* Schema.decodeUnknown(AppConfig)(invalidConfig)
        }).pipe(Effect.runPromise),
      ).rejects.toThrow()
    })
  })
})
