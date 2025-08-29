import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { GerritCredentials } from '@/schemas/gerrit'
import type { AiConfig, AppConfig } from '@/schemas/config'
import { migrateFromNestedConfig, aiConfigFromFlat } from '@/schemas/config'

// Use a temporary test directory
const TEST_HOME = path.join(
  os.tmpdir(),
  'ger-test-config-' + Math.random().toString(36).substring(7),
)
const TEST_CONFIG_DIR = path.join(TEST_HOME, '.ger')
const TEST_CONFIG_FILE = path.join(TEST_CONFIG_DIR, 'config.json')

// Simple test service that mimics the config service functionality
class TestConfigService {
  private configDir = TEST_CONFIG_DIR
  private configFile = TEST_CONFIG_FILE

  constructor() {
    this.ensureConfigDir()
  }

  private ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 })
    }
  }

  private readFileConfig(): unknown | null {
    try {
      if (fs.existsSync(this.configFile)) {
        const content = fs.readFileSync(this.configFile, 'utf8')
        const parsed = JSON.parse(content)

        // Check if this is the old nested format and migrate if needed
        if (parsed && typeof parsed === 'object' && 'credentials' in parsed) {
          // Migrate from nested format to flat format with validation
          const migrated = migrateFromNestedConfig(parsed)

          // Save the migrated config immediately
          try {
            this.writeFileConfig(migrated)
          } catch {
            // If write fails, still return the migrated config
          }

          return migrated
        }

        return parsed
      }
    } catch {
      // Ignore errors
    }
    return null
  }

  private writeFileConfig(config: AppConfig): void {
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8')
    fs.chmodSync(this.configFile, 0o600)
  }

  async getFullConfig(): Promise<AppConfig> {
    const fileContent = this.readFileConfig()
    if (!fileContent) {
      throw new Error('Configuration not found. Run "ger setup" to set up your credentials.')
    }

    // Simple validation - would use Schema in real implementation
    const config = fileContent as AppConfig
    if (!config.host || !config.username || !config.password) {
      throw new Error('Invalid configuration format')
    }

    return config
  }

  async saveFullConfig(config: AppConfig): Promise<void> {
    // Simple validation - would use Schema in real implementation
    if (!config.host || !config.username || !config.password) {
      throw new Error('Invalid configuration format')
    }

    this.writeFileConfig(config)
  }

  async getCredentials(): Promise<GerritCredentials> {
    const config = await this.getFullConfig()
    return {
      host: config.host,
      username: config.username,
      password: config.password,
    }
  }

  async saveCredentials(credentials: GerritCredentials): Promise<void> {
    // Get existing config or create new one
    let existingConfig: AppConfig
    try {
      existingConfig = await this.getFullConfig()
    } catch {
      existingConfig = {
        host: credentials.host,
        username: credentials.username,
        password: credentials.password,
        aiAutoDetect: true,
      }
    }

    // Update credentials in flat config
    const updatedConfig: AppConfig = {
      ...existingConfig,
      host: credentials.host,
      username: credentials.username,
      password: credentials.password,
    }

    await this.saveFullConfig(updatedConfig)
  }

  async getAiConfig(): Promise<AiConfig> {
    const config = await this.getFullConfig()
    return aiConfigFromFlat(config)
  }

  async saveAiConfig(aiConfig: AiConfig): Promise<void> {
    const existingConfig = await this.getFullConfig()

    // Update AI config in flat structure
    const updatedConfig: AppConfig = {
      ...existingConfig,
      aiTool: aiConfig.tool,
      aiAutoDetect: aiConfig.autoDetect,
    }

    await this.saveFullConfig(updatedConfig)
  }

  cleanup() {
    if (fs.existsSync(TEST_HOME)) {
      fs.rmSync(TEST_HOME, { recursive: true, force: true })
    }
  }
}

