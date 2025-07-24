import React, { useState } from 'react'
import { Box, Text, useApp } from 'ink'
import TextInput from 'ink-text-input'
import Spinner from 'ink-spinner'
import { Effect, pipe } from 'effect'
import { ConfigError } from '@/services/config'
import { GerritCredentials } from '@/schemas/gerrit'

type Step = 'host' | 'username' | 'password' | 'saving' | 'done' | 'error'

interface InitCommandProps {
  readonly saveCredentials: (credentials: GerritCredentials) => Effect.Effect<void, ConfigError>
}

export const InitCommand: React.FC<InitCommandProps> = ({ saveCredentials }) => {
  useApp()
  const [step, setStep] = useState<Step>('host')
  const [credentials, setCredentials] = useState({
    host: '',
    username: '',
    password: '',
  })
  const [error, setError] = useState<string>('')

  const setHost = (value: string) => setCredentials({ ...credentials, host: value })
  const setUsername = (value: string) => setCredentials({ ...credentials, username: value })
  const setPassword = (value: string) => setCredentials({ ...credentials, password: value })

  const handleHostSubmit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Host URL is required')
      return
    }
    
    const urlPattern = /^https?:\/\/.+$/
    if (!urlPattern.test(trimmed)) {
      setError('Invalid URL format. Must start with http:// or https://')
      return
    }

    setCredentials({ ...credentials, host: trimmed })
    setError('')
    setStep('username')
  }

  const handleUsernameSubmit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Username is required')
      return
    }

    setCredentials({ ...credentials, username: trimmed })
    setError('')
    setStep('password')
  }

  const handlePasswordSubmit = (value: string) => {
    if (!value) {
      setError('Password is required')
      return
    }

    setCredentials({ ...credentials, password: value })
    setError('')
    setStep('saving')

    // Save credentials
    Effect.runPromise(
      pipe(
        saveCredentials({
          host: credentials.host,
          username: credentials.username,
          password: value,
        }),
        Effect.map(() => setStep('done')),
        Effect.catchTag('ConfigError', (e) => {
          setError(e.message)
          setStep('error')
          return Effect.void
        }),
      ),
    )
  }

  if (step === 'done') {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Credentials saved successfully!</Text>
        <Text dimColor>You can now use "ger" commands to interact with Gerrit.</Text>
      </Box>
    )
  }

  if (step === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Error: {error}</Text>
      </Box>
    )
  }

  if (step === 'saving') {
    return (
      <Box>
        <Text>
          <Spinner type="dots" /> Saving credentials...
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>Gerrit CLI Setup</Text>
      <Text dimColor>Enter your Gerrit server credentials:</Text>
      <Box marginTop={1} />

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {step === 'host' && (
        <Box>
          <Text>Host URL: </Text>
          <TextInput
            value={credentials.host}
            placeholder="https://gerrit.example.com"
            onChange={setHost}
            onSubmit={handleHostSubmit}
          />
        </Box>
      )}

      {step === 'username' && (
        <Box>
          <Text>Username: </Text>
          <TextInput
            value={credentials.username}
            placeholder="your-username"
            onChange={setUsername}
            onSubmit={handleUsernameSubmit}
          />
        </Box>
      )}

      {step === 'password' && (
        <Box>
          <Text>HTTP Password: </Text>
          <TextInput
            value={credentials.password}
            placeholder="your-http-password"
            mask="*"
            onChange={setPassword}
            onSubmit={handlePasswordSubmit}
          />
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {step === 'host' && 'Enter your Gerrit server URL'}
          {step === 'username' && 'Enter your Gerrit username'}
          {step === 'password' && 'Enter your HTTP password (found in Settings > HTTP Credentials)'}
        </Text>
      </Box>
    </Box>
  )
}