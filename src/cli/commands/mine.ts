import { Effect } from 'effect'
import { ApiError, GerritApiService } from '@/api/gerrit'
import type { ChangeInfo } from '@/schemas/gerrit'
import { formatDate, getStatusIndicator, colors } from '@/utils/formatters'

interface MineOptions {
  xml?: boolean
}

// ANSI color codes

export const mineCommand = (options: MineOptions): Effect.Effect<void, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    
    const changes = yield* gerritApi.listChanges('owner:self status:open')
    
    if (options.xml) {
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<changes count="${changes.length}">`)
      
      for (const change of changes) {
        console.log(`  <change>`)
        console.log(`    <number>${change._number}</number>`)
        console.log(`    <subject><![CDATA[${change.subject}]]></subject>`)
        console.log(`    <project>${change.project}</project>`)
        console.log(`    <branch>${change.branch}</branch>`)
        console.log(`    <status>${change.status}</status>`)
        console.log(`    <change_id>${change.change_id}</change_id>`)
        if (change.updated) {
          console.log(`    <updated>${change.updated}</updated>`)
        }
        if (change.owner?.name) {
          console.log(`    <owner>${change.owner.name}</owner>`)
        }
        console.log(`  </change>`)
      }
      
      console.log(`</changes>`)
    } else {
      // Pretty output by default
      if (changes.length === 0) {
        console.log('No open changes found')
        return
      }
      
      // Group changes by project
      const changesByProject = changes.reduce((acc, change) => {
        if (!acc[change.project]) {
          acc[change.project] = []
        }
        acc[change.project] = [...acc[change.project], change]
        return acc
      }, {} as Record<string, ChangeInfo[]>)
      
      // Sort projects alphabetically
      const sortedProjects = Object.keys(changesByProject).sort()
      
      for (const project of sortedProjects) {
        console.log(`${colors.blue}${project}${colors.reset}`)
        
        const projectChanges = changesByProject[project]
        for (const change of projectChanges) {
          const status = getStatusIndicator(change)
          const statusPrefix = status ? status + ' ' : ''
          console.log(`  ${statusPrefix}${change._number}: ${change.subject}`)
          if (change.branch !== 'master' && change.branch !== 'main') {
            console.log(`    branch: ${change.branch}`)
          }
          if (change.updated) {
            console.log(`    ${formatDate(change.updated)}`)
          }
        }
      }
    }
  })