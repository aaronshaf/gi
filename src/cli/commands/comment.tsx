import React, { useState, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import TextInput from 'ink-text-input'
import Spinner from 'ink-spinner'
import { Effect, pipe } from 'effect'
import { ApiError } from '@/api/gerrit'

interface CommentCommandProps {
  readonly changeId: string
  readonly message?: string
  readonly apiService: {
    readonly getChange: (changeId: string) => Effect.Effect<any, ApiError>
    readonly postReview: (changeId: string, review: any) => Effect.Effect<void, ApiError>
  }
}

type State = 'loading' | 'input' | 'posting' | 'success' | 'error'

export const CommentCommand: React.FC<CommentCommandProps> = ({
  changeId,
  message: initialMessage,
  apiService,
}) => {
  const { exit } = useApp()
  const [state, setState] = useState<State>('loading')
  const [changeInfo, setChangeInfo] = useState<string>('')
  const [message, setMessage] = useState(initialMessage || '')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (initialMessage) {
      setState('posting')
      postComment(initialMessage)
    } else {
      loadChangeInfo()
    }
  }, [])

  const loadChangeInfo = () => {
    Effect.runPromise(
      pipe(
        apiService.getChange(changeId),
        Effect.map((change) => {
          setChangeInfo(`${change.subject} (${change.status})`)
          setState('input')
        }),
        Effect.catchAll((_e: unknown) => {
          setError('Failed to load change - please check the change ID and your credentials')
          setState('error')
          return Effect.void
        }),
      ),
    )
  }

  const postComment = (commentMessage: string) => {
    setState('posting')
    
    Effect.runPromise(
      pipe(
        apiService.postReview(changeId, {
          message: commentMessage,
        }),
        Effect.map(() => {
          setState('success')
          setTimeout(() => exit(), 2000)
        }),
        Effect.catchAll((_e: unknown) => {
          setError('Failed to post comment - please check your permissions and try again')
          setState('error')
          return Effect.void
        }),
      ),
    )
  }

  const handleMessageSubmit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Comment message cannot be empty')
      return
    }

    setError('')
    postComment(trimmed)
  }

  if (state === 'loading') {
    return (
      <Box>
        <Text>
          <Spinner type="dots" /> Loading change information...
        </Text>
      </Box>
    )
  }

  if (state === 'posting') {
    return (
      <Box>
        <Text>
          <Spinner type="dots" /> Posting comment...
        </Text>
      </Box>
    )
  }

  if (state === 'success') {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Comment posted successfully!</Text>
        <Text dimColor>Change: {changeInfo}</Text>
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

  return (
    <Box flexDirection="column">
      <Text bold>Post Comment</Text>
      <Text dimColor>Change: {changeInfo}</Text>
      <Box marginTop={1} />

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <Box>
        <Text>Message: </Text>
        <TextInput
          value={message}
          placeholder="Enter your comment..."
          onChange={setMessage}
          onSubmit={handleMessageSubmit}
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Enter to post the comment, or Ctrl+C to cancel</Text>
      </Box>
    </Box>
  )
}