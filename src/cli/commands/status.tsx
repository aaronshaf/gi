import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { Effect, pipe } from 'effect'
import { ApiError } from '@/api/gerrit'
import { ConfigError } from '@/services/config'

interface StatusCommandProps {
  readonly configService: {
    readonly getCredentials: Effect.Effect<{ host: string; username: string; password: string }, ConfigError>
  }
  readonly apiService: {
    readonly testConnection: Effect.Effect<boolean, ApiError>
  }
}

type State = 'checking' | 'success' | 'error'

export const StatusCommand: React.FC<StatusCommandProps> = ({
  configService,
  apiService,
}) => {
  const [state, setState] = useState<State>('checking')
  const [configInfo, setConfigInfo] = useState<{
    host: string
    username: string
    hasCredentials: boolean
  } | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = () => {
    Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          // Check configuration
          const credentials = yield* configService.getCredentials.pipe(
            Effect.map((creds) => ({
              host: creds.host,
              username: creds.username,
              hasCredentials: true,
            })),
            Effect.catchTag('ConfigError', () =>
              Effect.succeed({
                host: 'Not configured',
                username: 'Not configured',
                hasCredentials: false,
              }),
            ),
          )

          setConfigInfo(credentials)

          if (credentials.hasCredentials) {
            // Test connection
            const connected = yield* apiService.testConnection
            setConnectionStatus(connected)
          }

          setState('success')
        }),
        Effect.catchAll((_error) => {
          setError('Status check failed - please verify your configuration')
          setState('error')
          return Effect.void
        }),
      ),
    )
  }

  if (state === 'checking') {
    return (
      <Box>
        <Text>
          <Spinner type="dots" /> Checking status...
        </Text>
      </Box>
    )
  }

  if (state === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Status check failed</Text>
        <Text dimColor>{error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>Gerrit CLI Status</Text>
      <Box marginTop={1} />

      <Box>
        <Text>Host: </Text>
        <Text color={configInfo?.hasCredentials ? 'green' : 'red'}>
          {configInfo?.host}
        </Text>
      </Box>

      <Box>
        <Text>Username: </Text>
        <Text color={configInfo?.hasCredentials ? 'green' : 'red'}>
          {configInfo?.username}
        </Text>
      </Box>

      <Box>
        <Text>Configuration: </Text>
        <Text color={configInfo?.hasCredentials ? 'green' : 'red'}>
          {configInfo?.hasCredentials ? '✓ Found' : '✗ Missing'}
        </Text>
      </Box>

      {configInfo?.hasCredentials && (
        <Box>
          <Text>Connection: </Text>
          <Text color={connectionStatus ? 'green' : 'red'}>
            {connectionStatus ? '✓ Connected' : '✗ Failed'}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {!configInfo?.hasCredentials && 'Run "ger init" to configure credentials.'}
          {configInfo?.hasCredentials && !connectionStatus && 'Check your credentials and network connection.'}
          {configInfo?.hasCredentials && connectionStatus && 'All systems operational!'}
        </Text>
      </Box>
    </Box>
  )
}