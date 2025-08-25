import { Effect } from 'effect'
import React from 'react'
import { render } from 'ink'
import { GerritApiService, ApiError } from '@/api/gerrit'
import { ChangeSelector } from '@/cli/components/ChangeSelector'
import type { ChangeInfo } from '@/schemas/gerrit'

interface AbandonOptions {
  message?: string
  xml?: boolean
}

const abandonSingleChange = (changeId: string, options: AbandonOptions): Effect.Effect<void, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    
    try {
      // First get the change details to show what we're abandoning
      const change = yield* gerritApi.getChange(changeId)
      
      // Perform the abandon
      yield* gerritApi.abandonChange(changeId, options.message)
      
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<abandon_result>`)
        console.log(`  <status>success</status>`)
        console.log(`  <change_number>${change._number}</change_number>`)
        console.log(`  <subject><![CDATA[${change.subject}]]></subject>`)
        if (options.message) {
          console.log(`  <message><![CDATA[${options.message}]]></message>`)
        }
        console.log(`</abandon_result>`)
      } else {
        console.log(`✓ Abandoned change ${change._number}: ${change.subject}`)
        if (options.message) {
          console.log(`  Message: ${options.message}`)
        }
      }
    } catch {
      // If we can't get change details, still try to abandon with just the ID
      yield* gerritApi.abandonChange(changeId, options.message)
      
      if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<abandon_result>`)
        console.log(`  <status>success</status>`)
        console.log(`  <change_id>${changeId}</change_id>`)
        if (options.message) {
          console.log(`  <message><![CDATA[${options.message}]]></message>`)
        }
        console.log(`</abandon_result>`)
      } else {
        console.log(`✓ Abandoned change ${changeId}`)
        if (options.message) {
          console.log(`  Message: ${options.message}`)
        }
      }
    }
  })

export const abandonCommand = (changeId?: string, options: AbandonOptions = {}): Effect.Effect<void, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    
    if (!changeId) {
      // Interactive mode when no change ID provided
      const changes = yield* gerritApi.listChanges('owner:self status:open')
      
      if (changes.length === 0) {
        console.log('No open changes found')
        return
      }
      
      return yield* Effect.promise(() => new Promise<void>((resolve, reject) => {
        const app = render(
          React.createElement(ChangeSelector, {
            changes,
            onSelect: async (selectedChanges: ChangeInfo[]) => {
              app.unmount()
              
              if (selectedChanges.length === 0) {
                console.log('No changes selected')
                resolve()
                return
              }
              
              console.log(`\nAbandoning ${selectedChanges.length} change(s)...\n`)
              
              for (const change of selectedChanges) {
                try {
                  await Effect.runPromise(
                    abandonSingleChange(change.change_id, options).pipe(
                      Effect.provideService(GerritApiService, gerritApi)
                    )
                  )
                } catch (error) {
                  console.error(`Failed to abandon change ${change._number}: ${error instanceof Error ? error.message : String(error)}`)
                }
              }
              
              resolve()
            },
            onCancel: () => {
              app.unmount()
              console.log('\nAbandoning cancelled')
              resolve()
            }
          })
        )
        
        app.waitUntilExit().then(() => resolve()).catch(reject)
      }))
    } else {
      // Non-interactive mode: abandon single change
      return yield* abandonSingleChange(changeId, options)
    }
  })