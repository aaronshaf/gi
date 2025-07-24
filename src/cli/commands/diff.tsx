import React, { useState, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import Spinner from 'ink-spinner'
import { Effect, pipe } from 'effect'
import { ApiError } from '@/api/gerrit'
import { DiffOptions } from '@/schemas/gerrit'

interface DiffCommandProps {
  readonly changeId: string
  readonly options: DiffOptions
  readonly apiService: {
    readonly getDiff: (changeId: string, options?: DiffOptions) => Effect.Effect<string | Record<string, any>, ApiError, never>
  }
}

type State = 'loading' | 'success' | 'error'

export const DiffCommand: React.FC<DiffCommandProps> = ({
  changeId,
  options,
  apiService,
}) => {
  const { exit } = useApp()
  const [state, setState] = useState<State>('loading')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    loadDiff()
  }, [])

  const loadDiff = () => {
    Effect.runPromise(
      pipe(
        apiService.getDiff(changeId, options),
        Effect.map((diffResult) => {
          if (typeof diffResult === 'string') {
            setResult(diffResult)
          } else {
            // Handle JSON output
            if (options.format === 'files' && Array.isArray(diffResult)) {
              setResult(diffResult.join('\n'))
            } else {
              setResult(JSON.stringify(diffResult, null, 2))
            }
          }
          setState('success')
          setTimeout(() => exit(), 100) // Exit after showing result
        }),
        Effect.catchAll((_e: unknown) => {
          setError('Failed to get diff - please check the change ID and your credentials')
          setState('error')
          return Effect.void
        }),
      ),
    )
  }

  if (state === 'loading') {
    return (
      <Box>
        <Text>
          <Spinner type="dots" /> Loading diff...
        </Text>
      </Box>
    )
  }

  if (state === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Error: {error}</Text>
        <Text dimColor>
          {error.includes('Configuration') && 'Try running "ger init" to set up your credentials.'}
        </Text>
      </Box>
    )
  }

  // Success state - just output the result
  return (
    <Box flexDirection="column">
      <Text>{result}</Text>
    </Box>
  )
}