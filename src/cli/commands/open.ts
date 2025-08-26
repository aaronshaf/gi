import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import { type ConfigError, ConfigService } from '@/services/config'
import { extractChangeNumber, isValidChangeId } from '@/utils/url-parser'
import { exec } from 'node:child_process'

interface OpenOptions {
  // No options for now, but keeping the structure for future extensibility
}

export const openCommand = (
  changeId: string,
  options: OpenOptions = {},
): Effect.Effect<void, ApiError | ConfigError | Error, GerritApiService | ConfigService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    const configService = yield* ConfigService

    // Extract change number if a URL was provided
    const cleanChangeId = extractChangeNumber(changeId)

    // Validate the change ID
    if (!isValidChangeId(cleanChangeId)) {
      yield* Effect.fail(new Error(`Invalid change ID: ${cleanChangeId}`))
    }

    // Fetch change details to get the project name
    const change = yield* gerritApi.getChange(cleanChangeId)

    // Get the Gerrit host from config
    const credentials = yield* configService.getCredentials
    const gerritHost = credentials.host

    const changeUrl = `${gerritHost}/c/${change.project}/+/${change._number}`

    // Open the URL in the default browser
    const openCmd =
      process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'

    yield* Effect.promise(
      () =>
        new Promise<void>((resolve, reject) => {
          exec(`${openCmd} "${changeUrl}"`, (error) => {
            if (error) {
              reject(new Error(`Failed to open URL: ${error.message}`))
            } else {
              resolve()
            }
          })
        }),
    )

    console.log(`Opened: ${changeUrl}`)
  })
