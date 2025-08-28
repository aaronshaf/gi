import { Effect } from 'effect'
import type { ConfigServiceImpl } from '@/services/config'
import type { GerritCredentials } from '@/schemas/gerrit'
import type { AiConfig, AppConfig } from '@/schemas/config'

export const createMockConfigService = (
  credentials: GerritCredentials = {
    host: 'https://test.gerrit.com',
    username: 'testuser',
    password: 'testpass',
  },
  aiConfig: AiConfig = { autoDetect: true },
): ConfigServiceImpl => ({
  getCredentials: Effect.succeed(credentials),
  saveCredentials: () => Effect.succeed(undefined as void),
  deleteCredentials: Effect.succeed(undefined as void),
  getAiConfig: Effect.succeed(aiConfig),
  saveAiConfig: () => Effect.succeed(undefined as void),
  getFullConfig: Effect.succeed({
    credentials,
    ai: aiConfig,
  } as AppConfig),
  saveFullConfig: () => Effect.succeed(undefined as void),
})
