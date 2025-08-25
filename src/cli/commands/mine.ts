import { Effect } from 'effect'
import { GerritApiService } from '@/api/gerrit'
import type { ChangeInfo } from '@/schemas/gerrit'

interface MineOptions {
  xml?: boolean
}

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  
  // Check if today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }
  
  // Check if this year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit' 
    })
  }
  
  // Otherwise show full date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: '2-digit',
    year: 'numeric'
  })
}

const getStatusIndicator = (change: ChangeInfo): string => {
  if (!change.labels) return ''
  
  const indicators: string[] = []
  
  // Check for Code-Review
  if (change.labels['Code-Review']) {
    const cr = change.labels['Code-Review']
    if (cr.approved || cr.value === 2) {
      indicators.push(`${colors.green}✅${colors.reset}`)
    } else if (cr.rejected || cr.value === -2) {
      indicators.push(`${colors.red}❌${colors.reset}`)
    } else if (cr.recommended || cr.value === 1) {
      indicators.push('👍')
    } else if (cr.disliked || cr.value === -1) {
      indicators.push('👎')
    }
  }
  
  // Check for Verified
  if (change.labels['Verified']) {
    const v = change.labels['Verified']
    if (v.approved || v.value === 1) {
      indicators.push(`${colors.green}✓${colors.reset}`)
    } else if (v.rejected || v.value === -1) {
      indicators.push(`${colors.red}✗${colors.reset}`)
    }
  }
  
  // Check if submittable
  if (change.submittable) {
    indicators.push('🚀')
  }
  
  // Check if WIP
  if (change.work_in_progress) {
    indicators.push('🚧')
  }
  
  return indicators.length > 0 ? indicators.join(' ') : ''
}

export const mineCommand = (options: MineOptions) =>
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