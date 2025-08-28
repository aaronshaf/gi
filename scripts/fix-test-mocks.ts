#!/usr/bin/env bun

import * as fs from 'fs'
import * as path from 'path'

const testsDir = path.join(process.cwd(), 'tests')

// Find all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(file => file.endsWith('.test.ts'))
  .map(file => path.join(testsDir, file))

for (const file of testFiles) {
  let content = fs.readFileSync(file, 'utf8')
  
  // Skip if already using the helper
  if (content.includes('createMockConfigService')) {
    continue
  }
  
  // Check if file uses ConfigService mock
  if (!content.includes('ConfigService.of({')) {
    continue
  }
  
  console.log(`Updating ${path.basename(file)}...`)
  
  // Add import for helper if ConfigService is used
  if (content.includes('ConfigService')) {
    // Add import after other imports
    const importMatch = content.match(/(import[\s\S]*?from\s+['"].*?['"][\s\n]*)+/)
    if (importMatch) {
      const lastImportEnd = importMatch.index! + importMatch[0].length
      content = content.slice(0, lastImportEnd) +
        `import { createMockConfigService } from './helpers/config-mock'\n` +
        content.slice(lastImportEnd)
    }
    
    // Replace ConfigService.of({ ... }) with createMockConfigService()
    content = content.replace(
      /ConfigService\.of\(\{[\s\S]*?getCredentials:\s*Effect\.succeed\(\{[\s\S]*?\}\),[\s\S]*?saveCredentials:[\s\S]*?deleteCredentials:[\s\S]*?\}\)/g,
      'createMockConfigService()'
    )
    
    // Simpler pattern for common cases
    content = content.replace(
      /ConfigService\.of\(\{[\s\n\s]*getCredentials:\s*Effect\.succeed\(\{[\s\n\s]*host:\s*['"].*?['"],[\s\n\s]*username:\s*['"].*?['"],[\s\n\s]*password:\s*['"].*?['"],?[\s\n\s]*\}\),[\s\n\s]*saveCredentials:\s*\(\)\s*=>\s*Effect\.succeed\(undefined\),[\s\n\s]*deleteCredentials:\s*Effect\.succeed\(undefined\),?[\s\n\s]*\}\)/g,
      'createMockConfigService()'
    )
  }
  
  fs.writeFileSync(file, content, 'utf8')
}

console.log('Done!')