describe('ConfigService Integration Tests', () => {
  let configService: TestConfigService

  beforeEach(() => {
    configService = new TestConfigService()
  })

  afterEach(() => {
    configService.cleanup()
  })

  describe('Flat Configuration', () => {
    test('saves and loads flat config', async () => {
      const testConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude',
        aiAutoDetect: true,
      }

      // Save config
      await configService.saveFullConfig(testConfig)

      // Verify file was created
      expect(fs.existsSync(TEST_CONFIG_FILE)).toBe(true)

      // Load config
      const loadedConfig = await configService.getFullConfig()
      expect(loadedConfig).toEqual(testConfig)
    })

    test('migrates nested config to flat config automatically', async () => {
      const nestedConfig = {
        credentials: {
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass123',
        },
        ai: {
          tool: 'claude',
          autoDetect: false,
        },
      }

      const expectedFlatConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude',
        aiAutoDetect: false,
      }

      // Write nested config directly to file
      fs.writeFileSync(TEST_CONFIG_FILE, JSON.stringify(nestedConfig, null, 2), 'utf8')

      // Load config (should trigger migration)
      const loadedConfig = await configService.getFullConfig()
      expect(loadedConfig).toEqual(expectedFlatConfig)

      // Verify migration was written back to file
      const fileContent = JSON.parse(fs.readFileSync(TEST_CONFIG_FILE, 'utf8'))
      expect(fileContent).toEqual(expectedFlatConfig)
    })

    test('handles migration from nested config without AI section', async () => {
      const nestedConfig = {
        credentials: {
          host: 'https://gerrit.example.com',
          username: 'testuser',
          password: 'testpass123',
        },
      }

      const expectedFlatConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiAutoDetect: true, // default value
      }

      // Write nested config directly to file
      fs.writeFileSync(TEST_CONFIG_FILE, JSON.stringify(nestedConfig, null, 2), 'utf8')

      const loadedConfig = await configService.getFullConfig()
      expect(loadedConfig).toEqual(expectedFlatConfig)
    })
  })

  describe('Credentials Management', () => {
    test('extracts credentials from flat config', async () => {
      const testConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiAutoDetect: true,
      }

      await configService.saveFullConfig(testConfig)
      const credentials = await configService.getCredentials()

      expect(credentials).toEqual({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
      })
    })

    test('saves credentials by updating flat config', async () => {
      const existingConfig: AppConfig = {
        host: 'https://old-gerrit.com',
        username: 'olduser',
        password: 'oldpass',
        aiTool: 'llm',
        aiAutoDetect: false,
      }

      const newCredentials: GerritCredentials = {
        host: 'https://new-gerrit.com',
        username: 'newuser',
        password: 'newpass',
      }

      const expectedConfig: AppConfig = {
        host: 'https://new-gerrit.com',
        username: 'newuser',
        password: 'newpass',
        aiTool: 'llm', // preserved
        aiAutoDetect: false, // preserved
      }

      await configService.saveFullConfig(existingConfig)
      await configService.saveCredentials(newCredentials)

      const updatedConfig = await configService.getFullConfig()
      expect(updatedConfig).toEqual(expectedConfig)
    })

    test('creates new flat config when saving credentials to empty config', async () => {
      const newCredentials: GerritCredentials = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
      }

      const expectedConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
        aiAutoDetect: true, // default
      }

      await configService.saveCredentials(newCredentials)

      const savedConfig = await configService.getFullConfig()
      expect(savedConfig).toEqual(expectedConfig)
    })
  })

  describe('AI Configuration Management', () => {
    test('extracts AI config from flat config', async () => {
      const testConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude',
        aiAutoDetect: false,
      }

      await configService.saveFullConfig(testConfig)
      const aiConfig = await configService.getAiConfig()

      expect(aiConfig).toEqual({
        tool: 'claude',
        autoDetect: false,
      })
    })

    test('provides default AI config when fields are undefined', async () => {
      const testConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiAutoDetect: true, // required field
        // aiTool undefined
      }

      await configService.saveFullConfig(testConfig)
      const aiConfig = await configService.getAiConfig()

      expect(aiConfig).toEqual({
        tool: undefined,
        autoDetect: true,
      })
    })

    test('saves AI config by updating flat config', async () => {
      const existingConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'claude',
        aiAutoDetect: true,
      }

      const newAiConfig: AiConfig = {
        tool: 'llm',
        autoDetect: false,
      }

      const expectedConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiTool: 'llm',
        aiAutoDetect: false,
      }

      await configService.saveFullConfig(existingConfig)
      await configService.saveAiConfig(newAiConfig)

      const updatedConfig = await configService.getFullConfig()
      expect(updatedConfig).toEqual(expectedConfig)
    })
  })

  describe('Error Handling', () => {
    test('throws error when no config file exists', async () => {
      await expect(configService.getFullConfig()).rejects.toThrow(
        'Configuration not found. Run "ger setup" to set up your credentials.',
      )
    })

    test('throws error for invalid config schema', async () => {
      const invalidConfig = {
        host: 'https://gerrit.example.com',
        // missing username and password
      }

      fs.writeFileSync(TEST_CONFIG_FILE, JSON.stringify(invalidConfig, null, 2), 'utf8')

      await expect(configService.getFullConfig()).rejects.toThrow('Invalid configuration format')
    })
  })

  describe('File System Operations', () => {
    test('creates config directory with correct permissions', async () => {
      const testConfig: AppConfig = {
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass123',
        aiAutoDetect: true,
      }

      await configService.saveFullConfig(testConfig)

      // Verify directory exists
      expect(fs.existsSync(TEST_CONFIG_DIR)).toBe(true)

      // Verify file has restrictive permissions (600)
      const stats = fs.statSync(TEST_CONFIG_FILE)
      const mode = stats.mode & parseInt('777', 8)
      expect(mode).toBe(parseInt('600', 8))
    })
  })
})
