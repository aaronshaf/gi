import { Effect } from 'effect'
import { GerritApiService } from '@/api/gerrit'

interface StatusOptions {
  pretty?: boolean
}

export const statusCommand = (options: StatusOptions) =>
  Effect.gen(function* () {
    const apiService = yield* GerritApiService
    
    const isConnected = yield* apiService.testConnection
    
    if (options.pretty) {
      if (isConnected) {
        console.log('✓ Connected to Gerrit successfully!')
      } else {
        console.log('✗ Failed to connect to Gerrit')
        console.log('Please check your credentials and network connection')
      }
    } else {
      // XML output for LLM consumption
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<status_result>`)
      console.log(`  <connected>${isConnected}</connected>`)
      console.log(`</status_result>`)
    }
    
    if (!isConnected) {
      yield* Effect.fail(new Error('Connection failed'))
    }
  })
