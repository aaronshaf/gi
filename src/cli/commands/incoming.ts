import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import { colors } from '@/utils/formatters'

interface IncomingOptions {
  xml?: boolean
}

export const incomingCommand = (
  options: IncomingOptions,
): Effect.Effect<void, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService

    // Query for changes where user is a reviewer but not the owner
    const changes = yield* gerritApi.listChanges(
      'is:open -owner:self -is:wip -is:ignored reviewer:self',
    )

    if (options.xml) {
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<incoming_result>`)
      console.log(`  <status>success</status>`)
      console.log(`  <count>${changes.length}</count>`)
      console.log(`  <changes>`)

      for (const change of changes) {
        console.log(`    <change>`)
        console.log(`      <number>${change._number}</number>`)
        console.log(`      <subject><![CDATA[${change.subject}]]></subject>`)
        console.log(`      <project>${change.project}</project>`)
        console.log(`      <branch>${change.branch}</branch>`)
        console.log(`      <status>${change.status}</status>`)
        console.log(`      <change_id>${change.change_id}</change_id>`)
        if (change.owner?.name) {
          console.log(`      <owner>${change.owner.name}</owner>`)
        }
        if (change.updated) {
          console.log(`      <updated>${change.updated}</updated>`)
        }
        console.log(`    </change>`)
      }

      console.log(`  </changes>`)
      console.log(`</incoming_result>`)
    } else {
      // Human-readable output
      if (changes.length === 0) {
        console.log('No incoming changes for review')
        return
      }

      // Group changes by project
      const changesByProject = changes.reduce(
        (acc, change) => {
          if (!acc[change.project]) {
            acc[change.project] = []
          }
          acc[change.project] = [...acc[change.project], change]
          return acc
        },
        {} as Record<string, typeof changes>,
      )

      // Sort projects alphabetically
      const sortedProjects = Object.keys(changesByProject).sort()

      for (const project of sortedProjects) {
        console.log(`\n${colors.blue}${project}${colors.reset}`)

        const projectChanges = changesByProject[project]
        for (const change of projectChanges) {
          const ownerName = change.owner?.name || change.owner?.username || 'Unknown'

          // Build status indicators
          const indicators: string[] = []
          if (change.labels?.['Code-Review']) {
            const cr = change.labels['Code-Review']
            if (cr.approved || cr.value === 2) indicators.push('✅')
            else if (cr.rejected || cr.value === -2) indicators.push('❌')
            else if (cr.recommended || cr.value === 1) indicators.push('👍')
            else if (cr.disliked || cr.value === -1) indicators.push('👎')
          }

          // Check for Verified label as well
          if (change.labels?.['Verified']) {
            const v = change.labels.Verified
            if (v.approved || v.value === 1) {
              if (!indicators.includes('✅')) indicators.push('✅')
            } else if (v.rejected || v.value === -1) {
              indicators.push('❌')
            }
          }

          const statusStr = indicators.length > 0 ? indicators.join(' ') : '        '
          const paddedStatus = statusStr.padEnd(8, ' ')

          console.log(
            `${paddedStatus} ${change._number}  ${change.subject} ${colors.dim}(by ${ownerName})${colors.reset}`,
          )
        }
      }

      console.log(
        `\n${colors.dim}Total: ${changes.length} change(s) awaiting your review${colors.reset}`,
      )
    }
  })
