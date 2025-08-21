import { Effect } from 'effect'
import { GerritApiService } from '@/api/gerrit'
import type { DiffOptions } from '@/schemas/gerrit'

interface DiffCommandOptions {
  pretty?: boolean
  file?: string
  filesOnly?: boolean
  format?: 'unified' | 'json' | 'files'
}

export const diffCommand = (
  changeId: string,
  options: DiffCommandOptions,
) =>
  Effect.gen(function* () {
    const apiService = yield* GerritApiService
    
    const diffOptions: DiffOptions = {
      format: options.filesOnly ? 'files' : options.format || 'unified',
      file: options.file,
    }
    
    const diff = yield* apiService.getDiff(changeId, diffOptions).pipe(
      Effect.catchTag('ApiError', (error) =>
        Effect.fail(new Error(`Failed to get diff: ${error.message}`))
      )
    )
    
    if (options.pretty) {
      // Human-readable output
      if (Array.isArray(diff)) {
        console.log('Changed files:')
        diff.forEach(file => console.log(`  - ${file}`))
      } else if (typeof diff === 'string') {
        console.log(diff)
      } else {
        console.log(JSON.stringify(diff, null, 2))
      }
    } else {
      // XML output for LLM consumption
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<diff_result>`)
      console.log(`  <status>success</status>`)
      console.log(`  <change_id>${changeId}</change_id>`)
      
      if (Array.isArray(diff)) {
        console.log(`  <files>`)
        diff.forEach(file => {
          console.log(`    <file>${file}</file>`)
        })
        console.log(`  </files>`)
      } else if (typeof diff === 'string') {
        console.log(`  <content><![CDATA[${diff}]]></content>`)
      } else {
        console.log(`  <content><![CDATA[${JSON.stringify(diff, null, 2)}]]></content>`)
      }
      
      console.log(`</diff_result>`)
    }
  })
